-- 002_crew_features.sql — Crew/Team foundation
-- Adds role + business_id to profiles, team_invitations table,
-- and replaces single-user RLS policies with business-scoped ones.

-- ====================================================================
-- 1. profiles: add role & business_id
-- ====================================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES profiles(id);

COMMENT ON COLUMN profiles.role IS 'owner | crew';
COMMENT ON COLUMN profiles.business_id IS 'For crew members: the owner profile id they belong to. NULL for owners.';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'crew')),
  ADD CONSTRAINT profiles_membership_check CHECK (
    (role = 'owner' AND business_id IS NULL)
    OR (role = 'crew' AND business_id IS NOT NULL AND business_id <> id)
  );

-- ====================================================================
-- 2. team_invitations
-- ====================================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'crew',
  token       TEXT UNIQUE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

ALTER TABLE team_invitations
  ADD CONSTRAINT team_invitations_role_check CHECK (role = 'crew'),
  ADD CONSTRAINT team_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 3. RLS — drop old single-user policies, create business-scoped ones
-- ====================================================================

-- SECURITY DEFINER avoids recursive profiles RLS lookups from policies.
CREATE OR REPLACE FUNCTION current_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(business_id, id)
  FROM profiles
  WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION current_business_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_business_id() TO authenticated;

-- Profiles: members can read everyone in their business.
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Profiles: read own and business owner" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR id = current_business_id()
    OR business_id = current_business_id()
  );

CREATE POLICY "Profiles: update own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Membership is managed by trusted invitation/admin flows, not profile edits.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (business_name, phone, avatar_url) ON profiles TO authenticated;

-- Clients: owner full CRUD, crew SELECT only
DROP POLICY IF EXISTS "Users can CRUD own clients" ON clients;

CREATE POLICY "Clients: owner full access" ON clients
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  );

CREATE POLICY "Clients: crew read access" ON clients
  FOR SELECT USING (
    user_id = current_business_id()
    AND auth.uid() <> current_business_id()
  );

-- Jobs: owner full access, crew can read/write own assigned jobs
DROP POLICY IF EXISTS "Users can CRUD own jobs" ON jobs;

CREATE POLICY "Jobs: owner full access" ON jobs
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  );

CREATE POLICY "Jobs: crew read assigned" ON jobs
  FOR SELECT USING (
    auth.uid() = assigned_to
  );

CREATE POLICY "Jobs: crew update assigned" ON jobs
  FOR UPDATE
  USING (
    auth.uid() <> current_business_id()
    AND user_id = current_business_id()
    AND auth.uid() = assigned_to
  )
  WITH CHECK (
    auth.uid() <> current_business_id()
    AND user_id = current_business_id()
    AND auth.uid() = assigned_to
  );

-- Invoices: owner only (crew has no invoice access)
DROP POLICY IF EXISTS "Users can CRUD own invoices" ON invoices;

CREATE POLICY "Invoices: owner only" ON invoices
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = current_business_id()
  );

-- team_invitations: owner manages their own
CREATE POLICY "Invitations: owner CRUD own" ON team_invitations
  FOR ALL
  USING (
    auth.uid() = business_id
    AND auth.uid() = current_business_id()
  )
  WITH CHECK (
    auth.uid() = business_id
    AND auth.uid() = current_business_id()
  );
