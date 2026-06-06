const bcrypt = require('bcryptjs');

const hash = '$2b$10$JNuKGL3ix2ty/k2bLLkdEe5kXSPlRaWXn4Jj5nS3f1eTi0lTufUFW';
const password = 'test123';

async function test() {
  const valid = await bcrypt.compare(password, hash);
  console.log('Password "test123" matches hash:', valid);
  
  if (!valid) {
    console.log('Trying common passwords...');
    const testPasswords = ['test123', 'password', 'rider123', 'goodrest', '123456', 'admin', 'demo', 'Test Rider', '9999999998', 'fcfs'];
    for (const pw of testPasswords) {
      const v = await bcrypt.compare(pw, hash);
      if (v) {
        console.log('✅ Found matching password:', pw);
        return;
      }
    }
    console.log('❌ None of the common passwords matched');
    console.log('The password for this rider is NOT "test123"');
  }
}

test();
