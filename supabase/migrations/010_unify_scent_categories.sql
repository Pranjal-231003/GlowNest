-- Unify candle scents (Rose, Lavender, Jasmine, Tea-Tree) across category & scent

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_product_scent_from_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.category IS NOT NULL THEN
    NEW.category := lower(btrim(NEW.category));
  END IF;
  NEW.scent := CASE NEW.category
    WHEN 'rose' THEN 'Rose'
    WHEN 'lavender' THEN 'Lavender'
    WHEN 'jasmine' THEN 'Jasmine'
    WHEN 'tea-tree' THEN 'Tea-Tree'
    ELSE NEW.scent
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_scent_from_category() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS products_sync_scent ON public.products;
CREATE TRIGGER products_sync_scent
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_scent_from_category();

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_scent_check;

UPDATE public.products
SET scent = CASE lower(btrim(category))
  WHEN 'rose' THEN 'Rose'
  WHEN 'lavender' THEN 'Lavender'
  WHEN 'jasmine' THEN 'Jasmine'
  WHEN 'tea-tree' THEN 'Tea-Tree'
  ELSE 'Rose'
END
WHERE scent IS DISTINCT FROM CASE lower(btrim(category))
  WHEN 'rose' THEN 'Rose'
  WHEN 'lavender' THEN 'Lavender'
  WHEN 'jasmine' THEN 'Jasmine'
  WHEN 'tea-tree' THEN 'Tea-Tree'
  ELSE 'Rose'
END;

ALTER TABLE public.products
  ADD CONSTRAINT products_scent_check
  CHECK (scent IN ('Rose', 'Lavender', 'Jasmine', 'Tea-Tree'));

COMMIT;
