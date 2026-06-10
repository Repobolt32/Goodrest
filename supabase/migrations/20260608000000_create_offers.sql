CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('discount_percent', 'free_delivery')),
  label TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_time_window CHECK (
    start_time IS NULL OR end_time IS NULL OR start_time < end_time
  )
);

-- Audit columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_offers JSONB;

-- RLS: admin can do everything, anon can read active offers
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on offers"
  ON public.offers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read active offers"
  ON public.offers FOR SELECT
  USING (active = true);
