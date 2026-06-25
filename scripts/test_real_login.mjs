import { loginRider } from '../src/app/actions/riderActions.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  console.log('--- STANDALONE NODE LOGIN TEST ---');
  try {
    const res = await loginRider('1122334455', 'test123');
    console.log('Result:', res);
  } catch (e) {
    console.error('Unhandled exception:', e);
  }
}

run();
