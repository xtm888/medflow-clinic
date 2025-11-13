const bcrypt = require('bcryptjs');

// The password we're testing
const plainPassword = 'Admin123!';

// The hash from the database
const hashFromDB = '$2a$10$UVEeKhMEYRq/xZVAO4DbGOgtvaQCCLjqx/153bPaZo3yZvl5eDZYe';

// Test if they match
async function testPassword() {
  try {
    // Test direct bcrypt comparison
    const isMatch = await bcrypt.compare(plainPassword, hashFromDB);
    console.log('Password match result:', isMatch);

    // Also create a new hash to compare
    const newHash = await bcrypt.hash(plainPassword, 10);
    console.log('New hash:', newHash);
    console.log('DB hash:', hashFromDB);

    // Test the new hash
    const newMatch = await bcrypt.compare(plainPassword, newHash);
    console.log('New hash match result:', newMatch);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPassword();