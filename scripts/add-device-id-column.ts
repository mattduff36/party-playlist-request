/**
 * Migration Script: Add device_id column to events table
 * 
 * This script adds the missing device_id column to the production database
 */

import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🔧 Adding device_id column to events table...\n');

  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations', 'add_device_id_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

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

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

