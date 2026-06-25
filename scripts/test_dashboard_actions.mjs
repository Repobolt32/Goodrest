import { getRiderStats, getRiderActiveOrder, getRider24HHistory, loginRider } from '../src/app/actions/riderActions.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testActions() {
  try {
    console.log('Logging in rider...');
    const loginRes = await loginRider('1122334455', 'password'); // Let's check with phone 1122334455
    console.log('Login result:', loginRes);
    
    if (!loginRes.success) {
      console.log('Login failed (expected if password wrong), trying to test actions directly with a valid rider ID...');
    }

    const riderId = '01259c04-fdf0-475e-bd57-efa0a500d1de'; // Ankit
    const token = loginRes.token || 'dummy_token';

    console.log('Testing getRiderStats...');
    const stats = await getRiderStats(riderId);
    console.log('Stats:', stats);

    console.log('Testing getRiderActiveOrder...');
    const activeOrder = await getRiderActiveOrder(riderId);
    console.log('Active Order:', activeOrder);

    console.log('Testing getRider24HHistory...');
    const history = await getRider24HHistory(token, riderId);
    console.log('History:', history);

    console.log('All actions executed successfully without throwing!');
  } catch (err) {
    console.error('An action threw an error:', err);
  }
}

testActions();
