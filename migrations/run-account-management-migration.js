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
  
  console.log('🚀 Running Migration 004: User Account Management...\n');
  
  try {
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '004-add-user-account-management.sql'),
      'utf8'
    );
    
    // Execute migration using tagged template for each statement
    console.log('📝 Executing migration SQL...\n');
    
    // Manually execute each statement using tagged template syntax
    const statements = [
      { desc: 'Add account_status column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'pending'` },
      { desc: 'Add email_verified column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false` },
      { desc: 'Add email_verification_token column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT` },
      { desc: 'Add email_verification_expires column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ` },
      { desc: 'Add last_login column', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ` },
      { desc: 'Create password_reset_tokens table', sql: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)` },
      { desc: 'Create idx_password_reset_tokens_token', sql: `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)` },
      { desc: 'Create idx_password_reset_tokens_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)` },
      { desc: 'Create idx_password_reset_tokens_expires_at', sql: `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)` },
      { desc: 'Create idx_users_email_verification_token', sql: `CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token)` },
      { desc: 'Create user_sessions table', sql: `CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
)` },
      { desc: 'Create idx_user_sessions_user_id', sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)` },
      { desc: 'Create idx_user_sessions_session_token', sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token)` },
      { desc: 'Create idx_user_sessions_expires_at', sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)` },
      { desc: 'Create idx_users_username', sql: `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)` },
      { desc: 'Update existing users to active', sql: `UPDATE users SET account_status = 'active', email_verified = true WHERE account_status = 'pending'` },
    ];
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const { desc, sql: sqlStr } = statements[i];
      console.log(`${i + 1}/${statements.length}: ${desc}...`);
      
      try {
        // Use unsafe dynamic SQL - wrap in Function to evaluate template literal
        await sql.unsafe(sqlStr);
        console.log('  ✅ Success');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('  ℹ️  Already exists (skipped)');
        } else {
          console.error('  ❌ Error:', error.message);
        }
      }
    }
    
    console.log('\n✅ Migration completed!');
    
    // Verify the changes
    console.log('\n🔍 Verifying migration...');
    
    // Check if columns were added
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('account_status', 'email_verified', 'email_verification_token', 'email_verification_expires', 'last_login')
      ORDER BY column_name;
    `;
    
    console.log('\n📋 New columns in users table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Check if password_reset_tokens table was created
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('password_reset_tokens', 'user_sessions')
      ORDER BY table_name;
    `;
    
    console.log('\n📋 New tables created:');
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check indexes
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (indexname LIKE '%password_reset%' OR indexname LIKE '%verification%' OR indexname LIKE '%user_sessions%')
      ORDER BY tablename, indexname;
    `;
    
    console.log('\n📋 New indexes created:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.tablename}.${idx.indexname}`);
    });
    
    console.log('\n🎉 Migration verification complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

runMigration();
