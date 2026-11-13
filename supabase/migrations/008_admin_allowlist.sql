-- Allowlist table (private schema) + verified trigger to auto-promote designated owner emails on first sign-in.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.admin_allowed_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.admin_allowed_emails FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_admin_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM private.admin_allowed_emails e
       WHERE lower(e.email) = lower(COALESCE(NEW.email, ''))
     ) THEN
    INSERT INTO public.admin_users (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_admin_allowlist() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_admin_allowlist ON auth.users;
CREATE TRIGGER on_auth_user_admin_allowlist
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_allowlist();
