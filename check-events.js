const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const { neon } = require('@neondatabase/serverless');

async function checkEvents() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('📊 Checking events table...\n');
  
  // Check if user_events table exists
  const tableCheck = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' AND table_name IN ('events', 'user_events')
  `;
  
  console.log('Tables found:', tableCheck.map(t => t.table_name).join(', '));
  console.log('');
  
  // Get all events with user info
  const events = await sql`
    SELECT e.id, e.user_id, e.status, e.version, e.updated_at,
           u.username, u.email
    FROM events e
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.updated_at DESC
  `;
  
  // Also check user_events table
  try {
    const userEvents = await sql`
      SELECT ue.id, ue.user_id, ue.name, ue.pin, ue.active, ue.expires_at,
             u.username, u.email
      FROM user_events ue
      LEFT JOIN users u ON u.id = ue.user_id
      WHERE ue.active = true
      ORDER BY ue.started_at DESC
    `;
    
    console.log(`\n📌 Active user_events (with PINs):\n`);
    userEvents.forEach((event, i) => {
      console.log(`User Event ${i + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  User ID: ${event.user_id}`);
      console.log(`  Username: ${event.username}`);
      console.log(`  PIN: ${event.pin}`);
      console.log(`  Active: ${event.active}`);
      console.log(`  Expires: ${event.expires_at}`);
      console.log('');
    });
  } catch (err) {
    console.log('\n⚠️ user_events table does not exist');
  }
  
  console.log(`Found ${events.length} events:\n`);
  events.forEach((event, i) => {
    console.log(`Event ${i + 1}:`);
    console.log(`  ID: ${event.id}`);
    console.log(`  User ID: ${event.user_id}`);
    console.log(`  Username: ${event.username}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  Version: ${event.version}`);
    console.log(`  Updated: ${event.updated_at}`);
    console.log('');
  });
  
  // Get all users
  console.log('\n📊 Users in database:\n');
  const users = await sql`
    SELECT id, username, email, created_at
    FROM users
    ORDER BY created_at ASC
  `;
  
  users.forEach((user, i) => {
    console.log(`User ${i + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log('');
  });
}

checkEvents().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
