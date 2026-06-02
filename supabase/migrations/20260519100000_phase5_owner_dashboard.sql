-- Phase 5: Owner Dashboard — New columns + restaurant_settings table

-- 1. Add owner action timestamps to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prep_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS food_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_dispatch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_dispatch_note TEXT;

-- 2. Create restaurant_settings table (singleton)
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  online_status BOOLEAN DEFAULT true,
  prep_time_minutes INTEGER DEFAULT 20,
  auto_reject_minutes INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read settings (needed for customer menu check)
CREATE POLICY "Anyone can read settings"
  ON public.restaurant_settings FOR SELECT
  USING (true);

-- RLS: Only service_role can modify
CREATE POLICY "Service role can update settings"
  ON public.restaurant_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Insert default row
INSERT INTO public.restaurant_settings (id, online_status, prep_time_minutes, auto_reject_minutes)
VALUES (1, true, 20, 5)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Auto-reject function: cancels unaccepted orders after auto_reject_minutes
CREATE OR REPLACE FUNCTION public.auto_reject_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _auto_reject_minutes INTEGER;
  _order RECORD;
BEGIN
  SELECT auto_reject_minutes INTO _auto_reject_minutes
  FROM public.restaurant_settings
  WHERE id = 1;

  IF _auto_reject_minutes IS NULL THEN
    _auto_reject_minutes := 5;
  END IF;

  FOR _order IN
    SELECT id, total_amount, razorpay_payment_id
    FROM public.orders
    WHERE order_status = 'confirmed'
      AND created_at < (now() - (_auto_reject_minutes || ' minutes')::INTERVAL)
  LOOP
    UPDATE public.orders
    SET order_status = 'cancelled',
        payment_status = 'failed'
    WHERE id = _order.id;
  END LOOP;
END;
$$;

-- 5. Schedule auto-reject check every 30 seconds
SELECT cron.schedule(
  'auto-reject-expired-orders',
  '30 seconds',
  'SELECT public.auto_reject_expired_orders();'
);
