-- Allow authenticated customers to read only their own orders/items via RLS
-- and switch get_my_orders() to SECURITY INVOKER (writes remain service_role only).

CREATE POLICY orders_select_own_or_admin ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY order_items_select_own_or_admin ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  );

GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

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
