require('dotenv').config();

// Import bcrypt directly to test
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function testLoginDirect() {
  const phone = '9999999998';
  const password = 'test123';
  
  console.log('Testing direct login for phone:', phone);
  
  const { data: rider, error } = await supabase
    .from('riders')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (error || !rider) {
    console.log('❌ Rider not found:', error);
    return;
  }
  
  console.log('✅ Rider found:', rider.name);
  console.log('Password hash:', rider.password_hash.substring(0, 30) + '...');
  
  const valid = await bcrypt.compare(password, rider.password_hash);
  console.log('Password valid:', valid);
  
  if (valid) {
    console.log('✅ LOGIN SHOULD WORK!');
  } else {
    console.log('❌ Password does not match');
  }
}

testLoginDirect().catch(console.error);
