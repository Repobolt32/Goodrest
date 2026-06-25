import { describe, it } from 'vitest';
import { getRiderStats, getRiderActiveOrder, getRider24HHistory, loginRider } from '@/app/actions/riderActions';

describe('Diagnose Rider Dashboard Server Actions', () => {
  it('runs actions against actual DB or checks for syntax/runtime crashes', async () => {
    console.log('--- START DIAGNOSTIC TEST ---');
    try {
      console.log('1. Attempting loginRider...');
      const loginRes = await loginRider('1122334455', 'test123');
      console.log('Login result:', loginRes);

      const riderId = '01259c04-fdf0-475e-bd57-efa0a500d1de'; // Ankit
      const token = loginRes.token || 'dummy_token';

      console.log('2. Running getRiderStats...');
      const stats = await getRiderStats(riderId);
      console.log('Stats:', stats);

      console.log('3. Running getRiderActiveOrder...');
      const activeOrder = await getRiderActiveOrder(riderId);
      console.log('Active Order:', activeOrder);

      console.log('4. Running getRider24HHistory...');
      const history = await getRider24HHistory(token, riderId);
      console.log('History:', history);

      console.log('--- ALL ACTIONS EXECUTED ---');
    } catch (e) {
      console.error('--- EXCEPTION DETECTED ---');
      console.error(e);
      throw e;
    }
  });
});
