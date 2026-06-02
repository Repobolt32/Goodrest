-- Add columns for customer cancel and help features
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_help_message TEXT DEFAULT NULL;
