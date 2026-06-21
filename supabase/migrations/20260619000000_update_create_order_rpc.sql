-- Update create_order_with_items function to store all relevant metadata columns:
-- distance_km, duration_seconds, discount_amount, delivery_fee, applied_offers.

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order JSONB,
  p_items JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO public.orders (
    customer_name, customer_phone, delivery_address, items,
    total_amount, payment_method, payment_status, order_status, lat, lng,
    distance_km, duration_seconds, discount_amount, delivery_fee, applied_offers
  )
  SELECT
    p_order->>'customer_name', p_order->>'customer_phone',
    p_order->>'delivery_address', (p_order->'items')::jsonb,
    (p_order->>'total_amount')::numeric, p_order->>'payment_method',
    p_order->>'payment_status', p_order->>'order_status',
    (p_order->>'lat')::float, (p_order->>'lng')::float,
    CASE 
      WHEN p_order->>'distance_km' IS NOT NULL THEN (p_order->>'distance_km')::numeric
      ELSE NULL
    END,
    CASE 
      WHEN p_order->>'duration_seconds' IS NOT NULL THEN (p_order->>'duration_seconds')::integer
      ELSE NULL
    END,
    CASE 
      WHEN p_order->>'discount_amount' IS NOT NULL THEN (p_order->>'discount_amount')::numeric
      ELSE 0
    END,
    CASE 
      WHEN p_order->>'delivery_fee' IS NOT NULL THEN (p_order->>'delivery_fee')::numeric
      ELSE 0
    END,
    CASE 
      WHEN p_order->'applied_offers' IS NOT NULL THEN (p_order->'applied_offers')::jsonb
      ELSE NULL
    END
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
