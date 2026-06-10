import { describe, it, expect } from 'vitest';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const isDBConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project') &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key');

describe.skipIf(!isDBConfigured)('BUG-17: Offers table exists', () => {
  it('offers table should exist in database', async () => {
    // Try to query the offers table
    const { data, error } = await supabaseAdmin
      .from('offers')
      .select('id')
      .limit(1);

    // Table should exist - if it doesn't, we get a specific error
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('offers table should have required columns', async () => {
    // Query specific columns that the migration creates
    const { data, error } = await supabaseAdmin
      .from('offers')
      .select('id, type, label, config, active, start_time, end_time, created_at, updated_at')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('orders table should have discount_amount column', async () => {
    // The migration also adds columns to orders table
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('discount_amount, delivery_fee, applied_offers')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
