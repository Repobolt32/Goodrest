-- Add refund_status column for owner-managed refund tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'pending';

-- Backfill: set all existing cancelled orders to 'pending'
UPDATE orders SET refund_status = 'pending' WHERE order_status = 'cancelled' AND refund_status IS NULL;
