const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addShahiPaneer() {
  const { error } = await supabase.from('menu_items').insert({
    id: 'shahi-paneer',
    name: 'Shahi Paneer',
    price: 320,
    category: 'Main Course',
    category_id: 'main-course',
    image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=60',
    tags: ['Best Seller', 'Vegetarian'],
    is_available: true
  });

  if (error) {
    console.error('Error adding Shahi Paneer:', error);
  } else {
    console.log('✅ Shahi Paneer added successfully!');
  }
}

addShahiPaneer();
