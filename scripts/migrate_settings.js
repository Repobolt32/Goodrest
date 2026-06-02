const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.SUPABASE_DB_URL;

const client = new Client({
  connectionString: connectionString,
});

const sql = `
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    max_delivery_radius NUMERIC DEFAULT 10,
    delivery_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.app_settings (id, max_delivery_radius, delivery_enabled)
VALUES ('global', 10, true) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role (and for now all) access since we use service role key on server
-- In a real app, you'd restrict this more tightly
DROP POLICY IF EXISTS "Allow all access" ON public.app_settings;
CREATE POLICY "Allow all access" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
`;

async function migrate() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Running DDL...');
    await client.query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
