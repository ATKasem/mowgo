# MowFlow Supabase Auth Email — Setup Guide

## Problem

Supabase's **default SMTP** has a strict limit of **2 auth emails per hour** and only sends to project team members. The forgot password flow is hitting "email rate limit exceeded" on the free tier.

**Both Gmail SMTP and Resend can bypass this limit** by configuring a custom SMTP provider.

---

## Research Summary

| Option | Rate Limit | Cost | Setup Difficulty | Deliverability |
|--------|-----------|------|-----------------|----------------|
| Supabase Default | 2/hour | Free | None | Low (spam prone) |
| Gmail SMTP (App Password) | 500/day | Free | Medium (2FA + App Password) | Medium (personal sender) |
| Resend SMTP | 3,000/month (100/day) | Free | Easy | High (transactional) |
| Supabase Pro Tier | 30/hour | $25/mo | None | N/A |

### Key Findings

1. **Custom SMTP completely bypasses the 2/hour limit**. Once configured, Supabase imposes a default rate limit of **30 messages/hour** (adjustable in dashboard). This applies to both free and paid Supabase tiers.

2. **Gmail SMTP** requires:
   - 2FA enabled on the Google account
   - A 16-char App Password (no longer "Less Secure Apps" — Google removed that Sept 2024)
   - 500 emails/day limit (free Gmail), 2,000/day (Workspace)
   - ⚠️ **Risk**: Using a personal Gmail for SaaS auth emails can get the account flagged or banned. Google may detect automated sending and suspend the account.

3. **Resend SMTP** is the recommended path:
   - Already have a `RESEND_API_KEY` in `server/.env`
   - 3,000 emails/month free (100/day)
   - Dedicated transactional email service — better deliverability
   - No personal account risk
   - Resend has an official Supabase SMTP integration doc

---

## Recommendation: Use Resend

**Why Resend over Gmail:**
- You already have the API key in `.env`
- Better email deliverability (dedicated transactional email service)
- No personal Gmail account at risk of being flagged
- 3,000 emails/month is more than enough for auth flows (password resets, confirmations)
- Professional sender domain support (e.g., `no-reply@mowflow.app`)
- Resend officially documents the Supabase SMTP integration

---

## Setup Guide: Resend + Supabase SMTP

### Step 1: Add Your Domain to Resend

1. Log into [Resend dashboard](https://resend.com)
2. Go to **Domains** → click **Add Domain**
3. Enter your domain (e.g., `mowflow.app`)
4. Resend provides DNS records to add. Add these to your DNS provider:

   | Type | Name | Value |
   |------|------|-------|
   | MX | send | `feedback-smtp.us-east-1.amazonses.com` |
   | TXT | send | `v=spf1 include:amazonses.com ~all` |
   | TXT | resend._domainkey | *(your DKIM key from Resend)* |

5. Click **Verify** in Resend (DNS propagation takes a few minutes)

> **Note**: If you don't have a custom domain yet, Resend allows sending from `onboarding@resend.dev` for testing — but for production, use your own domain.

### Step 2: Get Your Resend API Key

1. In Resend dashboard, go to **API Keys**
2. Create a new key (or use existing one from `server/.env`)
3. Copy the key — it looks like `re_...`

### Step 3: Configure Supabase SMTP

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/vqgiynfrpsqddjrayczc/settings/auth
2. Navigate to **Authentication** → **Email** → **SMTP Settings**
3. Enable custom SMTP and enter:

   | Setting | Value |
   |---------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | *(your Resend API key — e.g., `re_...`)* |
   | Sender Email | `no-reply@yourdomain.com` |
   | Sender Name | `MowFlow` |

4. Click **Save**

### Step 4: Set Up DNS for Send Reputation (Optional but Recommended)

Add SPF/DKIM/DMARC records to your domain to improve deliverability:

```
# SPF (add to your domain's DNS TXT record)
v=spf1 include:amazonses.com ~all

# DKIM (from Resend dashboard — copy the exact value)
resend._domainkey  TXT  "p=MIGfMA0GCSqGSIb3DQEBAQUAA..."

# DMARC
_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"
```

### Step 5: Adjust Supabase Rate Limits (Optional)

After configuring custom SMTP, Supabase sets a default limit of **30 messages/hour**. To adjust:

1. Go to Supabase Dashboard → **Project Settings** → **Rate Limits**
2. Increase the auth email rate limit as needed

### Step 6: Test

1. Go to your app's login page
2. Click "Forgot Password" with your email
3. Check that the email arrives (should come from your Resend-configured sender)
4. Verify the reset link works

---

## Alternative: Gmail SMTP (Not Recommended for Production)

If you want to use Gmail instead (e.g., for testing only):

### Setup Steps

1. **Enable 2FA** on `aaronkasem@gmail.com`
2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Create a new app password (16 chars)
   - Save it securely
3. **Configure Supabase SMTP**:

   | Setting | Value |
   |---------|-------|
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | `aaronkasem@gmail.com` |
   | Password | *(16-char App Password)* |
   | Sender Email | `aaronkasem@gmail.com` |
   | Sender Name | `MowFlow` |

### Gmail Limits
- **500 emails/day** (free Gmail)
- **2,000/day** (Google Workspace)
- ⚠️ Google may flag or suspend the account if it detects automated bulk sending
- ⚠️ Using a personal email for SaaS is not professional (emails appear from `aaronkasem@gmail.com`)

---

## Supabase Pro Tier (Not Recommended Yet)

- **$25/month** for 30 auth emails/hour
- No setup required, but still limited to 30/hour
- Not worth it when Resend is free and handles this well

---

## Quick Reference: Which Option to Use

| Scenario | Recommendation |
|----------|---------------|
| Quick fix, no custom domain | Resend with `onboarding@resend.dev` |
| Production SaaS | Resend + custom domain + SPF/DKIM/DMARC |
| Testing only | Gmail App Password |
| Need more than 30/hour | Resend Pro ($20/mo for 50K emails) |

---

## Files Modified

- None — this is a dashboard configuration guide
- The Supabase dashboard needs to be configured manually (steps above)
- No code changes required — Supabase handles sending through custom SMTP

## Current Status (2026-07-25)

### ✅ Completed
- [x] Domain `mowflow.app` added to Resend (ID: `d5a10f82-6dd3-41cd-a7cc-fef286dd82d8`)
- [x] SMTP config updated via Management API:
  - Host: `smtp.resend.com`, Port: `465`, User: `resend`
  - Password: Resend API key (set via PATCH, masked in GET)
  - Sender: `no-reply@mowflow.app` (MowFlow)
- [x] `site_url` set to `https://mowflow.app`
- [x] Redirect URLs added: `https://mowflow.app`, `http://localhost:5173`, `http://localhost:3000`
- [x] Rate limits raised: `rate_limit_email_sent: 60`, `smtp_max_frequency: 30`
- [x] SMTP connection test passed (both SSL:465 and STARTTLS:587)

### ⏳ Pending: DNS Records (Vercel Dashboard)

Domain is on **Vercel DNS** (`ns1.vercel-dns.com`). Add these 3 records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIbDQEBAQUAA4GNADCBiQKBgQCXRW02JNl+2lXOfxdYBJcLC7NEdfOcEzMVxlfNz7mZxJXSkuIx7VHVa00/mYrOOjuPnhcipTS5zRu4kQtSXUZx+8DqBOVWuR1g0KAPyIUX7RBgxNBG6mhtnoV9yI9K93mvbiMuJcz/HzgobLQhxk9OOgmcbQx6vEbhKJGlJ8oIbwIDAQAB` | Auto |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) | 60 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | 60 |

After adding DNS, verify in Resend dashboard → Domains → `mowflow.app` → Verify.

### Next Steps

1. [ ] Add 3 DNS records above in Vercel dashboard
2. [ ] Verify domain in Resend dashboard
3. [ ] Test forgot password flow end-to-end
4. [ ] Verify email deliverability (check spam folder)
