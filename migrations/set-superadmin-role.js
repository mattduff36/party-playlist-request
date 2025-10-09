const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Manually load .env.local variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !line.startsWith('#')) {
      process.env[match[1]] = match[2];
    }
  });
}

async function setSuperAdminRole() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const username = process.argv[2];

  if (!username) {
    console.error('❌ Usage: node set-superadmin-role.js <username>');
    console.log('\nExample: node set-superadmin-role.js testuser2024');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  console.log(`🔍 Looking for user: ${username}...\n`);

  try {
    // Check if user exists
    const users = await sql`
      SELECT id, username, email, role
      FROM users
      WHERE username = ${username}
    `;

    if (users.length === 0) {
      console.error(`❌ User "${username}" not found`);
      console.log('\nAvailable users:');
      const allUsers = await sql`SELECT username FROM users LIMIT 10`;
      allUsers.forEach(u => console.log(`  - ${u.username}`));
      process.exit(1);
    }

    const user = users[0];

    if (user.role === 'superadmin') {
      console.log(`ℹ️  User "${username}" already has superadmin role`);
      return;
    }

    // Set role to superadmin
    await sql`
      UPDATE users
      SET role = 'superadmin'
      WHERE id = ${user.id}
    `;

    console.log(`✅ User "${username}" role set to 'superadmin'!`);
    console.log(`\nYou can now login and access: http://localhost:3000/superadmin`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setSuperAdminRole().catch(console.error);

