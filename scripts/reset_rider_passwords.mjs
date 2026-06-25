import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPasswords() {
  console.log('Resetting rider passwords to "test123"...');
  // Hash for 'test123'
  const targetHash = '$2b$10$g8IzMMVc3.DJR6zKavgjMe2ejTXiOzPXkVOkIicGEt.VEkNwJH9/S';

  const { data: updated1, error: error1 } = await supabase
    .from('riders')
    .update({ password_hash: targetHash })
    .eq('phone', '9999999999')
    .select();

  const { data: updated2, error: error2 } = await supabase
    .from('riders')
    .update({ password_hash: targetHash })
    .eq('phone', '1122334455')
    .select();

  const { data: updated3, error: error3 } = await supabase
    .from('riders')
    .update({ password_hash: targetHash })
    .eq('phone', '1234567890')
    .select();

  if (error1 || error2 || error3) {
    console.error('Errors occurred during update:', { error1, error2, error3 });
  } else {
    console.log('Successfully updated riders:', {
      '9999999999': updated1?.map(r => r.name),
      '1122334455': updated2?.map(r => r.name),
      '1234567890': updated3?.map(r => r.name)
    });
  }
}

resetPasswords();
