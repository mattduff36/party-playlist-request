/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */
/**
 * Update a user's email address
 * Usage: node scripts/update-user-email.js <username> <new-email>
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function updateUserEmail(username, newEmail) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log(`\n🔍 Updating email for user: ${username}...`);

    // Update the email
    const result = await pool.query(
      'UPDATE users SET email = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username, email, role',
      [newEmail, username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log(`\n❌ User "${username}" not found.`);
    } else {
      const user = result.rows[0];
      console.log(`\n✅ Email updated successfully!`);
      console.log(`\n📋 Account Details:`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user.id}`);
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === '23505') {
      console.log('\n💡 This email address is already in use by another account.');
    }
  } finally {
    await pool.end();
  }
}

// Get parameters from command line
const username = process.argv[2];
const newEmail = process.argv[3];

if (!username || !newEmail) {
  console.log('\n❌ Please provide username and new email');
  console.log('\nUsage: node scripts/update-user-email.js <username> <new-email>');
  console.log('\nExample:');
  console.log('  node scripts/update-user-email.js superadmin admin@mpdee.co.uk');
  console.log('\n');
  process.exit(1);
}

updateUserEmail(username, newEmail);

