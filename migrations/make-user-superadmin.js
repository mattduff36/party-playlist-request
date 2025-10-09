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

async function makeSuperAdmin() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const username = process.argv[2];

  if (!username) {
    console.error('❌ Usage: node make-user-superadmin.js <username>');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  console.log(`🔍 Looking for user: ${username}...\n`);

  try {
    // Check if user exists
    const users = await sql`
      SELECT id, username, email, is_super_admin
      FROM users
      WHERE username = ${username} AND deleted_at IS NULL
    `;

    if (users.length === 0) {
      console.error(`❌ User "${username}" not found`);
      process.exit(1);
    }

    const user = users[0];

    if (user.is_super_admin) {
      console.log(`ℹ️  User "${username}" is already a super admin`);
      return;
    }

    // Make super admin
    await sql`
      UPDATE users
      SET is_super_admin = true, updated_at = NOW()
      WHERE id = ${user.id}
    `;

    console.log(`✅ User "${username}" is now a super admin!`);
    console.log(`\nYou can now login and access: http://localhost:3000/superadmin`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeSuperAdmin().catch(console.error);

