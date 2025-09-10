const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔐 Generating self-signed SSL certificates for local development...');

try {
  // Generate private key
  execSync('openssl genrsa -out localhost-key.pem 2048', { stdio: 'inherit' });
  
  // Generate certificate
  execSync(`openssl req -new -x509 -key localhost-key.pem -out localhost.pem -days 365 -subj "/C=US/ST=Local/L=Local/O=Local/CN=localhost"`, { stdio: 'inherit' });
  
  console.log('✅ SSL certificates generated successfully!');
  console.log('📁 Files created:');
  console.log('   - localhost-key.pem (private key)');
  console.log('   - localhost.pem (certificate)');
  console.log('');
  console.log('⚠️  Note: Your browser will show a security warning for self-signed certificates.');
  console.log('   Click "Advanced" → "Proceed to localhost (unsafe)" to continue.');
  console.log('');
  console.log('🚀 Now run: npm run dev:https');
  
} catch (error) {
  console.error('❌ Error generating certificates:', error.message);
  console.log('');
  console.log('💡 Alternative: Install mkcert for trusted certificates:');
  console.log('   1. Download from: https://github.com/FiloSottile/mkcert/releases');
  console.log('   2. Run: mkcert -install');
  console.log('   3. Run: mkcert localhost 127.0.0.1 ::1');
  console.log('   4. Rename files to localhost.pem and localhost-key.pem');
}
