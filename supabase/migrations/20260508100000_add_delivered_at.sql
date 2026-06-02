-- Add missing delivered_at column to orders table
-- The deliver_order RPC (20260509_rider_refactor.sql) references this column
-- but it was never added to the table.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
