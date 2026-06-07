// test-bcrypt.mjs — Debug bcrypt hash comparison
import bcrypt from 'bcryptjs';

const dbHash = '$2b$10$g8IzMMVc3.DJR6zKavgjMe2ejTXiOzPXkVOkIicGEt.VEkNwJH9/S';

console.log('=== Bcrypt Hash Debug ===');
console.log('DB Hash:', dbHash);
console.log('Hash length:', dbHash.length);
console.log('Hash prefix:', dbHash.substring(0, 4));
console.log('Cost factor:', dbHash.split('$')[2]);

// Check if bcryptjs recognizes the hash
console.log('Hash starts with $2b$:', dbHash.startsWith('$2b$'));

// Try comparing with test123
const result1 = bcrypt.compareSync('test123', dbHash);
console.log('bcryptjs compare test123:', result1);

// Try comparing with empty string
const result2 = bcrypt.compareSync('', dbHash);
console.log('bcryptjs compare empty:', result2);

// Try comparing with 'password'
const result3 = bcrypt.compareSync('password', dbHash);
console.log('bcryptjs compare password:', result3);

// Generate a new hash with bcryptjs and compare
const newHash = bcrypt.hashSync('test123', 10);
console.log('\nNew bcryptjs hash:', newHash);
console.log('New hash length:', newHash.length);
const result4 = bcrypt.compareSync('test123', newHash);
console.log('Self-compare new hash:', result4);

// Try comparing test123 with newHash using the compare function
const result5 = await bcrypt.compare('test123', newHash);
console.log('Async compare new hash:', result5);

// Try async compare with DB hash
const result6 = await bcrypt.compare('test123', dbHash);
console.log('Async compare DB hash:', result6);

// Extract salt from DB hash and rehash 'test123' with same salt
const salt = dbHash.substring(0, 29); // $2b$10$ + 22 chars salt = 29 chars
console.log('\nExtracted salt prefix:', salt);
const rehashed = bcrypt.hashSync('test123', salt);
console.log('Rehashed with same salt:', rehashed);
console.log('Matches DB hash:', rehashed === dbHash);
