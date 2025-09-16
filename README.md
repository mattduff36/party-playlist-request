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
- **Real-time Updates**: Pusher-powered instant updates across all devices
- **Live Animations**: Request approval triggers immediate visual feedback
- **Database Logging**: All requests stored with full audit trail

## 🏗️ Architecture

**🚀 Vercel-Only Deployment - Everything in one Next.js app!**

```
/party-playlist-request
├── /src/app
│   ├── /api          # Backend API routes (serverless)
│   ├── /admin        # Admin dashboard pages
│   └── page.tsx      # Guest interface
├── /src/lib          # Shared utilities (DB, Spotify, Auth)
├── /public           # Static assets
└── vercel.json       # Vercel configuration
```

**Database**: Vercel Postgres (required for both development and production)  
**Backend**: Next.js API routes - No separate backend server needed!  
**Deployment**: Single Vercel deployment - Simple and cost-effective!

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- Spotify Developer Account
- Spotify Premium (required for playback control)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd party-playlist-request

# Install dependencies and setup environment
npm install
./setup-dev.sh

# Or manually:
cp .env.local.example .env.local
# Edit .env.local with your Spotify credentials
```

### 2. Spotify App Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app with these settings:
   - **App Name**: Party DJ Request System
   - **App Description**: Song request system for parties
   - **Website**: Your domain (or http://localhost:3000 for development)
   - **Redirect URI**: `http://localhost:3000/api/spotify/callback`
   - **APIs Used**: Web API

3. Note your **Client ID** and **Client Secret**

> **⚠️ Important**: If you encounter API rate limiting or authentication issues during development, create a separate Spotify app for testing/production to avoid conflicts with development API usage. Update your environment variables with the new credentials and redeploy to refresh the authentication tokens.

### 3. Environment Configuration

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

# Database (PostgreSQL - get from Vercel Dashboard -> Storage -> Postgres)
DATABASE_URL=postgres://username:password@host:port/database

# Pusher (Real-time updates) - Get from https://pusher.com/channels
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=your-pusher-cluster

# Public Pusher (Client-side)
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=your-pusher-cluster
```

### 4. Start Development Server

```bash
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
   - In admin panel, go to Spotify Setup
   - Authenticate with your Spotify account

3. **Start Using**:
   - Share the guest URL with party attendees
   - Monitor and approve requests from the admin panel

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

## 🚀 Deployment

### **🎯 Vercel Deployment (Recommended)**

**Everything runs on Vercel - no separate backend needed!**

See `VERCEL-ONLY-SETUP.md` for detailed deployment instructions.

**Cost**: Likely **$0** with Vercel's free tier! 🎉

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

## 🔧 Development Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run type-check   # Run TypeScript type checking
npm run clean        # Clean build cache
npm run dev:debug    # Start dev server with Node.js debugger
```

## 🧪 Testing & Production Notes

### Spotify App Management
- **Development**: Use one Spotify app for local development and testing
- **Production**: Create a separate Spotify app for production deployment
- **Rate Limiting**: Heavy API usage during development can trigger Spotify's rate limiting
- **Fresh Start**: If authentication issues occur, create a new Spotify app with fresh credentials and update your environment variables

### Recent Updates
- **Sept 2025**: 🚀 **MAJOR ARCHITECTURE UPGRADE** - Replaced SSE with Pusher for reliable real-time updates
  - **Pusher Integration**: Rock-solid real-time communication (no more connection drops!)
  - **Instant Animations**: Request approvals trigger immediate visual feedback on display screen
  - **Simplified Architecture**: Eliminated complex SSE/polling fallback system
  - **Better Performance**: No more server-side state management or function timeouts
  - **Cross-Device Reliability**: Consistent real-time updates on all devices
- **Sept 2025**: 🚨 **CRITICAL PERFORMANCE FIX** - Resolved infinite render loop causing endless API calls in production
  - Eliminated useRealtimeProgress hook that was updating every 100ms
  - Optimized state management to prevent unnecessary re-renders
  - Performance improved from 18+ renders/second to 0 renders/second
- **2024**: Created new testing Spotify Web App to resolve potential API rate limiting issues
- Updated Vercel environment variables with new client ID and secret

## 🐛 Troubleshooting

### Common Issues

1. **"No active device" error**:
   - Open Spotify on any device and start playing music
   - Refresh the admin panel

2. **Spotify authentication fails**:
   - Check your Client ID and Client Secret
   - Verify redirect URI matches exactly
   - Ensure your Spotify app is not in development mode restrictions
   - If issues persist, create a new Spotify app with fresh credentials

3. **Search not working**:
   - Verify Spotify authentication is complete
   - Check browser console for API errors

4. **Requests not appearing**:
   - Check rate limiting (wait 30 seconds between requests)
   - Verify API endpoints are accessible

5. **Real-time updates not working**:
   - Check Pusher connection status (green dot in display screen)
   - Verify Pusher environment variables are set correctly
   - Ensure NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER are set

6. **Animations not triggering**:
   - Verify Pusher is connected (green pulsing dot on display screen)
   - Check browser console for Pusher connection logs
   - Ensure request has a requester nickname (animations only for named requests)

## 📄 Documentation

- `VERCEL-ONLY-SETUP.md` - Complete Vercel deployment guide
- `SPOTIFY-SETUP-GUIDE.md` - Detailed Spotify configuration
- `ENVIRONMENT-VARIABLES.md` - Environment variable reference

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Enjoy your party! 🎵🎉**