# QuickBooks Online Integration

## Goal
Native QuickBooks Online sync: invoices → QBO invoices. Users connect their QBO account in MowGo Settings, and invoices sync automatically and on demand.

## Architecture

### Stack
- CF Pages Functions for OAuth + sync
- Supabase `integrations` table for token storage
- Intuit OAuth 2.0 (3-legged flow with refresh tokens)
- QuickBooks Online API v3

### Supabase Migration
New table: `integrations` (RLS service-role-only for tokens, user can read own metadata)
```sql
CREATE TABLE public.integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'quickbooks'),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  realm_id text,              -- QuickBooks company ID
  connected_at timestamptz DEFAULT now(),
  expires_at timestamptz,      -- access_token expiry
  metadata jsonb DEFAULT '{}', -- company name, email, sync stats
  last_synced_at timestamptz
);
CREATE UNIQUE INDEX idx_integrations_user_provider ON integrations(user_id, provider);
-- RLS: user can SELECT/UPDATE own rows, tokens accessible internally
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_owner_select" ON integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "integrations_owner_update" ON integrations FOR UPDATE USING (auth.uid() = user_id);
```

### CF Pages Functions

#### 1. `functions/api/integrations/qbo-connect.js` — GET
- Redirects user to Intuit OAuth URL
- State param = random token for CSRF (stored in KV or cookie)
- Scopes: `com.intuit.quickbooks.accounting`
- Returns 302 to Intuit

#### 2. `functions/api/integrations/qbo-callback.js` — GET
- Handles OAuth redirect from Intuit
- Exchanges code for tokens
- Stores in `integrations` table (service role)
- Redirects to `/#/settings?qbo=connected`

#### 3. `functions/api/integrations/qbo-sync.js` — POST
- Authenticated (JWT)
- Reads user's QBO tokens from `integrations`
- Refreshes if expired
- Fetches user's unpaid/unsynced invoices
- Creates/updates QBO invoice via QuickBooks API
- Updates `last_synced_at` and metadata
- Returns sync status

#### 4. `functions/api/integrations/qbo-status.js` — GET
- Returns connection status, company name, last sync time
- Token expiry info

#### 5. `functions/api/integrations/qbo-disconnect.js` — POST
- Deletes integration row
- Clears tokens

### Shared Module: `functions/api/_shared/qbo-tokens.js`
- `getValidAccessToken(env, userId)` — reads from Supabase, refreshes if needed, writes back new tokens
- `refreshQboToken(env, integration)` — calls Intuit refresh endpoint
- `createQboClient(accessToken, realmId)` — returns a thin fetch wrapper for QBO API

### Shared Module: `functions/api/_shared/qbo-env.js`
- Centralized env var access for QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI
- Provides getters with defaults

### Frontend: Settings UI (in `client/src/components/`)
- **QuickBooksConnect.jsx** — Connect button, status badge (connected/disconnected), company name display, last sync time
- **QuickBooksSyncPanel.jsx** — "Sync Now" button, sync progress, last result (success/error)
- Integrate into `client/src/pages/Settings.jsx` beside WebhookSettings

### Events that trigger auto-sync
In `client/src/lib/data.js`, after `fireWebhook()`, also fire `fireQuickBooksSync()` for:
- `invoice.created` — create QBO invoice
- `invoice.paid` — update QBO invoice status
- `invoice.deleted` — void QBO invoice

`fireQuickBooksSync` = POST to `/api/integrations/qbo-sync` with event + payload

### Env Vars Needed (Cloudflare Pages)
- `QBO_CLIENT_ID` — Intuit OAuth client ID
- `QBO_CLIENT_SECRET` — Intuit OAuth client secret
- `QBO_REDIRECT_URI` — `https://mowgo.pages.dev/api/integrations/qbo-callback`

### Intuit Setup (manual)
1. Create account at developer.intuit.com
2. Create app → "QuickBooks Online API"
3. Set redirect URI to `https://mowgo.pages.dev/api/integrations/qbo-callback`
4. Copy Client ID + Secret to CF Pages env vars

## Implementation Order
1. Supabase migration
2. Shared token modules + env helpers
3. OAuth connect + callback functions
4. Sync function
5. Status + disconnect functions
6. Frontend components
7. Wire auto-sync into data.js
8. i18n strings
9. Deploy + verify