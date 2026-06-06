const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runTest() {
  // Get latest order
  const { data: latestOrder, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('id, order_status')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr || !latestOrder) {
    console.error('Error fetching latest order:', fetchErr);
    process.exit(1);
  }

  console.log(`Latest order ID: ${latestOrder.id}, status: ${latestOrder.order_status}`);

  console.log('Connecting to Realtime...');
  let eventReceived = false;
  const channel = supabase
    .channel('test-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => {
        console.log('SUCCESS: Received Postgres Change:', payload);
        eventReceived = true;
      }
    )
    .subscribe(async (status) => {
      console.log('Subscription Status Changed:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed successfully! Waiting 3 seconds before triggering update...');
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('Triggering update...');
        const newStatus = latestOrder.order_status === 'confirmed' ? 'preparing' : 'confirmed';
        const { error: updateErr } = await supabaseAdmin
          .from('orders')
          .update({ order_status: newStatus })
          .eq('id', latestOrder.id);
          
        if (updateErr) {
          console.error('Error updating order:', updateErr);
        } else {
          console.log(`Order status updated to ${newStatus}. Waiting for realtime event...`);
        }
      }
    });

  setTimeout(() => {
    console.log(`Exiting. Event received: ${eventReceived}`);
    supabase.removeChannel(channel);
    process.exit(eventReceived ? 0 : 1);
  }, 10000);
}

runTest();
