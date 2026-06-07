// check-rider-hash.mjs — Fetch actual password_hash from Supabase
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file manually
const env = readFileSync('.env', 'utf8');
const envVars = {};
for (const line of env.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from('riders')
  .select('phone, password_hash, name')
  .eq('phone', '9999999999')
  .single();

if (error) {
  console.error('Supabase error:', error);
  process.exit(1);
}

console.log('Rider found:', data?.name);
console.log('Phone:', data?.phone);
console.log('Password hash:', data?.password_hash);
console.log('Hash prefix:', data?.password_hash?.substring(0, 4));
