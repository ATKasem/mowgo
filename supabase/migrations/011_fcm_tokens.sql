-- Migration 011: FCM push tokens for Android
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_platform TEXT;
COMMENT ON COLUMN profiles.fcm_token IS 'FCM registration token for Android push delivery.';
COMMENT ON COLUMN profiles.device_platform IS 'android | ios — which push channel the device token belongs to.';
GRANT UPDATE (fcm_token, device_platform) ON profiles TO authenticated;
