const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bgwzvaprkorvfzxdigpj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnd3p2YXBya29ydmZ6eGRpZ3BqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE5NjQ1NywiZXhwIjoyMDkwNzcyNDU3fQ.10XK7K9OUx63PYHtaCB9tR2cb7dUyycJH6g4ARy9A2g';

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function checkRiders() {
  const { data, error } = await supabase.from('riders').select('*');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Riders found:', data.length);
  console.log(JSON.stringify(data, null, 2));
}

checkRiders();
