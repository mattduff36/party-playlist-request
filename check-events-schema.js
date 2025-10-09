const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !line.startsWith('#')) {
      process.env[match[1]] = match[2];
    }
  });
}

async function checkSchema() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('🔍 Checking events table schema...\n');
  
  const columns = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position
  `;
  
  console.log('📋 Events Table Columns:');
  columns.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'})`);
  });
  
  console.log('\n🔍 Checking if user_events table exists...\n');
  
  const userEventsTables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_events'
  `;
  
  if (userEventsTables.length > 0) {
    console.log('✅ user_events table EXISTS');
    
    const userEventsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_events'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 User Events Table Columns:');
    userEventsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'})`);
    });
  } else {
    console.log('❌ user_events table DOES NOT EXIST');
  }
  
  console.log('\n🔍 Sample events data...\n');
  
  const sampleEvents = await sql`
    SELECT id, user_id, status, config
    FROM events
    LIMIT 2
  `;
  
  console.log('📄 Sample Events:');
  sampleEvents.forEach(event => {
    console.log(`\nEvent ID: ${event.id}`);
    console.log(`User ID: ${event.user_id}`);
    console.log(`Status: ${event.status}`);
    console.log(`Config: ${JSON.stringify(event.config, null, 2)}`);
  });
}

checkSchema().catch(console.error);

