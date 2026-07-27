-- Restore authenticated iOS clients' ability to save their Stripe customer ID.
GRANT UPDATE (stripe_customer_id) ON profiles TO authenticated;
