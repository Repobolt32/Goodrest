const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimes() {
  const { data, error } = await supabase.rpc('get_server_time').select();
  
  // If no RPC, let's do a raw query or try selecting from a table
  const { data: rawData, error: rawError } = await supabase
    .from('orders')
    .select('created_at')
    .limit(1);

  const localTime = new Date().toISOString();
  console.log('Local Node Time:', localTime);
  
  // Let's run a select query to get postgres time
  const { data: dbTimeData, error: dbTimeErr } = await supabase
    .from('restaurant_settings')
    .select('updated_at')
    .eq('id', 1)
    .single();

  // We can also update a dummy setting and read its updated_at to get DB time
  const nowStr = new Date().toISOString();
  console.log('Local Node Time ISO:', nowStr);
  
  const { data: tempOrder, error: tempErr } = await supabase
    .from('orders')
    .insert({
      customer_name: 'Time Check',
      customer_phone: '9999999999',
      delivery_address: 'Time Street',
      payment_method: 'cod',
      total_amount: 10
    })
    .select('created_at')
    .single();

  if (tempErr) {
    console.error('Error inserting temp order:', tempErr);
  } else {
    console.log('Database Server Time (created_at):', tempOrder.created_at);
    // Cleanup
    await supabase.from('orders').delete().eq('id', tempOrder.id);
  }
}

checkTimes();
