const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !line.startsWith('#')) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  console.log('🚀 Running Spotify Auth multi-tenant migration (safe version)...\n');
  
  try {
    // Check current structure
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'spotify_auth'
    `);
    
    const columnNames = columns.rows.map(r => r.column_name);
    const hasUserId = columnNames.includes('user_id');
    const hasOldId = columnNames.includes('id');
    
    console.log(`📋 Current structure:`);
    console.log(`  - Has user_id: ${hasUserId ? '✅' : '❌'}`);
    console.log(`  - Has old id column: ${hasOldId ? '⚠️' : '✅ (already removed)'}`);
    
    if (!hasUserId) {
      console.log('\n🔧 Adding user_id column...');
      await pool.query(`
        ALTER TABLE spotify_auth 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      `);
      console.log('✅ user_id column added');
    }
    
    if (hasOldId) {
      console.log('\n🔧 Migrating from old id-based structure...');
      
      // Drop old primary key
      await pool.query(`
        ALTER TABLE spotify_auth DROP CONSTRAINT IF EXISTS spotify_auth_pkey;
      `);
      
      // Remove duplicates (keep latest)
      await pool.query(`
        DELETE FROM spotify_auth 
        WHERE ctid NOT IN (
          SELECT MAX(ctid) 
          FROM spotify_auth 
          GROUP BY user_id
        );
      `);
      
      // Drop old id column
      await pool.query(`
        ALTER TABLE spotify_auth DROP COLUMN IF EXISTS id;
      `);
      
      console.log('✅ Old structure removed');
    }
    
    // Ensure primary key exists
    console.log('\n🔧 Setting up primary key and indexes...');
    
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'spotify_auth_pkey'
        ) THEN
          ALTER TABLE spotify_auth ADD CONSTRAINT spotify_auth_pkey PRIMARY KEY (user_id);
        END IF;
      END $$;
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_spotify_auth_user_id ON spotify_auth(user_id);
      CREATE INDEX IF NOT EXISTS idx_spotify_auth_expires_at ON spotify_auth(expires_at);
    `);
    
    console.log('✅ Primary key and indexes configured');
    
    console.log('\n✅ Spotify migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();

