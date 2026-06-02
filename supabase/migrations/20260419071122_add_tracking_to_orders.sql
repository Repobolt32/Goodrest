-- Migration: Add tracking_url and rider_phone to orders
-- Purpose: Support direct delivery tracking from the order status page

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_phone TEXT;
