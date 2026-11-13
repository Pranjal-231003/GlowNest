-- GlowNest Studio Owner Admin Portal:
-- 1) Optional product photos (image_url) + updated_at tracking + newest-first index
-- 2) Order fulfillment status & tracking notes (column-scoped admin update)
-- 3) Public Storage bucket (candle-images) with admin-only write RLS

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_products_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_products_updated_at();

REVOKE ALL ON FUNCTION public.set_products_updated_at() FROM PUBLIC, anon;

CREATE INDEX IF NOT EXISTS products_active_created_at_idx
  ON public.products (active, created_at DESC, id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled', 'packed', 'shipped', 'delivered')),
  ADD COLUMN IF NOT EXISTS tracking_note text;

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM PUBLIC, anon, authenticated;
GRANT UPDATE (fulfillment_status, tracking_note) ON public.orders TO authenticated;

DROP POLICY IF EXISTS orders_admin_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.get_my_orders()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
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
          'fulfillment_status', o.fulfillment_status,
          'tracking_note', o.tracking_note,
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candle-images',
  'candle-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS candle_images_admin_select ON storage.objects;
CREATE POLICY candle_images_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'candle-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS candle_images_admin_insert ON storage.objects;
CREATE POLICY candle_images_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'candle-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS candle_images_admin_update ON storage.objects;
CREATE POLICY candle_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'candle-images' AND (SELECT public.is_admin()))
  WITH CHECK (bucket_id = 'candle-images' AND (SELECT public.is_admin()));

DROP POLICY IF EXISTS candle_images_admin_delete ON storage.objects;
CREATE POLICY candle_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'candle-images' AND (SELECT public.is_admin()));
