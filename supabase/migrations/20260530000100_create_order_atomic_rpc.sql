-- PgSQL Stored Procedure to insert order and order items atomically
-- Ensures that if any item insert fails (e.g. invalid type or database constraint), 
-- the entire transaction is rolled back and no ghost order is left in public.orders.

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order JSONB,
  p_items JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO public.orders (
    customer_name, customer_phone, delivery_address, items,
    total_amount, payment_method, payment_status, order_status, lat, lng
  )
  SELECT
    p_order->>'customer_name', p_order->>'customer_phone',
    p_order->>'delivery_address', (p_order->'items')::jsonb,
    (p_order->>'total_amount')::numeric, p_order->>'payment_method',
    p_order->>'payment_status', p_order->>'order_status',
    (p_order->>'lat')::float, (p_order->>'lng')::float
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, menu_item_id, price_at_order, quantity)
  SELECT v_order_id, 
         CASE 
           -- Check if menu_item_id exists and is a valid UUID
           WHEN (item->>'menu_item_id') IS NOT NULL AND (item->>'menu_item_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
           THEN (item->>'menu_item_id')::uuid
           ELSE NULL
         END,
         (item->>'price_at_order')::numeric, 
         (item->>'quantity')::int
  FROM jsonb_array_elements(p_items) AS item;

  RETURN v_order_id;
END;
$$;
