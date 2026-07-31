-- Add tags column to clients table for customer flagging
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
