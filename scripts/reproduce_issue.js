require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function reproduceIssue() {
  console.log('=== Reproducing Rider Notification Issue ===\n');

  // Step 1: Find an order in 'preparing' status
  const { data: preparingOrders } = await supabaseAdmin
    .from('orders')
    .select('id, order_status, rider_id, customer_name')
    .eq('order_status', 'preparing')
    .is('rider_id', null)
    .limit(1);

  if (!preparingOrders || preparingOrders.length === 0) {
    console.log('No preparing orders found. Creating one...');
    // Use the order we just reverted
    const { data: createdOrder } = await supabaseAdmin
      .from('orders')
      .select('id, order_status, rider_id, customer_name')
      .eq('order_status', 'confirmed')
      .is('rider_id', null)
      .limit(1)
      .single();
    
    if (!createdOrder) {
      console.error('No confirmed orders either!');
      process.exit(1);
    }
    
    // Change it to preparing first
    await supabaseAdmin.from('orders').update({ order_status: 'preparing' }).eq('id', createdOrder.id);
    console.log(`Order ${createdOrder.id.slice(0,8)} set to preparing`);
    preparingOrders = [{ ...createdOrder, order_status: 'preparing' }];
  }

  const testOrder = preparingOrders[0];
  console.log(`Test order: ${testOrder.id.slice(0,8)} | status=${testOrder.order_status} | rider_id=${testOrder.rider_id || 'NULL'} | customer=${testOrder.customer_name}`);

  // Step 2: Simulate rider subscription (like OrderBroadcast.tsx does)
  console.log('\n[1] Setting up rider realtime subscription...');
  let eventReceived = false;
  let eventData = null;

  const channel = supabase
    .channel('reproduce_rider_broadcast')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const order = payload.new;
        console.log('\n[EVENT] Received UPDATE event for order', order.id.slice(0,8));
        console.log('  order_status:', order.order_status);
        console.log('  rider_id:', order.rider_id || 'NULL');

        // Apply the exact filter from the COMMITTED code (f98482f)
        if (order.rider_id === null && (order.order_status === 'preparing' || order.order_status === 'ready')) {
          console.log('  >>> FILTER MATCH (preparing || ready) <<< Rider WOULD be notified!');
          eventReceived = true;
          eventData = order;
        } else if (order.rider_id === null && order.order_status === 'ready') {
          console.log('  >>> FILTER MATCH (ready only) <<< Rider WOULD be notified!');
          eventReceived = true;
          eventData = order;
        } else {
          console.log('  >>> FILTER NO MATCH <<< Rider would NOT be notified');
        }
      }
    )
    .subscribe((status) => {
      console.log('  Subscription status:', status);
    });

  // Wait for subscription to establish
  console.log('[2] Waiting 3 seconds for subscription to establish...');
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Trigger markFoodReady (like owner does)
  console.log('\n[3] Transitioning order to "ready" (simulating owner clicking Food Ready)...');
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ order_status: 'ready', food_ready_at: new Date().toISOString() })
    .eq('id', testOrder.id)
    .eq('order_status', 'preparing')
    .select()
    .single();

  if (updateErr) {
    console.error('  ERROR updating order:', updateErr.message);
  } else if (!updated) {
    console.error('  Order not updated (may no longer be in preparing status)');
  } else {
    console.log(`  Order updated to ready successfully`);
  }

  // Step 4: Wait for realtime event
  console.log('\n[4] Waiting 5 seconds for realtime event...');
  await new Promise(r => setTimeout(r, 5000));

  // Results
  console.log('\n=== RESULT ===');
  if (eventReceived) {
    console.log('PASS: Realtime event WAS received - rider WOULD have been notified');
    console.log('Order:', eventData.id.slice(0,8), '| status:', eventData.order_status);
  } else {
    console.log('FAIL: Realtime event was NOT received - rider would NOT be notified');
    console.log('Root cause: Realtime subscription is not receiving events for this order');
  }

  supabase.removeChannel(channel);
  process.exit(eventReceived ? 0 : 1);
}

reproduceIssue().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
