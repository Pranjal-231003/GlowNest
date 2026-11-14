-- Customer ratings and reviews for candles + homepage highlights

BEGIN;

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text NOT NULL,
  verified_purchase boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_product_id_idx
  ON public.reviews (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_homepage_idx
  ON public.reviews (approved, rating DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_review_verified_purchase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    NEW.verified_purchase := EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.user_id = NEW.user_id
        AND oi.product_id = NEW.product_id
        AND o.status = 'paid'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_review_verified_purchase() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS reviews_set_verified_purchase ON public.reviews;
CREATE TRIGGER reviews_set_verified_purchase
  BEFORE INSERT OR UPDATE OF user_id, product_id ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.check_review_verified_purchase();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_anon_read ON public.reviews;
CREATE POLICY reviews_anon_read ON public.reviews
  FOR SELECT TO anon
  USING (approved = true);

DROP POLICY IF EXISTS reviews_authenticated_read ON public.reviews;
CREATE POLICY reviews_authenticated_read ON public.reviews
  FOR SELECT TO authenticated
  USING (approved = true OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS reviews_anon_insert ON public.reviews;
CREATE POLICY reviews_anon_insert ON public.reviews
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND rating >= 1 AND rating <= 5
    AND length(btrim(customer_name)) > 0
    AND length(btrim(comment)) > 0
  );

DROP POLICY IF EXISTS reviews_authenticated_insert ON public.reviews;
CREATE POLICY reviews_authenticated_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id = (SELECT auth.uid()))
    AND rating >= 1 AND rating <= 5
    AND length(btrim(customer_name)) > 0
    AND length(btrim(comment)) > 0
  );

DROP POLICY IF EXISTS reviews_admin_update ON public.reviews;
CREATE POLICY reviews_admin_update ON public.reviews
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS reviews_admin_delete ON public.reviews;
CREATE POLICY reviews_admin_delete ON public.reviews
  FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT ON public.reviews TO anon, authenticated;
GRANT UPDATE, DELETE ON public.reviews TO authenticated;

-- Seed initial reviews for existing candles
INSERT INTO public.reviews (product_id, customer_name, rating, title, comment, verified_purchase, approved, created_at)
VALUES
  ('gn-04', 'Ananya R.', 5, 'Smells exactly like it looks', 'The Rose candle fills the room softly without feeling heavy. The honey and floral notes are perfectly balanced — genuinely the nicest gift I have given this year.', true, true, now() - interval '6 days'),
  ('gn-09', 'Karan M.', 5, 'Evening ritual favourite', 'Burns evenly all the way down, which is rare for artisanal candles. The Lavender notes are calm and herbal, not sugary. Has become my go-to for winding down at night.', true, true, now() - interval '4 days'),
  ('gn-01', 'Priya S.', 5, 'Clean, crisp and refreshing', 'Loved how fresh and botanical the Tea-Tree pour is. Refreshing without being overpoweringly medicinal. Perfect for daytime focus in my small studio.', true, true, now() - interval '2 days'),
  ('gn-07', 'Devansh K.', 5, 'Quiet, elegant jasmine', 'The Jasmine aroma is delicate, creamy, and gently sweet. Burns clean with almost zero soot. Will definitely order the refill.', true, true, now() - interval '1 day')
ON CONFLICT DO NOTHING;

COMMIT;
