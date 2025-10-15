# Local Development Environment Setup

## Quick Setup for Local Testing

### 1. Create `.env.local` file:
```bash
# Copy your production environment variables or use these for testing:

DATABASE_URL="your_database_url"
ADMIN_USERNAME="admin"  
ADMIN_PASSWORD="your_password"
JWT_SECRET="local_development_secret_key_12345"

# Dummy Spotify credentials (mocked in development)
SPOTIFY_CLIENT_ID="dummy_client_id"
SPOTIFY_CLIENT_SECRET="dummy_client_secret"  
SPOTIFY_REDIRECT_URI="http://localhost:3000/api/spotify/callback"

NODE_ENV="development"
```

### 2. Start Local Testing:
```bash
# Option 1: Use the testing script
node test-local.js

# Option 2: Standard development
npm run dev
```

### 3. Test URLs:
- **Admin Panel**: http://localhost:3000/admin
- **Display Page**: http://localhost:3000/display
- **Mock Spotify Token**: http://localhost:3000/api/debug/mock-spotify-token

### 4. What Works Locally:
✅ **Admin authentication flow**
✅ **SSE connections and real-time updates**  
✅ **Database operations**
✅ **UI state management**
✅ **Mock Spotify token exchange**
✅ **All debugging logs**

### 5. Testing Scenarios:
- **Normal Flow**: Use any authorization code
- **Invalid Grant**: Use code `invalid_grant_test`
- **Invalid Client**: Use code `invalid_client_test`

### 6. Debugging Benefits:
- See all console logs in real-time
- Test authentication without Spotify API limits
- Rapid iteration without deployment delays
- Full access to browser dev tools
