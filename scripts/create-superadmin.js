/**
 * Create or update a user to superadmin
 * Usage: node scripts/create-superadmin.js <username>
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function createSuperAdmin(username) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log(`\n🔍 Checking for user: ${username}...`);

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, username, email, role FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      console.log(`\n❌ User "${username}" not found.`);
      console.log(`\nWould you like to create a new superadmin account? (Ctrl+C to cancel)\n`);
      
      // Create new superadmin
      const email = `${username.toLowerCase()}@superadmin.local`;
      const password = process.argv[3] || 'SuperAdmin123!'; // Password from command line or default
      const hashedPassword = await bcrypt.hash(password, 10);

      const insertResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, username, email, role`,
        [username.toLowerCase(), email, hashedPassword, 'superadmin']
      );

      const newUser = insertResult.rows[0];
      console.log(`\n✅ Superadmin account created!`);
      console.log(`\n📋 Login Credentials:`);
      console.log(`   Username: ${newUser.username}`);
      console.log(`   Password: ${password}`);
      console.log(`\n⚠️  IMPORTANT: Change this password immediately after first login!\n`);

    } else {
      const user = userResult.rows[0];
      
      if (user.role === 'superadmin') {
        console.log(`\n✅ User "${username}" is already a superadmin.`);
        console.log(`\n📋 Account Details:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`\n💡 If you forgot the password, you can reset it via the forgot password flow.`);
      } else {
        // Update existing user to superadmin
        await pool.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['superadmin', user.id]
        );

        console.log(`\n✅ User "${username}" has been promoted to superadmin!`);
        console.log(`\n📋 Account Details:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: superadmin (updated)`);
        console.log(`\n💡 You can now login with your existing password.`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === '23505') {
      console.log('\n💡 Tip: Email address may already be in use.');
    }
  } finally {
    await pool.end();
  }
}

// Get username and password from command line
const username = process.argv[2];
const password = process.argv[3];

if (!username) {
  console.log('\n❌ Please provide a username');
  console.log('\nUsage: node scripts/create-superadmin.js <username> [password]');
  console.log('\nExamples:');
  console.log('  node scripts/create-superadmin.js admin');
  console.log('  node scripts/create-superadmin.js superadmin MySecurePassword123');
  console.log('\nNote: If password is not provided, default password "SuperAdmin123!" will be used');
  console.log('\n');
  process.exit(1);
}

createSuperAdmin(username);

