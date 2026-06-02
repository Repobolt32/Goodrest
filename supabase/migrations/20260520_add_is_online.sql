-- Add is_online column to riders table
-- Persisted so rider online status survives page reloads
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
