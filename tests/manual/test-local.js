#!/usr/bin/env node

/**
 * Local Testing Script for Party Playlist Request
 * 
 * This script helps test the authentication flow locally without
 * needing to deploy to production every time.
 */

const { spawn } = require('child_process');
const open = require('open');

console.log('🚀 Starting Local Testing Environment...\n');

// Start the development server
const devServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Wait a bit for server to start, then open browser
setTimeout(() => {
  console.log('\n🌐 Opening browser for local testing...');
  console.log('📍 Admin Panel: http://localhost:3000/admin');
  console.log('📍 Display Page: http://localhost:3000/display');
  console.log('\n🧪 Testing Features:');
  console.log('✅ Admin authentication flow');
  console.log('✅ SSE connection and data updates');
  console.log('✅ Mock Spotify token exchange');
  console.log('✅ Database operations');
  console.log('✅ UI state management');
  console.log('\n⚠️  Note: Real Spotify API calls will be mocked in development');
  console.log('🔧 Use production for actual Spotify integration testing\n');
  
  // Optionally open browser
  // open('http://localhost:3000/admin');
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping local testing environment...');
  devServer.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  devServer.kill();
  process.exit(0);
});
