const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listItems() {
  const { data, error } = await supabase.from('menu_items').select('*');
  if (error) {
    console.error('Error fetching menu items:', error);
  } else {
    console.log('Menu items count:', data.length);
    console.log(JSON.stringify(data.map(d => ({ id: d.id, name: d.name, price: d.price })), null, 2));
  }
}

listItems();
