const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in environment');
    process.exit(1);
  }

  console.log('🔧 Running hotfix migration: Add user_id to events table');
  console.log('📡 Connecting to database...');

  const sql = neon(connectionString);

  try {
    console.log('📝 Step 1: Checking if user_id column exists...');
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='events' AND column_name='user_id'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ user_id column already exists in events table');
      return;
    }

    console.log('📝 Step 2: Adding user_id column (nullable)...');
    await sql`ALTER TABLE events ADD COLUMN user_id UUID`;
    
    console.log('📝 Step 3: Ensuring at least one user exists...');
    const existingUser = await sql`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`;
    
    let userId;
    if (existingUser.length === 0) {
      console.log('   Creating default admin user...');
      const newUser = await sql`
        INSERT INTO users (username, email, password_hash, display_name, role)
        VALUES ('admin', 'admin@example.com', '$2a$10$placeholder', 'Admin User', 'superadmin')
        RETURNING id
      `;
      userId = newUser[0].id;
    } else {
      userId = existingUser[0].id;
    }
    
    console.log(`📝 Step 4: Assigning existing events to user ${userId}...`);
    await sql`UPDATE events SET user_id = ${userId} WHERE user_id IS NULL`;
    
    console.log('📝 Step 5: Making user_id NOT NULL...');
    await sql`ALTER TABLE events ALTER COLUMN user_id SET NOT NULL`;
    
    console.log('📝 Step 6: Adding foreign key constraint...');
    await sql`
      ALTER TABLE events 
      ADD CONSTRAINT events_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `;
    
    console.log('📝 Step 7: Creating index for performance...');
    await sql`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`;

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  - Added user_id column to events table');
    console.log('  - Created foreign key constraint to users table');
    console.log('  - Created index on user_id for performance');
    console.log('  - Associated existing events with user');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
