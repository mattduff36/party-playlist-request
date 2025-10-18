/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */
/**
 * CRITICAL SECURITY MIGRATION
 * Adds user_id to requests table for proper multi-tenant data isolation
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('\n🚨 CRITICAL SECURITY MIGRATION: Adding user_id to requests table\n');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../src/lib/db/migrations/add-user-id-to-requests.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Check for existing orphaned requests
    const orphanedCheck = await pool.query('SELECT COUNT(*) FROM requests');
    const orphanedCount = parseInt(orphanedCheck.rows[0].count);

    if (orphanedCount > 0) {
      console.log(`⚠️  WARNING: Found ${orphanedCount} existing requests in database`);
      console.log('   These requests will become orphaned (user_id = NULL)');
      console.log('   You may want to delete them or assign them to specific users');
      console.log('');
    }

    // Execute migration
    console.log('📝 Executing migration SQL...\n');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the column was added
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'requests' AND column_name = 'user_id'
    `);

    if (columnCheck.rows.length > 0) {
      const col = columnCheck.rows[0];
      console.log('✅ Verified: user_id column exists');
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log('');
    }

    // Check indexes
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'requests' AND indexdef LIKE '%user_id%'
    `);

    console.log('✅ Indexes created:');
    indexCheck.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });
    console.log('');

    // Check foreign key constraint
    const fkCheck = await pool.query(`
      SELECT constraint_name, table_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'requests' AND column_name = 'user_id'
    `);

    if (fkCheck.rows.length > 0) {
      console.log('✅ Foreign key constraint created:');
      fkCheck.rows.forEach(fk => {
        console.log(`   - ${fk.constraint_name}`);
      });
      console.log('');
    }

    if (orphanedCount > 0) {
      console.log('⚠️  IMPORTANT: You have orphaned requests (user_id = NULL)');
      console.log('   Run this query to delete them:');
      console.log('   DELETE FROM requests WHERE user_id IS NULL;');
      console.log('');
    }

    console.log('🎉 Migration complete! Next steps:');
    console.log('   1. Update all API endpoints to filter by user_id');
    console.log('   2. Update all INSERT statements to include user_id');
    console.log('   3. Test multi-tenant isolation');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

