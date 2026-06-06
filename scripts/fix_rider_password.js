require('dotenv').config();

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function fixRiderPassword() {
  const phone = '9999999999';
  const newPassword = 'test123';
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  const { data, error } = await supabase
    .from('riders')
    .update({ password_hash: passwordHash })
    .eq('phone', phone);
  
  if (error) {
    console.error('❌ Error updating rider:', error);
    return;
  }
  
  console.log('✅ Fixed rider', phone, '- password is now "test123"');
}

fixRiderPassword().catch(console.error);
