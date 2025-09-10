# HTTPS Setup for Local Development

## Method 1: Using mkcert (Recommended)

### Install mkcert
1. Download from: https://github.com/FiloSottile/mkcert/releases
2. Or use Chocolatey: `choco install mkcert`

### Setup certificates
```bash
# Install local CA
mkcert -install

# Create certificates for localhost
mkcert localhost 127.0.0.1 ::1

# This creates:
# - localhost+2.pem (certificate)
# - localhost+2-key.pem (private key)
```

### Update Next.js to use HTTPS
Create a custom server or modify package.json:

**Option A: Custom server (server.js)**
```javascript
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
```

**Option B: Using @next/bundle-analyzer with HTTPS**
```bash
npm install --save-dev @next/bundle-analyzer
```

## Method 2: Using ngrok (Alternative)

### Install ngrok
```bash
npm install -g ngrok
```

### Run your app and tunnel
```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Create secure tunnel
ngrok http 3000
```

This gives you a public HTTPS URL like: `https://abc123.ngrok.io`

## Method 3: Using local-ssl-proxy

### Install
```bash
npm install -g local-ssl-proxy
```

### Run
```bash
# Terminal 1: Start Next.js on port 3001
PORT=3001 npm run dev

# Terminal 2: Create HTTPS proxy
local-ssl-proxy --source 3000 --target 3001
```

Access via: `https://localhost:3000`

## Update Spotify App Settings

Once you have HTTPS working, update your Spotify app:
1. Go to https://developer.spotify.com/dashboard
2. Edit your app
3. Add redirect URI: `https://localhost:3000/api/spotify/callback`

## Update Environment Variables

Update your `.env.local`:
```
SPOTIFY_REDIRECT_URI=https://localhost:3000/api/spotify/callback
```
