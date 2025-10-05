#!/usr/bin/env node

/**
 * Migration Runner
 * Runs the spike migration using Node.js (no psql needed)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found');
  console.error('💡 Make sure .env.local is loaded');
  process.exit(1);
}

console.log('🚀 Running Spike 1 Migration\n');
console.log('📊 Database:', DATABASE_URL.split('@')[1].split('/')[0]);
console.log('⚠️  This will add multi-tenant tables to your database\n');

const pool = new Pool({ connectionString: DATABASE_URL });

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '001-add-multi-tenancy-UP.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration...');
    
    // Execute migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Quick verification
    console.log('🔍 Verifying tables created...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'user_events', 'display_tokens', 'user_settings')
      ORDER BY table_name;
    `);
    
    console.log('✅ Tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check test data
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const eventCount = await pool.query('SELECT COUNT(*) FROM user_events');
    const requestCount = await pool.query('SELECT COUNT(*) FROM requests WHERE user_id IS NOT NULL');
    
    console.log('\n📊 Test data loaded:');
    console.log(`   - Users: ${userCount.rows[0].count}`);
    console.log(`   - Events: ${eventCount.rows[0].count}`);
    console.log(`   - Requests: ${requestCount.rows[0].count}`);
    
    console.log('\n🎉 SUCCESS! Migration complete.');
    console.log('✅ Ready to run validation tests.\n');
    console.log('Next command: node migrations/spike/run-spike-tests.js\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
