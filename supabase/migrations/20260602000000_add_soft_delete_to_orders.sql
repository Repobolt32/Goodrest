ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at);

COMMENT ON COLUMN public.orders.deleted_at IS 'Soft delete marker. When set, the order is considered deleted but retained for audit.';
