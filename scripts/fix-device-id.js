/**
 * Quick Fix: Add device_id column to events table
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function runMigration() {
  console.log('🔧 Adding device_id column to events table...\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Make sure .env.local exists with DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    const migrationSQL = `
      ALTER TABLE events ADD COLUMN IF NOT EXISTS device_id TEXT;
      COMMENT ON COLUMN events.device_id IS 'Spotify device ID for playback control';
    `;

    console.log('📝 Migration SQL:');
    console.log(migrationSQL);
    console.log('');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the column was added
    console.log('🔍 Verifying column exists...');
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'device_id';
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Column verified:');
      console.log(`   - Name: ${verifyResult.rows[0].column_name}`);
      console.log(`   - Type: ${verifyResult.rows[0].data_type}`);
      console.log(`   - Nullable: ${verifyResult.rows[0].is_nullable}`);
    } else {
      console.error('❌ Column not found after migration!');
      process.exit(1);
    }
    
    console.log('\n🎉 Migration successful! The application should now work correctly.');
    console.log('   Please restart your dev server.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();


