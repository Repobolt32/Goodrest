-- Add distance, earning, and start-riding timestamp to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rider_earning NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rider_started_at TIMESTAMPTZ;

-- Add lifetime stats to riders
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0;

-- Atomic deliver_order RPC: updates order status AND rider stats in one transaction
CREATE OR REPLACE FUNCTION public.deliver_order(
  p_order_id UUID,
  p_rider_id UUID,
  p_rider_earning NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update order status (must be out_for_delivery and belong to rider)
  UPDATE public.orders
  SET order_status = 'delivered',
      delivered_at = NOW()
  WHERE id = p_order_id
    AND rider_id = p_rider_id
    AND order_status = 'out_for_delivery';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not eligible for delivery';
  END IF;

  -- Increment rider stats atomically
  UPDATE public.riders
  SET total_deliveries = total_deliveries + 1,
      total_earnings = total_earnings + p_rider_earning
  WHERE id = p_rider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider not found';
  END IF;
END;
$$;
