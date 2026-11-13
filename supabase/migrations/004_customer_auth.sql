-- GlowNest customer accounts, profiles, and customer-order linking

CREATE TABLE public.customers (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_customers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_customers_updated_at();

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
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone)), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_customer();

CREATE OR REPLACE FUNCTION public.sync_customer_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.customers
    SET email = COALESCE(NEW.email, '')
    WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_customer_email();

-- Backfill if any auth users already exist
INSERT INTO public.customers (id, email, full_name, phone)
SELECT
  id,
  COALESCE(email, ''),
  NULLIF(btrim(raw_user_meta_data ->> 'full_name'), ''),
  NULLIF(btrim(COALESCE(raw_user_meta_data ->> 'phone', phone)), '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Link orders to customer accounts while retaining studio records if an account is deleted
ALTER TABLE public.orders
  ADD COLUMN user_id uuid REFERENCES public.customers (id) ON DELETE SET NULL;

CREATE INDEX orders_user_id_created_at_idx ON public.orders (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_my_orders()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN '[]'::jsonb
    ELSE COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'access_token', o.access_token,
          'status', o.status,
          'total_paise', o.total_paise,
          'customer_name', o.customer_name,
          'email', o.email,
          'phone', o.phone,
          'address_line1', o.address_line1,
          'address_line2', o.address_line2,
          'city', o.city,
          'state', o.state,
          'pincode', o.pincode,
          'created_at', o.created_at,
          'items', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'product_id', i.product_id,
                'name', i.product_name,
                'qty', i.qty,
                'unit_price', i.unit_price
              )
              ORDER BY i.product_name
            )
            FROM public.order_items i
            WHERE i.order_id = o.id
          ), '[]'::jsonb)
        )
        ORDER BY o.created_at DESC
      )
      FROM public.orders o
      WHERE o.user_id = (SELECT auth.uid())
    ), '[]'::jsonb)
  END;
$$;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_select_own_or_admin ON public.customers
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY customers_insert_own ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY customers_update_own ON public.customers
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

REVOKE ALL ON public.customers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

REVOKE ALL ON FUNCTION public.set_customers_updated_at() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_customer() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_customer_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_orders() TO service_role;
