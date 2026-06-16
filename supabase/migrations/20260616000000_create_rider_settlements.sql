-- Create rider_settlements table
CREATE TABLE IF NOT EXISTS public.rider_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_settlements_rider_week
    ON public.rider_settlements(rider_id, week_start);

CREATE INDEX IF NOT EXISTS idx_rider_settlements_rider_id
    ON public.rider_settlements(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_settlements_week_start
    ON public.rider_settlements(week_start DESC);

ALTER TABLE public.rider_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for rider_settlements" ON public.rider_settlements
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for rider_settlements" ON public.rider_settlements
    FOR INSERT WITH CHECK (true);
