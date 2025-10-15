/**
 * Test Database Setup Script
 * 
 * Creates and initializes the test database with schema
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load test environment
dotenv.config({ path: './test.env' });

async function setupTestDatabase() {
  console.log('🔧 Setting up test database...');
  
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not found in test.env');
  }
  
  // Create connection pool
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');
    
    // Drop existing tables (clean slate)
    console.log('🧹 Dropping existing tables...');
    await pool.query(`
      DROP TABLE IF EXISTS requests CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS spotify_tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS admins CASCADE;
    `);
    console.log('✅ Existing tables dropped');
    
    // Create users table
    console.log('📝 Creating users table...');
    await pool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        active_session_id TEXT,
        active_session_created_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Users table created');
    
    // Create events table
    console.log('📝 Creating events table...');
    await pool.query(`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'offline',
        config JSONB NOT NULL DEFAULT '{}',
        active_admin_id UUID,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Events table created');
    
    // Create spotify_tokens table
    console.log('📝 Creating spotify_tokens table...');
    await pool.query(`
      CREATE TABLE spotify_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Spotify tokens table created');
    
    // Create requests table
    console.log('📝 Creating requests table...');
    await pool.query(`
      CREATE TABLE requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        track_uri TEXT NOT NULL,
        track_name TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        album_name TEXT,
        album_image_url TEXT,
        requester_nickname TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_at TIMESTAMP WITH TIME ZONE,
        rejected_at TIMESTAMP WITH TIME ZONE,
        played_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Requests table created');
    
    // Create indexes
    console.log('📝 Creating indexes...');
    await pool.query(`
      CREATE INDEX idx_users_active_session ON users(active_session_id) WHERE active_session_id IS NOT NULL;
      CREATE INDEX idx_events_user_id ON events(user_id);
      CREATE INDEX idx_events_pin ON events(pin);
      CREATE INDEX idx_events_status ON events(status);
      CREATE INDEX idx_spotify_tokens_user_id ON spotify_tokens(user_id);
      CREATE INDEX idx_requests_status ON requests(status);
      CREATE INDEX idx_requests_track_uri ON requests(track_uri);
      CREATE INDEX idx_requests_created_at ON requests(created_at);
      CREATE INDEX idx_requests_status_created ON requests(status, created_at);
      CREATE INDEX idx_requests_status_approved_at ON requests(status, approved_at);
      CREATE INDEX idx_requests_track_uri_status ON requests(track_uri, status);
    `);
    console.log('✅ Indexes created');
    
    console.log('🎉 Test database setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupTestDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { setupTestDatabase };


