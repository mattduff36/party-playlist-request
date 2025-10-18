/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */
/**
 * List all users in the database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function listUsers() {
  console.log('📋 Listing users in database...\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        email,
        display_name,
        role,
        created_at
      FROM users
      ORDER BY created_at DESC;
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No users found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Display Name: ${user.display_name || 'N/A'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`   ID: ${user.id}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

listUsers();


