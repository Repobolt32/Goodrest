-- Migration: Add total_settled column and increment_rider_settlement RPC

-- 1. Ensure total_settled column exists on riders
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS total_settled NUMERIC(10,2) DEFAULT 0;

-- 2. Define the increment_rider_settlement RPC
CREATE OR REPLACE FUNCTION public.increment_rider_settlement(
  p_rider_id UUID,
  p_amount NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.riders
  SET total_settled = COALESCE(total_settled, 0) + p_amount
  WHERE id = p_rider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider not found';
  END IF;
END;
$$;
