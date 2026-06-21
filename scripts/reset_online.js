const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.SUPABASE_DB_URL;
const client = new Client({ connectionString });

async function reset() {
  try {
    await client.connect();
    console.log('Resetting restaurant online_status to true...');
    await client.query('UPDATE public.restaurant_settings SET online_status = true WHERE id = 1');
    console.log('Successfully set restaurant to ONLINE.');
  } catch (err) {
    console.error('Failed to reset restaurant status:', err);
  } finally {
    await client.end();
  }
}

reset();
