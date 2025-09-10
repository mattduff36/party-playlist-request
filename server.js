const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Check if certificates exist
const keyPath = path.join(__dirname, 'localhost-key.pem');
const certPath = path.join(__dirname, 'localhost.pem');

let httpsOptions = null;

try {
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log('✅ Found SSL certificates, starting HTTPS server...');
  } else {
    console.log('❌ SSL certificates not found. Please run the certificate generation script first.');
    console.log('See setup-https.md for instructions.');
    process.exit(1);
  }
} catch (error) {
  console.error('Error reading SSL certificates:', error);
  process.exit(1);
}

app.prepare().then(() => {
  if (httpsOptions) {
    createServer(httpsOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(3000, (err) => {
      if (err) throw err;
      console.log('🚀 Ready on https://localhost:3000');
      console.log('🔒 HTTPS enabled for Spotify OAuth');
    });
  }
});
