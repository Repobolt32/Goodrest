require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: orders, error } = await admin.from('orders')
    .select('id, order_status, rider_id, created_at, accepted_at, food_ready_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error(error); return; }

  const byStatus = {};
  for (const o of orders) {
    const s = o.order_status || 'null';
    if (!byStatus[s]) byStatus[s] = 0;
    byStatus[s]++;
  }
  console.log('Order status counts:', byStatus);
  console.log('\nLatest orders:');
  for (const o of orders) {
    console.log('  ' + o.id.slice(0,8) + ' | ' + o.order_status + ' | rider=' + (o.rider_id ? 'YES' : 'NULL'));
  }
}

main();
