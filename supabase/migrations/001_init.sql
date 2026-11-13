-- GlowNest catalogue, inventory, orders, admin RLS

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('floral', 'dessert', 'classic')),
  price integer NOT NULL CHECK (price > 0),
  tag text,
  wax text NOT NULL DEFAULT '#a9793a',
  scent text NOT NULL,
  burn text NOT NULL,
  "desc" text NOT NULL,
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'failed', 'cancelled')),
  total_paise integer NOT NULL CHECK (total_paise > 0),
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX orders_access_token_idx ON public.orders (access_token);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products (id),
  product_name text NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price integer NOT NULL CHECK (unit_price > 0)
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX order_items_product_id_idx ON public.order_items (product_id);

INSERT INTO public.products (id, name, category, price, tag, wax, scent, burn, "desc", stock_qty, active) VALUES
  ('gn-01', 'Green Garden', 'floral', 899, 'New', '#8fae7c', 'Eucalyptus, fresh mint, white musk', '38–42 hrs',
   'A jar candle topped with a hand-pressed floral disc, poured in our signature soft-green wax. Inspired by early mornings in the garden, before the heat sets in.', 24, true),
  ('gn-02', 'Mint Ice', 'floral', 749, NULL, '#bcdcc6', 'Spearmint, cucumber, pear', '30–34 hrs',
   'Cool and green, poured to look like a glass full of mint ice. Light, refreshing, best for daytime spaces that need a lift.', 24, true),
  ('gn-03', 'Wild Rosemary', 'floral', 849, NULL, '#7f9b6a', 'Rosemary, sage, cedar leaf', '36–40 hrs',
   'An herbal, slightly woody floral candle for people who find flowers too sweet. Rosemary sprigs pressed into the top layer.', 24, true),
  ('gn-04', 'Honey Fig Tart', 'dessert', 799, 'Bestseller', '#c9a26a', 'Fig, brown butter, honey', '34–38 hrs',
   'Layered wax made to look like a baked tart, finished with a honey drizzle detail. Warm and a little indulgent — our most gifted candle.', 24, true),
  ('gn-05', 'Vanilla Bean Swirl', 'dessert', 749, NULL, '#e8d9b8', 'Madagascar vanilla, cream, tonka', '32–36 hrs',
   'A soft swirl finish on top, poured slow so every layer sets evenly. Vanilla done properly — not sugary, just warm.', 24, true),
  ('gn-06', 'Salted Caramel Pot', 'dessert', 899, NULL, '#a9793a', 'Caramel, sea salt, smoked vanilla', '40–44 hrs',
   'Deep amber wax in a stoneware-style pot, finished with a scatter of coarse salt on top. Cozy without being cloying.', 24, true),
  ('gn-07', 'The Classic', 'classic', 649, NULL, '#f6f1e6', 'White tea, linen, soft musk', '44–48 hrs',
   'Our everyday jar candle — unscented-leaning, quiet, and reliable. The one to keep by the door or on a work desk.', 24, true),
  ('gn-08', 'Wood & Ash', 'classic', 899, NULL, '#5c6b52', 'Cedarwood, smoked oud, moss', '42–46 hrs',
   'Deep, grounding, and slow-burning. Made for evenings, built to fill a whole room without overwhelming it.', 24, true),
  ('gn-09', 'Morning Linen', 'classic', 699, NULL, '#dbe4d6', 'Cotton, bergamot, white sage', '36–40 hrs',
   'Clean and soft, close to the smell of air-dried sheets. A quiet classic that works in every room of the house.', 24, true);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order_id uuid, p_payment_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.orders%ROWTYPE;
  item record;
  updated integer;
BEGIN
  SELECT * INTO r FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF r.status = 'paid' THEN
    RETURN;
  END IF;
  IF r.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'order not payable';
  END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
      SET stock_qty = stock_qty - item.qty
      WHERE id = item.product_id
        AND stock_qty >= item.qty
        AND active = true;
    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated = 0 THEN
      RAISE EXCEPTION 'insufficient stock for %', item.product_id;
    END IF;
  END LOOP;

  UPDATE public.orders
    SET status = 'paid',
        razorpay_payment_id = p_payment_id
    WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_public(p_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
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
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'name', i.product_name,
        'qty', i.qty,
        'unit_price', i.unit_price
      ) ORDER BY i.product_name), '[]'::jsonb)
      FROM public.order_items i WHERE i.order_id = o.id
    )
  )
  INTO result
  FROM public.orders o
  WHERE o.id = p_id AND o.access_token = p_token;

  IF result IS NULL THEN
    RAISE EXCEPTION 'not found';
  END IF;
  RETURN result;
END;
$$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_self_read ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY products_anon_read ON public.products
  FOR SELECT TO anon
  USING (active = true);

CREATE POLICY products_authenticated_read ON public.products
  FOR SELECT TO authenticated
  USING (active = true OR (SELECT public.is_admin()));

CREATE POLICY products_admin_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY products_admin_update ON public.products
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY products_admin_delete ON public.products
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

-- orders / order_items: no direct client policies; Edge Functions use the service role.

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_order_public(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_public(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.fulfill_paid_order(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, text) TO service_role;

REVOKE ALL ON public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
