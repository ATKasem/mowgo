# MowGo Comparison Site Submission Status — Aug 3, 2026

## What got done today (Track A recon + partial submissions)

### ✅ Accounts created (credentials in /opt/data/secrets/directory-accounts.txt)
| Site | Account | Status |
|---|---|---|
| SoftwareWorld | vendor signup form filled (aaronkasem@gmail.com) | ❌ REJECTED — requires BUSINESS email (gmail.com not supported) |
| Krowdbase | signup form filled, reCAPTCHA passed (token present) | ❌ REJECTED — reCAPTCHA re-verifies at submit; automated browser flagged |
| Capterra (G2 Digital Markets) | get-listed form filled | ❌ REJECTED — "gmail.com is not supported. Please use your Business Email" |
| AlternativeTo | signup form filled (mowgo / aaronkasem@gmail.com) | ❌ BLOCKED — hCaptcha image challenge triggered (bot fingerprint). NOTE: new accounts must be 7 days old before submitting an app — start account ASAP |

### 🔒 Sites requiring contact/forms (no self-serve)
- **GoodFirms** — "Get Listed" is a sponsorship/sales form (free listing has 23% acceptance, research-verified, Cloudflare-gated). Not self-serve.
- **FieldPickr / TradeApp Reviews / FieldServiceStack / Guideflow / Agiled / mow.best / Aimadefor** — content-driven sites, contact-based or no visible submission path.
- **Briostack / QuoteIQ list** — competitors, won't list MowGo.

## 🔑 THE BLOCKER: no business email
Capterra (highest ROI — one form = GetApp + Software Advice cross-listed) and SoftwareWorld BOTH require a non-gmail business email. We own no domain (Cloudflare zones: none).

**Fix options:**
1. **Register mowgo.com or mowgo.app** (~$10-15/yr) → Cloudflare Email Routing (FREE) → hello@mowgo.com forwards to aaronkasem@gmail.com → unblocks Capterra + SoftwareWorld + makes all other submissions look legit. RDAP check Aug 3: mowgo.com / mowgo.app / mowgo.io ALL AVAILABLE.
2. Do Capterra/SoftwareWorld manually with a personal non-gmail (e.g. outlook) — weaker.

## Next actions (priority order)
1. [AARON] Register domain (mowgo.com preferred, ~$10-15/yr) — unblocks the 2 biggest listings
2. [HERMES] Once business email exists: Capterra get-listed (app.g2digitalmarkets.com/get-listed/start), SoftwareWorld vendor register, AlternativeTo account (start 7-day clock)
3. [HERMES] SourceForge vendor listing (needs account; list Jobber/Yardbook/QuoteIQ as competitors so MowGo appears on their pages)
4. [AARON] Krowdbase + AlternativeTo captchas — 2 min manual, forms already filled
5. Re-audit monthly per skill

## Submission copy (verified, ready)
- Product: MowGo | URL: https://mowgo.pages.dev | Category: Lawn Care Software
- Tagline: Simple scheduling & invoicing for small lawn care crews
- Free tier: 5 clients, rain delay, no card | Solo $39/mo | Crew $79/mo | No per-user fees
- Full copy: launch-kit/README.md (scrubbed of dead AI Autopilot Aug 3)
