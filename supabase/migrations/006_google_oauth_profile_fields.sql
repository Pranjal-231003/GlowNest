-- Support Google OAuth user metadata ('name' fallback when 'full_name' is absent)
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.customers (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), '')
    ),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone)), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_customer() FROM PUBLIC, anon, authenticated;

-- Backfill any existing auth.users whose Google metadata only set 'name'
INSERT INTO public.customers (id, email, full_name, phone)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(
    NULLIF(btrim(raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(raw_user_meta_data ->> 'name'), '')
  ),
  NULLIF(btrim(COALESCE(raw_user_meta_data ->> 'phone', phone)), '')
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(public.customers.full_name, EXCLUDED.full_name)
  WHERE public.customers.full_name IS NULL AND EXCLUDED.full_name IS NOT NULL;
