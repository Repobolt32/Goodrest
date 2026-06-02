const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
});

async function migrate() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    
    const migrationPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '20260527_add_refund_status.sql');
    console.log('Reading migration file:', migrationPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running DDL:\n', sql);
    await client.query(sql);
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
