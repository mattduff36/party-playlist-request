# HTTPS Setup for Spotify OAuth

## Quick Setup

1. **Generate SSL certificates** (already done):
   ```bash
   npm run generate-certs
   ```

2. **Update your `.env.local`** file:
   ```env
   SPOTIFY_REDIRECT_URI=https://localhost:3000/api/spotify/callback
   ```

3. **Update Spotify App Settings**:
   - Go to https://developer.spotify.com/dashboard
   - Edit your app
   - Add redirect URI: `https://localhost:3000/api/spotify/callback`

4. **Start HTTPS development server**:
   ```bash
   npm run dev:https
   ```

5. **Access your app**:
   - Open: https://localhost:3000
   - **Important**: Your browser will show a security warning
   - Click "Advanced" → "Proceed to localhost (unsafe)"

## Browser Security Warning

Since we're using self-signed certificates, you'll see a warning like:
- Chrome: "Your connection is not private"
- Firefox: "Warning: Potential Security Risk Ahead"

This is normal for local development. Click "Advanced" and proceed.

## Alternative: Use mkcert for Trusted Certificates

For a better experience without browser warnings:

1. **Install mkcert**:
   - Download from: https://github.com/FiloSottile/mkcert/releases
   - Or use Chocolatey: `choco install mkcert`

2. **Generate trusted certificates**:
   ```bash
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```

3. **Rename the files**:
   ```bash
   mv localhost+2.pem localhost.pem
   mv localhost+2-key.pem localhost-key.pem
   ```

4. **Start the server**:
   ```bash
   npm run dev:https
   ```

## Troubleshooting

### Certificate Issues
If you get certificate errors, regenerate them:
```bash
npm run generate-certs
```

### Port Already in Use
If port 3000 is busy, modify `server.js` to use a different port:
```javascript
}).listen(3001, (err) => {
  // Change 3000 to 3001 or any available port
```

### Environment Variables
Make sure your `.env.local` has:
```env
SPOTIFY_REDIRECT_URI=https://localhost:3000/api/spotify/callback
```

## Testing the Fix

1. Start HTTPS server: `npm run dev:https`
2. Go to: https://localhost:3000/admin
3. Login and try Spotify authentication
4. Should now work without 504 timeouts!
