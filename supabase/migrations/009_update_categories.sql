-- Update GlowNest candle categories to: rose, lavender, jasmine, tea-tree

BEGIN;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

UPDATE public.products
SET category = CASE id
  WHEN 'gn-01' THEN 'tea-tree'
  WHEN 'gn-03' THEN 'tea-tree'
  WHEN 'gn-04' THEN 'rose'
  WHEN 'gn-05' THEN 'lavender'
  WHEN 'gn-06' THEN 'rose'
  WHEN 'gn-07' THEN 'jasmine'
  WHEN 'gn-09' THEN 'lavender'
  ELSE CASE category
    WHEN 'floral' THEN 'rose'
    WHEN 'dessert' THEN 'lavender'
    WHEN 'classic' THEN 'jasmine'
    ELSE 'tea-tree'
  END
END
WHERE category IS DISTINCT FROM CASE id
  WHEN 'gn-01' THEN 'tea-tree'
  WHEN 'gn-03' THEN 'tea-tree'
  WHEN 'gn-04' THEN 'rose'
  WHEN 'gn-05' THEN 'lavender'
  WHEN 'gn-06' THEN 'rose'
  WHEN 'gn-07' THEN 'jasmine'
  WHEN 'gn-09' THEN 'lavender'
  ELSE CASE category
    WHEN 'floral' THEN 'rose'
    WHEN 'dessert' THEN 'lavender'
    WHEN 'classic' THEN 'jasmine'
    ELSE 'tea-tree'
  END
END;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('rose', 'lavender', 'jasmine', 'tea-tree'));

COMMIT;
