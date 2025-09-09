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

```
/party-dj-request
├── /backend          # Node.js/Express API server
│   ├── /routes       # API route handlers
│   ├── /services     # Business logic (Spotify, Auth)
│   ├── /db           # Database schema and utilities
│   └── server.js     # Main server file
├── /frontend         # Next.js React application
│   └── /src/app      # App router pages
└── README.md         # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Spotify Developer Account
- Spotify Premium (required for playback control)

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
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

#### Backend (.env)
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your settings:
```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./db/party_dj.db

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Admin Password
ADMIN_PASSWORD=your-admin-password

# Spotify API Configuration
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:3001/api/spotify/callback
```

#### Frontend (.env.local)
```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Start the Application

```bash
# Start backend (from /backend directory)
npm run dev

# Start frontend (from /frontend directory)
npm run dev
```

The application will be available at:
- **Guest Interface**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Backend API**: http://localhost:3001

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

### Backend Deployment (Heroku/Railway/Fly.io)

1. **Prepare for deployment**:
   ```bash
   cd backend
   # Ensure package.json has correct start script
   ```

2. **Set environment variables** on your hosting platform

3. **Deploy** using your platform's CLI or Git integration

### Frontend Deployment (Vercel/Netlify)

1. **Connect your Git repository**
2. **Set build settings**:
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. **Configure environment variables**:
   - `NEXT_PUBLIC_API_URL` = your backend URL

### Production Considerations

- **HTTPS Required**: Spotify Web API requires HTTPS in production
- **CORS Configuration**: Update CORS settings for your domain
- **Database**: Consider PostgreSQL for production (SQLite works for small deployments)
- **Rate Limiting**: Adjust limits based on your party size
- **Monitoring**: Add logging and error tracking

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