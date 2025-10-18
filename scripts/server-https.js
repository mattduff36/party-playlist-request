/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable unicorn/prefer-module */
const https = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');
const selfsigned = require('selfsigned');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

// Generate self-signed certificate if it doesn't exist
const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

function generateSelfSignedCert() {
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }
  
  try {
    console.log('🔑 Generating self-signed certificate...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { days: 365 });
    
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    
    console.log('✅ Self-signed certificate generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate certificate:', error.message);
    process.exit(1);
  }
}

app.prepare().then(() => {
  // Check if certificates exist, generate if not
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    generateSelfSignedCert();
  }

  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const server = https.createServer(httpsOptions, (req, res) => {
    return handle(req, res);
  });

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`🚀 Ready on https://localhost:${PORT}`);
    console.log(`🔒 HTTPS server running for Spotify API compatibility`);
    console.log(`⚠️  You may need to accept the self-signed certificate in your browser`);
    console.log(`📝 Visit: https://localhost:${PORT}`);
  });
});
