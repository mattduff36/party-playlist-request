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

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  console.log('🚀 Running Migration 005: Add Super Admin Role...\n');

  const statements = [
    { desc: 'Add is_super_admin column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false` },
    { desc: 'Create idx_users_is_super_admin', sql: `CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users(is_super_admin)` },
    { desc: 'Add created_by column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)` },
    { desc: 'Add updated_by column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id)` },
    { desc: 'Add deleted_at column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ` },
    { desc: 'Create idx_users_deleted_at', sql: `CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL` },
  ];
  
  console.log(`Found ${statements.length} SQL statements to execute\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const { desc, sql: sqlStr } = statements[i];
    console.log(`${i + 1}/${statements.length}: ${desc}...`);
    
    try {
      await sql.unsafe(sqlStr);
      console.log('  ✅ Success');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('already has')) {
        console.log('  ℹ️  Already exists (skipped)');
      } else {
        console.error('  ❌ Error:', error.message);
      }
    }
  }
  
  console.log('\n✅ Migration completed!');
  
  // Verify the changes
  console.log('\n🔍 Verifying migration...');
  
  const userColumns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users' 
      AND column_name IN ('is_super_admin', 'created_by', 'updated_by', 'deleted_at')
    ORDER BY column_name;
  `;
  console.log('\n📋 New columns in users table:');
  userColumns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable === 'YES' ? 'YES' : 'NO'})`);
  });

  const indexes = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' 
      AND tablename = 'users'
      AND indexname IN ('idx_users_is_super_admin', 'idx_users_deleted_at')
    ORDER BY indexname;
  `;
  console.log('\n📋 New indexes created:');
  indexes.forEach(idx => console.log(`  - ${idx.indexname}`));

  console.log('\n🎉 Migration verification complete!');
}

runMigration().catch(console.error);

