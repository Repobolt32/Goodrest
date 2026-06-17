-- Add total_settled column to track cumulative settlement amounts
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS total_settled NUMERIC(10,2) DEFAULT 0;
