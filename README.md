# 🎉 Party DJ Request System

A modern web application that allows party guests to request songs via a public website. Requests appear in an admin panel for the DJ, who can approve or reject them. Approved songs are automatically added to the Spotify playback queue and a designated "Party Playlist".

## 🚀 Features

### For Guests
- **Public Request Interface**: Clean, mobile-friendly interface accessible via QR code or link
- **Song Search**: Search Spotify's catalog by song title, artist, or album
- **Spotify Link Support**: Paste Spotify track URLs directly
- **Rate Limiting**: Prevents spam (1 request per 30 seconds, max 10 per hour)
- **Optional Nickname**: Guests can optionally provide their name

### For DJs/Admins
- **Secure Admin Panel**: Password-protected dashboard for request management
- **Live Request Feed**: Real-time view of pending, approved, and rejected requests
- **Spotify Integration**: Direct control over playback queue and playlists
- **Playback Controls**: Skip tracks, pause/resume playback
- **Statistics Dashboard**: Track request volumes and popular artists
- **Device Management**: View and control Spotify-connected devices

### Technical Features
- **OAuth2 PKCE Flow**: Secure Spotify authentication
- **Rate Limiting**: Prevents abuse and spam
- **Modern UI**: Responsive design with Tailwind CSS
- **Real-time Updates**: Admin panel refreshes automatically
- **Database Logging**: All requests stored with full audit trail

## 🏗️ Architecture

**🚀 NEW: Vercel-Only Deployment!**

```
/party-playlist-request
└── /frontend         # Everything in one Next.js app!
    ├── /src/app
    │   ├── /api      # Backend API routes (serverless)
    │   ├── /admin    # Admin dashboard pages
    │   └── page.tsx  # Guest interface
    ├── /src/lib      # Shared utilities (DB, Spotify, Auth)
    └── vercel.json   # Vercel configuration
```

**Database**: Vercel KV (Redis) - No separate database server needed!  
**Backend**: Next.js API routes - No separate backend server needed!  
**Deployment**: Single Vercel deployment - Simple and cost-effective!

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Spotify Developer Account
- Spotify Premium (required for playback control)

### 1. Clone and Install Dependencies

```bash
# Install dependencies (everything is in frontend now!)
cd frontend
npm install
```

### 2. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app with these settings:
   - **App Name**: Party DJ Request System
   - **App Description**: Song request system for parties
   - **Website**: Your domain (or http://localhost:3000 for development)
   - **Redirect URI**: `http://localhost:3001/api/spotify/callback`
   - **APIs Used**: Web API

3. Note your **Client ID** and **Client Secret**

### 3. Environment Configuration

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` with your settings:
```env
# Spotify API Configuration
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Admin Password
ADMIN_PASSWORD=your-admin-password

# Vercel KV (for production - get from Vercel dashboard)
# KV_REST_API_URL=your-kv-rest-api-url
# KV_REST_API_TOKEN=your-kv-rest-api-token
```

### 4. Start the Application

```bash
# Start the application (from /frontend directory)
npm run dev
```

The application will be available at:
- **Guest Interface**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **API Endpoints**: http://localhost:3000/api/*

### 5. Initial Setup

1. **Login to Admin Panel**:
   - Go to http://localhost:3000/admin
   - Username: `admin`
   - Password: (what you set in ADMIN_PASSWORD)

2. **Connect Spotify**:
   - In admin panel, you'll need to authenticate with Spotify
   - This requires the backend API endpoints for Spotify OAuth

3. **Configure Party Playlist**:
   - Create or select a Spotify playlist for approved songs
   - Set the playlist ID in admin settings

## 📱 Usage

### For Party Hosts

1. **Setup**: Complete the installation and Spotify authentication
2. **Share Access**: Generate a QR code pointing to your domain
3. **Monitor Requests**: Use the admin panel to approve/reject requests
4. **Control Playback**: Skip tracks, pause/resume from the admin interface

### For Guests

1. **Access**: Scan QR code or visit the public URL
2. **Search**: Use the search bar to find songs
3. **Request**: Click "Request" on any song or paste a Spotify link
4. **Wait**: Requests appear instantly in the DJ's admin panel

## 🔧 API Endpoints

### Guest Endpoints
- `POST /api/request` - Submit a song request
- `GET /api/search` - Search Spotify catalog
- `GET /api/track/:id` - Get track information
- `GET /api/status` - Get public system status

### Admin Endpoints
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/requests` - Get requests (with filtering)
- `POST /api/admin/approve/:id` - Approve a request
- `POST /api/admin/reject/:id` - Reject a request
- `GET /api/admin/queue` - Get current playback state
- `GET /api/admin/stats` - Get system statistics

### Spotify Endpoints
- `GET /api/spotify/auth` - Start OAuth flow
- `POST /api/spotify/callback` - Handle OAuth callback
- `GET /api/spotify/status` - Check authentication status
- `GET /api/spotify/playlists` - Get user playlists

## 🚀 Deployment

### **🎯 Vercel-Only Deployment (Recommended)**

**Everything runs on Vercel - no separate backend needed!**

1. **Set up Vercel KV**:
   - Go to Vercel dashboard → Storage → Create KV database
   - Copy the connection details

2. **Deploy to Vercel**:
   - Import your GitHub repo to Vercel
   - Set **Root Directory**: `frontend`
   - Add all environment variables (see above)
   - Deploy!

3. **Update Spotify app**:
   - Redirect URI: `https://your-app.vercel.app/api/spotify/callback`
   - Website: `https://your-app.vercel.app`

**Cost**: Likely **$0** with Vercel's free tier! 🎉

**See `VERCEL-ONLY-SETUP.md` for detailed instructions.**

## 🛡️ Security Features

- **JWT Authentication**: Secure admin sessions
- **Rate Limiting**: Prevents request spam
- **IP Hashing**: Guest IPs are hashed for privacy
- **CORS Protection**: Restricts API access to your frontend
- **Input Validation**: All requests are validated
- **SQL Injection Prevention**: Parameterized queries used throughout

## 🎵 Spotify Requirements

- **Spotify Premium**: Required for playback control
- **Active Device**: Spotify must be playing on a device (phone, computer, etc.)
- **Scopes Required**:
  - `user-modify-playback-state`
  - `user-read-playback-state`
  - `user-read-currently-playing`
  - `playlist-modify-public`
  - `playlist-modify-private`

## 🐛 Troubleshooting

### Common Issues

1. **"No active device" error**:
   - Open Spotify on any device and start playing music
   - Refresh the admin panel

2. **Spotify authentication fails**:
   - Check your Client ID and Client Secret
   - Verify redirect URI matches exactly
   - Ensure your Spotify app is not in development mode restrictions

3. **Search not working**:
   - Verify Spotify authentication is complete
   - Check backend logs for API errors

4. **Requests not appearing**:
   - Check rate limiting (wait 30 seconds between requests)
   - Verify backend is running and accessible

### Logs

- **Backend logs**: Check your backend console/hosting platform logs
- **Frontend errors**: Check browser developer console
- **Database issues**: Check if SQLite file has proper permissions

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🎉 Credits

Built with:
- **Backend**: Node.js, Express, SQLite
- **Frontend**: Next.js, React, Tailwind CSS
- **APIs**: Spotify Web API
- **Authentication**: JWT, bcrypt

---

**Enjoy your party! 🎵🎉**