require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkOrders() {
  console.log('Checking Orders Table...');
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_name, order_status, tracking_url')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log('Recent Orders:', JSON.stringify(data, null, 2));
}

checkOrders();
