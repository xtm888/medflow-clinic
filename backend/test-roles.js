// Test script to verify different user roles

const users = [
  { email: 'admin@medflow.com', role: 'Admin', expectedMenuItems: 13 },
  { email: 'doctor@medflow.com', role: 'Doctor', expectedMenuItems: 8 },
  { email: 'ophthalmologist@medflow.com', role: 'Ophthalmologist', expectedMenuItems: 8 },
  { email: 'nurse@medflow.com', role: 'Nurse', expectedMenuItems: 6 },
  { email: 'reception@medflow.com', role: 'Receptionist', expectedMenuItems: 6 },
  { email: 'pharmacist@medflow.com', role: 'Pharmacist', expectedMenuItems: 5 }
];

const API_BASE = 'http://localhost:5001/api';

async function testLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  } catch (error) {
    console.error(`Error logging in ${email}:`, error.message);
    return null;
  }
}

async function testAllRoles() {
  console.log('🔐 Testing Role-Based Authentication\n');
  console.log('=' .repeat(50));

  for (const user of users) {
    console.log(`\n👤 Testing: ${user.role}`);
    console.log('-'.repeat(30));

    const result = await testLogin(user.email, 'Admin123!');

    if (result) {
      console.log('✅ Login successful');
      console.log(`   Email: ${result.user.email}`);
      console.log(`   Name: ${result.user.firstName} ${result.user.lastName}`);
      console.log(`   Role: ${result.user.role}`);
      console.log(`   Department: ${result.user.department || 'N/A'}`);
      console.log(`   Expected menu items: ${user.expectedMenuItems}`);
    } else {
      console.log(`❌ Login failed for ${user.email}`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('✨ Role testing complete!\n');

  console.log('📋 Role-based menu access summary:');
  console.log('- Admin: Full system access (13 items)');
  console.log('- Doctor: Patient care focus (8 items)');
  console.log('- Ophthalmologist: Eye care + general (8 items)');
  console.log('- Nurse: Patient care support (6 items)');
  console.log('- Receptionist: Front desk ops (6 items)');
  console.log('- Pharmacist: Medication focus (5 items)');
}

// Run the tests
testAllRoles().catch(console.error);
