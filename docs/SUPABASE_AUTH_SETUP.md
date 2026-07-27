# Supabase Auth Configuration for MowGo

Required settings in the Supabase dashboard for password reset, email confirmation,
and auth redirects to work correctly.

**Project:** `vqgiynfrpsqddjrayczc`
**Dashboard URL:** https://supabase.com/dashboard/project/vqgiynfrpsqddjrayczc

---

## 1. Site URL (Authentication → URL Configuration)

Set the **Site URL** to your production domain:

```
https://your-production-domain.com
```

For local development:

```
http://localhost:5173
```

> The Site URL is used as the default redirect target for password reset emails
> and email confirmations when no `redirectTo` is specified.

---

## 2. Redirect URLs (Authentication → URL Configuration)

Add your app's URL to the **Redirect URLs** allowlist. Supabase will only
redirect to URLs in this list — any URL not listed is blocked.

Add these entries:

```
http://localhost:5173
http://localhost:3000
https://your-production-domain.com
```

> ⚠️ If a redirect URL is not in this list, Supabase will show its own error
> page instead of redirecting back to your app. This is the most common cause
> of the raw Supabase error page appearing.

---

## 3. Email Templates (Authentication → Email Templates)

### Password Reset (Magic Link)

Go to **Authentication → Email Templates → Password Reset**.

The default template works, but you can customize it. The key variable is
`{{ .ConfirmationURL }}` which contains the reset link with the token.

Example template:

```html
<h2>Reset your password</h2>
<p>Click the link below to set a new password for your MowGo account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
```

> The `{{ .ConfirmationURL }}` is automatically constructed by Supabase using
> your Site URL + Redirect URLs config. Do NOT hardcode redirect URLs in
> the template itself.

### Email Confirmation (Signup)

Go to **Authentication → Email Templates → Confirm signup**.

Similar to above, uses `{{ .ConfirmationURL }}`.

Example:

```html
<h2>Welcome to MowGo!</h2>
<p>Click the link below to confirm your email and activate your account.</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
```

---

## 4. How the Redirect Flow Works

### Successful Password Reset

1. User clicks reset link in email → Supabase verifies the token
2. Supabase redirects to `redirectTo` URL (set in `resetPasswordForEmail`)
3. URL contains `#access_token=...&type=recovery` in the hash
4. Supabase JS client (`detectSessionInUrl: true`) processes the token
5. `onAuthStateChange` fires → app navigates to `/app`

### Expired/Invalid Reset Link

1. User clicks expired/invalid link → Supabase detects bad token
2. Supabase redirects to `redirectTo` URL with error params in hash:
   `#error=access_denied&error_code=otp_expired&error_description=...`
3. **MowGo fix:** `SupabaseErrorRedirect` component in `App.jsx` detects
   the error hash and rewrites to `/#/login` with error params preserved
4. `Login.jsx` `useEffect` parses error params and shows friendly message:
   "This password reset link has expired. Please request a new one."

---

## 5. Environment Variables

### Client (`client/.env`)

```
VITE_SUPABASE_URL=https://vqgiynfrpsqddjrayczc.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Server (`server/.env`)

```
SUPABASE_URL=https://vqgiynfrpsqddjrayczc.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
```

---

## 6. Common Issues & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| Raw Supabase error page on expired link | Redirect URL not in allowlist | Add your domain to Redirect URLs in dashboard |
| "Failed to fetch" on reset | `SUPABASE_URL` not set in client env | Set `VITE_SUPABASE_URL` in `client/.env` |
| Reset email not received | Email not confirmed / user doesn't exist | Supabase silently ignores non-existent emails |
| Redirect goes to wrong page | `redirectTo` URL not in Redirect URLs | Add the URL to the allowlist |
| Hash params lost on redirect | Hash router conflict with Supabase hash params | Fixed by `SupabaseErrorRedirect` component |
