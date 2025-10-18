/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */
/**
 * Check the actual events table schema in the database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkSchema() {
  console.log('🔍 Checking events table schema...\n');

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
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  Events table not found');
    } else {
      console.log(`✅ Events table has ${result.rows.length} columns:\n`);
      
      result.rows.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name}`);
        console.log(`   Type: ${col.data_type}`);
        console.log(`   Nullable: ${col.is_nullable}`);
        console.log(`   Default: ${col.column_default || 'none'}`);
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

checkSchema();

