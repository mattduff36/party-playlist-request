# 🎵 Spotify App Setup Instructions

## **Step-by-Step Spotify Developer App Creation**

### **1. Go to Spotify Developer Dashboard**
- Open: https://developer.spotify.com/dashboard
- Click "Log In" and sign in with your Spotify account

### **2. Create New App**
Click the green "Create App" button and fill in:

```
App Name: Party DJ Request System
App Description: Web application for party song requests with DJ approval system
Website: http://localhost:3000
Redirect URI: http://localhost:3001/api/spotify/callback
Which API/SDKs are you planning to use: Web API
```

### **3. Get Your Credentials**
After creating the app:
1. Copy your **Client ID** (visible on the main page)
2. Click "View client secret" and copy your **Client Secret**
3. **KEEP THESE SECURE** - never share them publicly!

### **4. Update Your Configuration**

Replace the values in `/backend/.env`:

```env
SPOTIFY_CLIENT_ID=your_actual_client_id_here
SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
```

### **5. Important Spotify Requirements**

#### **For Development:**
- ✅ Any Spotify account works
- ✅ Free or Premium account for testing search
- ⚠️ **Premium account REQUIRED for playback control**

#### **For Production:**
- Update Redirect URI to: `https://your-backend-domain.com/api/spotify/callback`
- Update Website to: `https://your-frontend-domain.com`
- Submit for quota extension if needed (25+ users)

### **6. Required Spotify Scopes**
Your app will request these permissions:
- `user-modify-playback-state` - Add songs to queue
- `user-read-playback-state` - Check what's playing
- `user-read-currently-playing` - Get current track info
- `playlist-modify-public` - Add songs to public playlists
- `playlist-modify-private` - Add songs to private playlists
- `user-read-private` - Get user profile info

### **7. Testing Your Setup**

1. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test the connection**:
   - Go to http://localhost:3000/admin
   - Login with admin/admin123
   - Look for Spotify connection status

### **8. First-Time Spotify Authentication**

When you first connect Spotify in the admin panel:

1. **Click the Spotify auth button** (will be added to admin panel)
2. **You'll be redirected to Spotify** to grant permissions
3. **Accept the permissions** for your app
4. **You'll be redirected back** to your app with authentication complete

### **9. Troubleshooting Common Issues**

#### **"Invalid redirect URI" error:**
- Make sure the redirect URI in your Spotify app settings exactly matches: `http://localhost:3001/api/spotify/callback`
- No trailing slashes, exact case match

#### **"Invalid client" error:**
- Double-check your Client ID and Client Secret
- Make sure there are no extra spaces when copying

#### **"Premium required" error:**
- Playback control (skip, pause, add to queue) requires Spotify Premium
- Search functionality works with free accounts

#### **"No active device" error:**
- Open Spotify on any device (phone, computer, etc.)
- Start playing any song
- The device will then appear as available for control

### **10. Production Deployment**

When deploying to production:

1. **Update Spotify App Settings**:
   - Add production redirect URI: `https://your-backend-domain.com/api/spotify/callback`
   - Update website URL to your production frontend URL

2. **Update Environment Variables**:
   ```env
   SPOTIFY_REDIRECT_URI=https://your-backend-domain.com/api/spotify/callback
   ```

3. **HTTPS Required**:
   - Spotify Web API requires HTTPS in production
   - Use services like Vercel, Netlify, or add SSL certificates

### **11. Quota Limits**

- **Development Mode**: Up to 25 users
- **Extended Quota**: Request if you need more users
- **Rate Limits**: 100 requests per minute per user

---

## **Quick Setup Checklist**

- [ ] Created Spotify Developer account
- [ ] Created new app with correct settings
- [ ] Copied Client ID and Client Secret
- [ ] Updated `/backend/.env` file
- [ ] Tested backend starts without errors
- [ ] Tested frontend starts without errors
- [ ] Can access admin panel at http://localhost:3000/admin
- [ ] Have Spotify Premium for full functionality (optional for testing search)

---

**Need Help?** 
- Check the troubleshooting section above
- Verify all URLs match exactly
- Make sure Spotify app is not in "Development Mode" restrictions if you have issues