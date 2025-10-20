#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function updateSuperadminPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔑 Updating superadmin password...');
    
    const password = 'q09ww8qe';
    const hash = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING username, email, role',
      [hash, 'superadmin']
    );

    if (result.rows.length > 0) {
      console.log('✅ Superadmin password updated successfully!');
      console.log('   Username:', result.rows[0].username);
      console.log('   Email:', result.rows[0].email);
      console.log('   Role:', result.rows[0].role);
      console.log('   Password: q09ww8qe');
    } else {
      console.log('⚠️  No superadmin user found');
    }
  } catch (error) {
    console.error('❌ Error updating password:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateSuperadminPassword();

