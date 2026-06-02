-- Create riders table
CREATE TABLE IF NOT EXISTS public.riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    current_location JSONB DEFAULT '{"lat": 0, "lng": 0}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create rider_locations table for real-time history/breadcrumbs
CREATE TABLE IF NOT EXISTS public.rider_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES public.riders(id) ON DELETE CASCADE,
    location JSONB NOT NULL, -- {"lat": 1.23, "lng": 4.56}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Update orders table for rider assignment
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.riders(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_coordinates JSONB; -- Target destination coords

-- RLS Policies for riders
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for riders (MVP)" ON public.riders
    FOR SELECT USING (true);

CREATE POLICY "Allow individual rider updates" ON public.riders
    FOR UPDATE USING (true); -- In a real app, this would be authenticated

-- RLS Policies for rider_locations
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insertion for locations" ON public.rider_locations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read for locations" ON public.rider_locations
    FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_riders_phone ON public.riders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider_id ON public.rider_locations(rider_id);
