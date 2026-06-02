const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const imageMapping = {
  'paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=60',
  'chicken': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=60',
  'tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&auto=format&fit=crop&q=60',
  'naan': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=60',
  'rice': 'https://images.unsplash.com/photo-1512058560366-cd2427ff1644?w=800&auto=format&fit=crop&q=60',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=800&auto=format&fit=crop&q=60',
  'chai': 'https://images.unsplash.com/photo-1544787210-282aa3926887?w=800&auto=format&fit=crop&q=60',
  'gulab': 'https://images.unsplash.com/photo-1589119908995-c6837fa14848?w=800&auto=format&fit=crop&q=60',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=60',
  'butter': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&auto=format&fit=crop&q=60',
  'chinese': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&auto=format&fit=crop&q=60',
  'noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&auto=format&fit=crop&q=60'
};

const categoryDefaultImages = {
  'Starters': 'https://images.unsplash.com/photo-1541014741259-df529411b96a?w=800&auto=format&fit=crop&q=60',
  'Main Course': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&auto=format&fit=crop&q=60',
  'Breads': 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=800&auto=format&fit=crop&q=60',
  'Rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800&auto=format&fit=crop&q=60',
  'Beverages': 'https://images.unsplash.com/photo-1499638472904-ea5c6178a300?w=800&auto=format&fit=crop&q=60',
  'Desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=60'
};

async function seedImages() {
  console.log('🚀 Starting Image Seeding...');
  
  const { data: items, error } = await supabase
    .from('menu_items')
    .select('id, name, category');

  if (error) {
    console.error('Error fetching menu items:', error);
    return;
  }

  console.log(`Found ${items.length} items to update.`);

  for (const item of items) {
    let imageUrl = null;
    
    // Check keyword mapping
    const lowerName = item.name.toLowerCase();
    for (const [keyword, url] of Object.entries(imageMapping)) {
      if (lowerName.includes(keyword)) {
        imageUrl = url;
        break;
      }
    }

    // Fallback to category default
    if (!imageUrl) {
      imageUrl = categoryDefaultImages[item.category] || categoryDefaultImages['Main Course'];
    }

    console.log(`Updating ${item.name} (${item.category}) with image: ${imageUrl.substring(0, 50)}...`);

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ image_url: imageUrl })
      .eq('id', item.id);

    if (updateError) {
      console.error(`Failed to update ${item.name}:`, updateError);
    }
  }

  console.log('✅ Image Seeding Completed!');
}

seedImages();
