-- DB Migration to address QOL-08, QOL-09, QOL-10, QOL-16, QOL-17, QOL-18

-- 1. Add missing indexes (QOL-08)
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 2. Alter refund_status default value to 'none' and update existing non-cancelled records (QOL-09)
ALTER TABLE public.orders ALTER COLUMN refund_status SET DEFAULT 'none';
UPDATE public.orders SET refund_status = 'none' WHERE refund_status = 'pending' AND (order_status IS NULL OR order_status != 'cancelled');

-- 3. Add foreign key from payments to orders (QOL-10)
-- If there are orphaned payments (pointing to invalid order_ids), set them to NULL first
UPDATE public.payments p
SET order_id = NULL
WHERE order_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.orders o WHERE o.id = p.order_id
);

ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS fk_payments_order_id;

ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_order_id 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) 
  ON DELETE SET NULL;

-- 4. Align rider_locations table structure (QOL-17)
-- Ensure lat and lng exist
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 6);
ALTER TABLE public.rider_locations ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 6);

-- 5. Add trigger for auto-updating updated_at on orders (QOL-18)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Remove duplicate category column from menu_items (QOL-16)
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS category;
