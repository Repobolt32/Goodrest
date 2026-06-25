import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRiders() {
  console.log('Connecting to Supabase...');
  const { data: riders, error } = await supabase
    .from('riders')
    .select('id, name, phone, is_active, password_hash');
  
  if (error) {
    console.error('Error fetching riders:', error);
  } else {
    console.log('Riders found in DB:', riders);
  }
}

checkRiders();
