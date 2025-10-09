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

async function testEventService() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('🧪 Testing Event Service Integration...\n');
  
  // Test 1: Check if testuser has an active event
  console.log('Test 1: Check for testuser active event...');
  const testuser = await sql`
    SELECT id, username 
    FROM users 
    WHERE username = 'testuser' 
    LIMIT 1
  `;
  
  if (testuser.length === 0) {
    console.log('❌ testuser not found!');
    return;
  }
  
  const userId = testuser[0].id;
  console.log(`✅ Found testuser: ${userId}\n`);
  
  // Check for active event
  const activeEvent = await sql`
    SELECT * FROM user_events 
    WHERE user_id = ${userId} 
    AND active = true 
    AND expires_at > NOW()
    LIMIT 1
  `;
  
  if (activeEvent.length > 0) {
    console.log('✅ Active event found:');
    console.log(`   ID: ${activeEvent[0].id}`);
    console.log(`   Name: ${activeEvent[0].name}`);
    console.log(`   PIN: ${activeEvent[0].pin}`);
    console.log(`   Bypass Token: ${activeEvent[0].bypass_token.substring(0, 20)}...`);
    console.log(`   Expires: ${activeEvent[0].expires_at}\n`);
  } else {
    console.log('⚠️  No active event found for testuser\n');
    
    // Create one for testing
    console.log('Creating test event...');
    const pin = '1234';
    const bypassToken = `bp_test_${Date.now()}_abcdef1234567890abcdef1234567890`;
    
    const newEvent = await sql`
      INSERT INTO user_events (user_id, name, pin, bypass_token, active, expires_at)
      VALUES (${userId}, 'Test Event', ${pin}, ${bypassToken}, true, NOW() + INTERVAL '24 hours')
      RETURNING *
    `;
    
    console.log('✅ Created test event:');
    console.log(`   ID: ${newEvent[0].id}`);
    console.log(`   PIN: ${newEvent[0].pin}`);
    console.log(`   Bypass Token: ${newEvent[0].bypass_token}\n`);
  }
  
  // Test 2: Test PIN verification
  console.log('Test 2: Test PIN verification endpoint logic...');
  const pinTest = await sql`
    SELECT e.* FROM user_events e
    INNER JOIN users u ON u.id = e.user_id
    WHERE u.username = 'testuser' 
    AND e.active = true 
    AND e.expires_at > NOW()
    LIMIT 1
  `;
  
  if (pinTest.length > 0) {
    console.log(`✅ PIN query works! Event ID: ${pinTest[0].id}\n`);
    
    // Now test with actual PIN
    const pinCheckResult = await sql`
      SELECT e.* FROM user_events e
      INNER JOIN users u ON u.id = e.user_id
      WHERE u.username = 'testuser' 
      AND e.pin = ${pinTest[0].pin}
      AND e.active = true 
      AND e.expires_at > NOW()
      LIMIT 1
    `;
    
    if (pinCheckResult.length > 0) {
      console.log(`✅ PIN match works! PIN: ${pinTest[0].pin}\n`);
    } else {
      console.log(`❌ PIN match failed!\n`);
    }
  } else {
    console.log('❌ PIN verification query failed!\n');
  }
  
  // Test 3: Check display_tokens table exists
  console.log('Test 3: Check display_tokens table...');
  const displayTokensTable = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'display_tokens'
  `;
  
  if (displayTokensTable.length > 0) {
    console.log('✅ display_tokens table exists\n');
    
    // Count display tokens
    const tokenCount = await sql`
      SELECT COUNT(*) as count FROM display_tokens
    `;
    console.log(`   Total display tokens: ${tokenCount[0].count}\n`);
  } else {
    console.log('❌ display_tokens table DOES NOT EXIST!\n');
  }
}

testEventService().catch(console.error);

