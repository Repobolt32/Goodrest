-- DB-01: Enable RLS on orders table and add policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orders"
  ON public.orders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT
  USING (customer_phone = (auth.jwt() ->> 'phone'));

-- DB-02: Add indexes on offers table
CREATE INDEX IF NOT EXISTS idx_offers_active ON public.offers(active);
CREATE INDEX IF NOT EXISTS idx_offers_type ON public.offers(type);
CREATE INDEX IF NOT EXISTS idx_offers_time_window ON public.offers(start_time, end_time);

-- DB-03: Tighten RLS on riders table
DROP POLICY IF EXISTS "Allow public read for riders (MVP)" ON public.riders;
DROP POLICY IF EXISTS "Allow individual rider updates" ON public.riders;

CREATE POLICY "Service role read riders"
  ON public.riders FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role update riders"
  ON public.riders FOR UPDATE
  USING (auth.role() = 'service_role');

-- DB-04: Add updated_at trigger to offers table
DROP TRIGGER IF EXISTS update_offers_updated_at ON public.offers;
CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
