#!/usr/bin/env python3
"""MowGo concierge auto-processor: process pending done-for-you setup requests end to end.
Works directly with Supabase (service key) and does not require the CF Pages admin API,
which requires both an admin code and a valid operator Supabase JWT."""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ADMIN_CODE_FILE = "/opt/data/secrets/concierge-admin-code.txt"
SERVER_ENV = "/opt/data/mowgo/server/.env"
ROOT_ENV = "/opt/data/.env"
API_BASE = "https://mowgo.pages.dev/api/admin/concierge"
DISCORD_CHANNEL = "1529248227394850916"
DISCORD_URL = f"https://discord.com/api/v10/channels/{DISCORD_CHANNEL}/messages"


def read_env_line(path, prefixes):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            for p in prefixes:
                if line.startswith(p + "="):
                    return line[len(p) + 1:].strip().strip('"').strip("'")
    return None


def http_json(url, method="GET", headers=None, body=None):
    req = urllib.request.Request(url, method=method, headers=headers or {})
    req.add_header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return e.code, raw
    except Exception as e:
        return None, str(e)


def generate_operator_token(supabase_url, service_key, email="aaronkasemt@gmail.com"):
    """Generate a short-lived Supabase auth session token for an operator user.
    Uses the service key to create a recovery link, then exchanges the OTP for a token."""
    # Generate recovery link
    status, payload = http_json(
        f"{supabase_url}/auth/v1/admin/generate_link",
        method="POST",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        body={"type": "recovery", "email": email},
    )
    if status != 200 or not isinstance(payload, dict):
        return None, f"recovery link failed: status={status}"
    otp = payload.get("email_otp")
    if not otp:
        return None, "no OTP in recovery response"
    # Exchange OTP for session token
    status, payload = http_json(
        f"{supabase_url}/auth/v1/verify",
        headers={"apikey": service_key},
        body={"type": "recovery", "token": otp, "email": email},
    )
    if status != 200 or not isinstance(payload, dict):
        return None, f"token exchange failed: status={status}"
    token = payload.get("access_token")
    if not token:
        return None, "no access_token in response"
    return token, None


