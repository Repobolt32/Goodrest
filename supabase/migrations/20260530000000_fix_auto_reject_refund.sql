-- Fix Auto-Reject Cron to avoid marking paid orders as failed/refunded without calling Razorpay
-- Paid orders will now be marked as 'requires_refund' so owners can manually process them.

CREATE OR REPLACE FUNCTION public.auto_reject_expired_orders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _auto_reject_minutes INTEGER;
BEGIN
  SELECT auto_reject_minutes INTO _auto_reject_minutes
  FROM public.restaurant_settings WHERE id = 1;
  
  IF _auto_reject_minutes IS NULL THEN 
    _auto_reject_minutes := 5; 
  END IF;

  UPDATE public.orders
  SET order_status = 'cancelled',
      cancelled_by = 'auto',
      payment_status = CASE
        WHEN payment_status = 'paid' THEN 'requires_refund'
        ELSE 'failed'
      END
  WHERE order_status = 'confirmed'
    AND created_at < (now() - (_auto_reject_minutes || ' minutes')::INTERVAL);
END;
$$;
