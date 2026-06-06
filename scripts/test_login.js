// Test rider login directly
const { loginRider } = require('../src/app/actions/riderActions.ts');

async function test() {
  console.log('Testing rider login...');
  
  // Test with 9999999998
  const result = await loginRider('9999999998', 'test123');
  console.log('Result for 9999999998:', result);
}

test().catch(console.error);
