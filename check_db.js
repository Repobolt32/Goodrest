const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('Checking Supabase...');
  const { data, error } = await supabase.from('menu_items').select('name, category, category_id').limit(10);
  if (error) {
    console.error('Error fetching menu_items:', error);
  } else {
    console.log('Menu Items Sample:', JSON.stringify(data, null, 2));
  }

  const { data: catData, error: catError } = await supabase.from('categories').select('*');
  if (catError) {
    console.error('Error fetching categories:', catError);
  } else {
    console.log('Categories:', JSON.stringify(catData, null, 2));
  }
}

checkData();
