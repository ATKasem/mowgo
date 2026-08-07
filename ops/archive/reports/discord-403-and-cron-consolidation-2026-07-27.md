# Discord 403 diagnosis and cron consolidation

Date: 2026-07-27

## Discord channel rename

### Finding

The reported HTTP 403 with error `1010` is a Cloudflare client-signature
block, not a Discord permission error.

- Cloudflare defines error 1010 as access denied based on the client's browser
  signature:
  https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
- Discord uses JSON error `50013` for missing permissions and `40333` when
  Cloudflare blocks a request, noting that a proper User-Agent often resolves
  it:
  https://docs.discord.com/developers/topics/opcodes-and-status-codes
- Discord's Modify Channel endpoint requires `MANAGE_CHANNELS`:
  https://docs.discord.com/developers/resources/channel
- `ADMINISTRATOR` (`0x8`) grants all permissions and bypasses channel
  overwrites:
  https://docs.discord.com/developers/topics/permissions

The integration-managed role does not prevent its bot from renaming channels.
`managed: true` describes Discord's management of the role itself. Since the
role has `ADMINISTRATOR`, adding `MANAGE_CHANNELS` (`0x10`) to `@everyone` or
creating another role will not address error 1010.

### Recommended request

Use API v10, bot authentication, JSON content type, and a valid Discord bot
User-Agent:

```sh
curl --fail-with-body \
  -X PATCH \
  -H "Authorization: Bot $DISCORD_TOKEN" \
  -H "User-Agent: DiscordBot (https://github.com/Mowflow/mowflow, 1.0)" \
  -H "Content-Type: application/json" \
  -H "X-Audit-Log-Reason: MowFlow to MowGo rename" \
  --data '{"name":"🌱mowgo"}' \
  "https://discord.com/api/v10/channels/1529248227394850916"
```

Apply the equivalent request to:

| Channel ID | New name |
|---|---|
| `1529248227394850916` | `🌱mowgo` |
| `1529707223956062318` | `🌱mowgo-leads` |
| `1529707289014042804` | `🌱mowgo-leads` |
| `1529711006023024680` | `🌱mowgo-outreach` |
| `1529736297847980153` | `🤝mowgo-cowork` |

The duplicate channel should be confirmed or deleted separately after the
rename; channel deletion is irreversible.

### Execution status

A live API test from this workspace could not run because DNS resolution for
`discord.com` is disabled (`curl: (6) Could not resolve host`). No Discord
roles or channels were changed.

The disclosed bot token must be rotated in the Discord Developer Portal before
continued use.

## Cron consolidation

Source reviewed: `/opt/data/cron/jobs.json` (35 jobs: 31 active, 4 disabled).

### 1. MowGo Intel Engine

Keep `54982fcbf42e` as the single intelligence orchestrator and rename it to
`MowGo Intel Engine`.

Absorb:

- `721f9dd1d471` — interval Reddit monitor
- `947c207761c5` — daily Reddit monitor
- `600253d05a52` — weekly lead discovery
- `c59ef9cc2b05` — weekly digest and auto-fix

Recommended design:

- Run the engine every four hours, as today.
- On every run, rotate one market-intelligence lane.
- Run one consolidated Reddit lane every 12 hours, searching only the last
  48 hours and deduplicating by canonical thread URL.
- Run lead discovery on the Sunday window and persist a last-success marker so
  interval timing cannot execute it twice.
- Produce the digest on Sunday from the week's persisted Intel Engine output;
  do not research the same sources again.
- Remove the digest's code auto-fix step. Keep code review/fixing in
  `eaa76d30f06f` (`MowGo — Codex CLI bug hunt`) to avoid mixing market
  intelligence with code mutation.
- Update all paths, skill names, delivery labels, and prompt text from MowFlow
  to MowGo.

After one successful shadow run, disable the four absorbed jobs. Delete them
only after a one-week rollback window.

### 2. Cron Operations Report

Merge:

- `c8b340573ac2` — Cron health check
- `5f4f5ef759f2` — Cron directory

Keep `c8b340573ac2`, rename it to `Cron operations report`, retain the existing
every-three-days schedule, and add the directory's category table ahead of the
health and estimated-cost sections. Disable `5f4f5ef759f2` after verifying one
combined delivery.

### 3. Configuration and Breadcrumb Audit

Merge:

- `131d41d93ad1` — Config drift detector + auto-fix
- `227e5a05032b` — Breadcrumb auditor + auto-fix

Keep `131d41d93ad1`, rename it to `Memory integrity audit + auto-fix`, retain
the Monday schedule, and run two explicitly separated phases:

1. Reconcile the cron routing table against `jobs.json`.
2. Audit vault breadcrumbs after reconciliation.

Deliver one report with per-phase counts and failures. Disable
`227e5a05032b` after one successful combined run.

### Expected result

Retiring six absorbed jobs reduces the inventory from 35 to 29 entries and
active schedules from 31 to 25. During the rollback window, retain all 35
entries but leave those six disabled.
