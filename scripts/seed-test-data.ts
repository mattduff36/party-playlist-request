/**
 * Test Data Seeding Script
 * 
 * Seeds the test database with realistic test data
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

// Load test environment
dotenv.config({ path: './test.env' });

async function seedTestData() {
  console.log('🌱 Seeding test database...');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not found in test.env');
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  
  try {
    // Create test users
    console.log('👤 Creating test users...');
    // Use the same password the tests expect
    const password = await bcrypt.hash('testpassword123', 10);
    
    const usersResult = await pool.query(`
      INSERT INTO users (username, email, password_hash, display_name, role)
      VALUES 
        ('testuser1', 'testuser1@example.com', $1, 'Test User 1', 'user'),
        ('testuser2', 'testuser2@example.com', $1, 'Test User 2', 'user'),
        ('testuser3', 'testuser3@example.com', $1, 'Test User 3', 'user')
      RETURNING id, username
    `, [password]);
    
    console.log(`✅ Created ${usersResult.rows.length} test users`);
    
    const testUserId = usersResult.rows[0].id;
    const testAdminId = usersResult.rows[1].id;
    const testDjId = usersResult.rows[2].id;
    
    // Create test events
    console.log('🎉 Creating test events...');
    const eventsResult = await pool.query(`
      INSERT INTO events (user_id, pin, status, config)
      VALUES 
        ($1, '123456', 'offline', $2),
        ($3, '789012', 'standby', $4),
        ($5, '345678', 'live', $6)
      RETURNING id, pin, status
    `, [
      testUserId,
      JSON.stringify({
        pages_enabled: { requests: false, display: false },
        event_title: 'Test Event 1',
        welcome_message: 'Welcome to Test Event 1',
        secondary_message: 'Request your favorite songs',
        tertiary_message: 'Have fun!',
      }),
      testAdminId,
      JSON.stringify({
        pages_enabled: { requests: true, display: false },
        event_title: 'Test Event 2',
        welcome_message: 'Welcome to Test Event 2',
      }),
      testDjId,
      JSON.stringify({
        pages_enabled: { requests: true, display: true },
        event_title: 'Live Test Event',
        welcome_message: 'Welcome to Live Event',
      }),
    ]);
    
    console.log(`✅ Created ${eventsResult.rows.length} test events`);
    
    // Create test Spotify tokens (mocked)
    console.log('🎵 Creating test Spotify tokens...');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    await pool.query(`
      INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
      VALUES 
        ($1, 'mock_access_token_1', 'mock_refresh_token_1', $2),
        ($3, 'mock_access_token_2', 'mock_refresh_token_2', $4)
    `, [testUserId, expiresAt, testDjId, expiresAt]);
    
    console.log('✅ Created test Spotify tokens');
    
    // Create test song requests
    console.log('🎵 Creating test song requests...');
    const tracks = [
      { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours' },
      { name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia' },
      { name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours' },
      { name: 'Peaches', artist: 'Justin Bieber', album: 'Justice' },
      { name: 'Good 4 U', artist: 'Olivia Rodrigo', album: 'SOUR' },
    ];
    
    const requestValues: string[] = [];
    const requestParams: any[] = [];
    let paramIndex = 1;
    
    // Create 20 test requests with various statuses
    for (let i = 0; i < 20; i++) {
      const track = tracks[i % tracks.length];
      const status = ['pending', 'approved', 'rejected', 'played'][Math.floor(Math.random() * 4)];
      const nickname = faker.person.firstName();
      
      requestValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
      requestParams.push(
        `spotify:track:${faker.string.alphanumeric(22)}`,
        track.name,
        track.artist,
        track.album,
        nickname,
        status
      );
      paramIndex += 6;
    }
    
    await pool.query(`
      INSERT INTO requests (track_uri, track_name, artist_name, album_name, requester_nickname, status)
      VALUES ${requestValues.join(', ')}
    `, requestParams);
    
    console.log('✅ Created 20 test song requests');
    
    console.log('🎉 Test data seeding complete!');
    
    // Print summary
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM spotify_tokens) as tokens,
        (SELECT COUNT(*) FROM requests) as requests
    `);
    
    console.log('\n📊 Database Summary:');
    console.log(`   Users: ${summary.rows[0].users}`);
    console.log(`   Events: ${summary.rows[0].events}`);
    console.log(`   Spotify Tokens: ${summary.rows[0].tokens}`);
    console.log(`   Requests: ${summary.rows[0].requests}`);
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedTestData };

