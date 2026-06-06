const { Client } = require('pg');
require('dotenv').config();

async function checkRealtime() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('No SUPABASE_DB_URL found in env');
    return;
  }
  
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime';
    `);
    console.log('Tables in supabase_realtime publication:', res.rows);
  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    await client.end();
  }
}

checkRealtime();
