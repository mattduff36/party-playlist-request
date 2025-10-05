#!/usr/bin/env node

/**
 * Setup Verification Script for Party DJ Request System
 * Run this script to verify your configuration is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🎵 Party DJ Request System - Setup Verification\n');

// Check if required files exist
const requiredFiles = [
  'backend/.env',
  'backend/package.json',
  'frontend/package.json',
  'frontend/.env.local'
];

console.log('📁 Checking required files...');
let filesOk = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    filesOk = false;
  }
});

if (!filesOk) {
  console.log('\n❌ Some required files are missing. Please check the setup instructions.');
  process.exit(1);
}

// Check backend .env configuration
console.log('\n🔧 Checking backend configuration...');
const envPath = path.join(__dirname, 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const requiredEnvVars = [
  'PORT',
  'JWT_SECRET',
  'ADMIN_PASSWORD',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI'
];

let envOk = true;

requiredEnvVars.forEach(varName => {
  const regex = new RegExp(`^${varName}=(.+)$`, 'm');
  const match = envContent.match(regex);
  
  if (match && match[1] && match[1] !== `your-${varName.toLowerCase().replace('_', '-')}-here` && match[1] !== `your-${varName.toLowerCase()}`) {
    console.log(`✅ ${varName}`);
  } else {
    console.log(`❌ ${varName} - NOT SET OR USING PLACEHOLDER`);
    envOk = false;
  }
});

// Check frontend .env.local
console.log('\n🖥️  Checking frontend configuration...');
const frontendEnvPath = path.join(__dirname, 'frontend', '.env.local');
if (fs.existsSync(frontendEnvPath)) {
  const frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf8');
  if (frontendEnvContent.includes('NEXT_PUBLIC_API_URL=')) {
    console.log('✅ NEXT_PUBLIC_API_URL');
  } else {
    console.log('❌ NEXT_PUBLIC_API_URL - NOT SET');
    envOk = false;
  }
} else {
  console.log('❌ frontend/.env.local - MISSING');
  envOk = false;
}

// Summary
console.log('\n📋 Setup Summary:');

if (filesOk && envOk) {
  console.log('✅ All checks passed! Your setup looks good.');
  console.log('\n🚀 Next steps:');
  console.log('1. Make sure you have created a Spotify Developer App');
  console.log('2. Update SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env');
  console.log('3. Start the backend: cd backend && npm run dev');
  console.log('4. Start the frontend: cd frontend && npm run dev');
  console.log('5. Visit http://localhost:3000/admin to test admin login');
  console.log('6. Connect your Spotify account in the admin panel');
} else {
  console.log('❌ Setup incomplete. Please fix the issues above.');
  console.log('\n📖 For help:');
  console.log('- Check setup-spotify.md for Spotify app creation');
  console.log('- Check README.md for complete setup instructions');
}

console.log('\n🎉 Happy DJing!');