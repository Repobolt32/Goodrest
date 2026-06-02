-- Migration: Finalize Rider Routing Schema
-- Purpose: Support phone-based dispatching and navigation links

-- Add rider_phone to batches if it doesn't exist
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS rider_phone TEXT;

-- Remove legacy rider_name column
ALTER TABLE public.batches DROP COLUMN IF EXISTS rider_name;

-- Ensure status has a default
ALTER TABLE public.batches ALTER COLUMN status SET DEFAULT 'pending';

-- Add tracking_url explicitly if missing
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS tracking_url TEXT;
