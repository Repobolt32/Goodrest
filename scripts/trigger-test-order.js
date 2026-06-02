const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in your .env file!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerTestOrder() {
  console.log('🚀 Connecting to Supabase and preparing to trigger test order...');
  
  // Generate a random phone number and name for the test customer
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const testOrder = {
    customer_name: `Test Customer #${randomId}`,
    customer_phone: `+91998877${randomId}`,
    delivery_address: 'Flat 402, Antigravity Heights, Sector-V, Bengaluru, Karnataka 560001',
    total_amount: 680,
    payment_method: 'online',
    payment_status: 'captured',
    order_status: 'confirmed',
    items: [
      { name: 'Butter Chicken', quantity: 1, price: 380 },
      { name: 'Butter Naan', quantity: 3, price: 60 },
      { name: 'Mango Lassi', quantity: 2, price: 60 }
    ],
    // Place this coordinate around Bangalore/center
    lat: 12.9715987,
    lng: 77.5945627
  };

  console.log('📦 Test Order Data:', JSON.stringify(testOrder, null, 2));

  const { data, error } = await supabase
    .from('orders')
    .insert(testOrder)
    .select();

  if (error) {
    console.error('❌ Error inserting test order:', error);
  } else {
    console.log('\n======================================================');
    console.log('✅ TEST ORDER TRIGGERED SUCCESSFULLY!');
    console.log(`🆔 Order ID: ${data[0].id}`);
    console.log(`👤 Customer: ${data[0].customer_name}`);
    console.log(`💰 Total: INR ${data[0].total_amount}`);
    console.log('======================================================');
    console.log('\nIf your Electron app is running and your owner dashboard page');
    console.log('is open, you should now:');
    console.log('1. Hear a dual-tone beep sound playing repeatedly every 2 seconds.');
    console.log('2. See a custom "New Order" bell window pop up in the bottom-right of your screen.');
    console.log('3. See an OS notification slide out.');
    console.log('4. See the "Accept Order" button.');
  }
}

triggerTestOrder();