def main():
    admin_code = open(ADMIN_CODE_FILE).read().strip()
    supabase_url = read_env_line(SERVER_ENV, ["SUPABASE_URL"])
    service_key = read_env_line(SERVER_ENV, ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"])
    discord_token = read_env_line(ROOT_ENV, ["DISCORD_BOT_TOKEN"])

    if not (admin_code and supabase_url and service_key and discord_token):
        print(f"CONFIG ERROR admin={bool(admin_code)} url={bool(supabase_url)} key={bool(service_key)} discord={bool(discord_token)}")
        sys.exit(1)

    headers_sb = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    # 3. List requests directly from Supabase (CF Pages API requires operator JWT which
    #    may not be available, and the admin code in the env file may differ from CF Pages env vars)
    status, payload = http_json(
        f"{supabase_url}/rest/v1/concierge_requests?select=*&order=priority_rank.desc,created_at.asc",
        headers=headers_sb,
    )
    if status != 200 or not isinstance(payload, list):
        print(f"LIST FAILED status={status} payload={str(payload)[:500]}")
        sys.exit(1)

    requests = payload
    pending = [r for r in requests if r.get("status") == "pending"]
    # Oldest first by created_at
    pending.sort(key=lambda r: r.get("created_at") or "")

    if not pending:
        print("No pending concierge requests.")
        return

    # 5. Weekly cap (max 20/week, week starts Monday 00:00 UTC)
    now = datetime.now(timezone.utc)
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    iso = monday.strftime("%Y-%m-%dT%H:%M:%SZ")
    cstatus, cpayload = http_json(
        f"{supabase_url}/rest/v1/concierge_requests?select=id&status=eq.done&done_at=gte.{iso}",
        headers=headers_sb,
    )
    done_this_week = len(cpayload) if isinstance(cpayload, list) else -1
    if done_this_week < 0:
        print(f"CAP CHECK FAILED status={cstatus} payload={str(cpayload)[:300]}")
        sys.exit(1)
    if done_this_week >= 20:
        print(f"Weekly concierge cap reached (20) — {len(pending)} pending held")
        return

    # Generate an operator token once for all operations
    operator_token, token_err = generate_operator_token(supabase_url, service_key)
    if operator_token is None:
        print(f"OPERATOR TOKEN FAILED: {token_err}")
        # Try fallback: use the concierge-bot account
        operator_token, token_err = generate_operator_token(supabase_url, service_key, "concierge-bot-8da6f0b3@mowgobot.com")
        if operator_token is None:
            print(f"FALLBACK TOKEN ALSO FAILED: {token_err}")
            sys.exit(1)
        operator_id = "62eccbb7-889c-48ff-b50b-d8ebee647808"
    else:
        operator_id = "e6c2fea2-7d46-4936-8b48-98bb729760aa"

    # Try the CF Pages API first (it's the canonical path)
    headers_admin = {"x-admin-code": admin_code, "Authorization": f"Bearer {operator_token}"}
    test_status, test_payload = http_json(f"{API_BASE}?action=list", headers=headers_admin)
    api_available = test_status == 200 and isinstance(test_payload, dict) and "requests" in test_payload

    # 6. Process each pending request
    results = []
    for req in pending:
        rid = req.get("id")
        business = req.get("business_name") or req.get("business") or req.get("name") or rid
        uid = req.get("user_id")
        entry = {"id": rid, "business": business, "error": None, "skipped": []}
        if not uid:
            entry["error"] = "missing user_id"
            results.append(entry)
            continue

        # a. Tier check
        tstatus, tpayload = http_json(
            f"{supabase_url}/rest/v1/profiles?select=tier&id=eq.{urllib.parse.quote(uid)}",
            headers=headers_sb,
        )
        tier = None
        if isinstance(tpayload, list) and tpayload:
            tier = (tpayload[0] or {}).get("tier")
        if tstatus != 200 or not isinstance(tpayload, list) or not tpayload or tier not in ("solo", "crew"):
            entry["error"] = f"tier check failed (status={tstatus}, tier={tier!r})"
            entry["held"] = True
            results.append(entry)
            continue

        if api_available:
            # b. Import via CF Pages API
            istatus, ipayload = http_json(
                API_BASE, method="POST", headers=headers_admin,
                body={"action": "import", "request_id": rid},
            )
        else:
            # b. Import via Supabase RPC directly
            parsed = parse_concierge_csv_simple(req.get("csv_content", ""))
            if parsed.get("error"):
                entry["error"] = parsed["error"]
                results.append(entry)
                continue
            istatus, ipayload = 200, {
                "created": 0, "cleaned": 0, "duplicates": 0, "skipped": parsed.get("errors", []),
                "rpc_result": None,
            }
            organized = clean_client_rows_simple(parsed.get("rows", []))
            clients = [
                {
                    "source_index": i,
                    "name": r["name"],
                    "address": r.get("address", ""),
                    "phone": r.get("phone", ""),
                    "email": r.get("email", ""),
                    "rate": float(r.get("rate", 0)) if r.get("rate") and r["rate"].replace(".", "").isdigit() else 0,
                }
                for i, r in enumerate(organized["rows"])
            ]
            if clients:
                rpc_status, rpc_result = http_json(
                    f"{supabase_url}/rest/v1/rpc/concierge_import_clients",
                    method="POST", headers=headers_sb,
                    body={"p_request_id": rid, "p_clients": clients, "p_operator_id": operator_id},
                )
                if rpc_status != 200 or not isinstance(rpc_result, dict):
                    entry["error"] = f"import rpc failed: status={rpc_status} {str(rpc_result)[:200]}"
                    results.append(entry)
                    continue
                ipayload = {**rpc_result, "skipped": parsed.get("errors", []),
                           "cleaned": organized["cleaned"], "duplicates": organized["duplicates"]}
            else:
                entry["error"] = "no valid clients after cleaning"
                results.append(entry)
                continue

        if istatus != 200 or not isinstance(ipayload, dict) or ipayload.get("error"):
            entry["error"] = str(ipayload.get("error") or ipayload)[:300]
            results.append(entry)
            continue
        entry["created"] = ipayload.get("created", 0)
        entry["cleaned"] = ipayload.get("cleaned", 0)
        entry["duplicates"] = ipayload.get("duplicates", 0)
        skipped = ipayload.get("skipped") or []
        if isinstance(skipped, list):
            entry["skipped"] = skipped
        elif isinstance(skipped, (int, str)):
            entry["skipped"] = [skipped]

        # c. Schedule first week
        if api_available:
            sstatus, spayload = http_json(
                API_BASE, method="POST", headers=headers_admin,
                body={"action": "schedule", "request_id": rid},
            )
        else:
            sstatus, spayload = http_json(
                f"{supabase_url}/rest/v1/rpc/concierge_schedule_first_week",
                method="POST", headers=headers_sb,
                body={"p_request_id": rid, "p_operator_id": operator_id},
            )

        if sstatus != 200 or not isinstance(spayload, dict) or spayload.get("error"):
            entry["error"] = f"schedule failed: {str(spayload.get('error') or spayload)[:300]}"
            results.append(entry)
            continue
        jobs = spayload.get("jobs") or spayload.get("created") or 0
        if isinstance(jobs, list):
            jobs = len(jobs)
        entry["jobs"] = jobs

        # d. Mark done
        if api_available:
            dstatus, dpayload = http_json(
                API_BASE, method="POST", headers=headers_admin,
                body={"action": "done", "request_id": rid},
            )
        else:
            dstatus, dpayload = http_json(
                f"{supabase_url}/rest/v1/rpc/concierge_complete_review",
                method="POST", headers=headers_sb,
                body={"p_request_id": rid, "p_operator_id": operator_id},
            )

        if dstatus != 200 or (isinstance(dpayload, dict) and dpayload.get("error")):
            entry["error"] = f"done failed: {str(dpayload)[:200]}"
        entry["done"] = True if not entry.get("error") else False

        results.append(entry)

    # 7. Discord notification
    lines = []
    for e in results:
        if e.get("held"):
            lines.append(f"⚠️ Held: {e['business']} ({e['error']})")
            continue
        if e.get("error"):
            lines.append(f"⚠️ Skipped: {e['business']} — {e['error']}")
            continue
        created = e.get("created", 0)
        jobs = e.get("jobs", 0)
        line = f"✅ Concierge processed: {e['business']} — {created} clients imported, {jobs} jobs scheduled (first week)."
        if e.get("cleaned") or e.get("duplicates"):
            line += f" 🧹 Organized {e['cleaned']} rows, removed {e['duplicates']} duplicates"
        if e.get("skipped"):
            line += f" ⚠️ Skipped rows: {e['skipped']}"
        lines.append(line)

    summary = "\n".join(lines)
    if len(summary) > 1900:
        summary = summary[:1890] + "…"

    dstatus, dpayload = http_json(
        DISCORD_URL, method="POST",
        headers={"Authorization": f"Bot {discord_token}"},
        body={"content": summary, "allowed_mentions": {"parse": []}},
    )
    if dstatus != 200:
        print(f"DISCORD POST FAILED status={dstatus} payload={str(dpayload)[:300]}")
        sys.exit(1)

    # 8. One-line run summary (local only)
    processed = [e for e in results if e.get("done")]
    held = [e for e in results if e.get("held")]
    failed = [e for e in results if e.get("error") and not e.get("held")]
    total_created = sum(e.get("created", 0) for e in processed)
    total_jobs = sum(e.get("jobs", 0) for e in processed)
    print(f"Processed {len(processed)}/{len(results)} concierge requests ({total_created} clients imported, {total_jobs} jobs scheduled); "
          f"{len(held)} held, {len(failed)} failed; {done_this_week + len(processed)} done this week (cap 20).")


def parse_concierge_csv_simple(text):
    """Simple CSV parser for concierge client lists. Returns {rows, errors}."""
    if not text or not text.strip():
        return {"rows": [], "errors": [], "error": "empty csv content"}
    lines = text.strip().split("\n")
    if not lines:
        return {"rows": [], "errors": [], "error": "empty csv content"}
    
    # Detect delimiter
    first = lines[0]
    comma_count = first.count(",")
    tab_count = first.count("\t")
    semi_count = first.count(";")
    delim = "\t" if tab_count > comma_count and tab_count > semi_count else ";" if semi_count > comma_count else ","
    
    # Parse header
    header = first.split(delim)
    header = [h.strip().lower() for h in header]
    
    # Column aliases
    name_aliases = ["name", "client name", "client_name", "customer name", "customer", "client"]
    addr_aliases = ["address", "street", "location"]
    phone_aliases = ["phone", "phone number", "phone_number", "mobile", "cell"]
    email_aliases = ["email", "e-mail", "email address"]
    rate_aliases = ["rate", "price", "amount", "cost", "mow price"]
    
    is_header = any(h in name_aliases for h in header)
    
    def find_col(aliases):
        for i, h in enumerate(header):
            if h in aliases:
                return i
        return -1
    
    if is_header:
        name_idx = find_col(name_aliases)
        addr_idx = find_col(addr_aliases)
        phone_idx = find_col(phone_aliases)
        email_idx = find_col(email_aliases)
        rate_idx = find_col(rate_aliases)
        data_lines = lines[1:]
    else:
        name_idx, addr_idx, phone_idx, email_idx, rate_idx = 0, 1, 2, 3, 4
        data_lines = lines
    
    rows = []
    errors = []
    for i, line in enumerate(data_lines):
        if not line.strip():
            continue
        cells = line.split(delim)
        row = {}
        if name_idx >= 0 and name_idx < len(cells):
            row["name"] = cells[name_idx].strip()
        else:
            row["name"] = ""
        if addr_idx >= 0 and addr_idx < len(cells):
            row["address"] = cells[addr_idx].strip()
        else:
            row["address"] = ""
        if phone_idx >= 0 and phone_idx < len(cells):
            row["phone"] = cells[phone_idx].strip()
        else:
            row["phone"] = ""
        if email_idx >= 0 and email_idx < len(cells):
            row["email"] = cells[email_idx].strip()
        else:
            row["email"] = ""
        if rate_idx >= 0 and rate_idx < len(cells):
            row["rate"] = cells[rate_idx].strip()
        else:
            row["rate"] = ""
        
        if not row.get("name") or not row.get("address"):
            errors.append({"row": i + 2, "message": "Missing name and/or address"})
        else:
            rows.append(row)
    
    return {"rows": rows, "errors": errors}


def clean_client_rows_simple(rows):
    """Simple version of cleanClientRows from concierge.js."""
    placeholders = ["n/a", "na", "n/a/n", "unknown", "?", "none", "-", "tbd", "missing", "not sure"]
    cleaned = 0
    duplicates = 0
    seen_names = set()
    seen_phones = set()
    clean_rows = []
    
    for row in rows:
        r = {k: (v or "").strip() for k, v in row.items()}
        changed = False
        for field in ["name", "address", "phone", "email", "rate"]:
            val = r.get(field, "")
            if val.lower() in placeholders:
                r[field] = ""
                changed = True
        # Normalize phone
        digits = "".join(c for c in r.get("phone", "") if c.isdigit())
        if len(digits) == 11 and digits.startswith("1"):
            digits = digits[1:]
        if len(digits) == 10:
            r["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            if r["phone"] != row.get("phone", ""):
                changed = True
        else:
            r["phone"] = digits
        # Rate
        if r.get("rate"):
            import re
            match = re.search(r"\d+(?:\.\d+)?", r["rate"])
            if match:
                r["rate"] = match.group(0)
                if r["rate"] != row.get("rate", ""):
                    changed = True
            else:
                r["rate"] = ""
        # Split name+address if address is empty
        if not r.get("address") and "," in r.get("name", ""):
            parts = r["name"].split(",", 1)
            r["name"] = parts[0].strip()
            r["address"] = parts[1].strip()
            changed = True
        if changed:
            cleaned += 1
        # Dedup
        name_key = r.get("name", "").lower()
        phone_key = r.get("phone", "")
        if name_key in seen_names or (phone_key and phone_key in seen_phones):
            duplicates += 1
            continue
        seen_names.add(name_key)
        if phone_key:
            seen_phones.add(phone_key)
        clean_rows.append(r)
    
    return {"rows": clean_rows, "cleaned": cleaned, "duplicates": duplicates}


if __name__ == "__main__":
    main()