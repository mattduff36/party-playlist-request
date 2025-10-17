# Environment Variables Configuration

Copy this template to `.env.local` in your project root and fill in your values.

```bash
# ============================================
# DATABASE
# ============================================
# PostgreSQL connection string (Neon, Supabase, or any PostgreSQL provider)
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# ============================================
# SPOTIFY API
# ============================================
# Get these from https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# Where Spotify should redirect after auth (update with your domain)
# Development: http://localhost:3000/api/spotify/callback
# Production: https://yourdomain.com/api/spotify/callback
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback

# ============================================
# PUSHER (Real-time Updates)
# ============================================
# Get these from https://dashboard.pusher.com
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster
PUSHER_APP_ID=your_pusher_app_id
PUSHER_SECRET=your_pusher_secret

# ============================================
# JWT AUTHENTICATION
# ============================================
# Generate a secure random string (use: openssl rand -base64 32)
JWT_SECRET=your_secure_random_jwt_secret_here

# ============================================
# APPLICATION URL
# ============================================
# Your application's base URL
# Development: http://localhost:3000
# Production: https://yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# EMAIL SERVICE (Optional - for password reset)
# ============================================
# SMTP configuration for sending emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password
SMTP_FROM=noreply@partyplaylist.co.uk

# ============================================
# FEATURE FLAGS (Optional)
# ============================================
# Enable monitoring dashboard
ENABLE_MONITORING=false

# Enable Redis caching (requires Redis instance)
ENABLE_REDIS_CACHE=false
REDIS_URL=redis://localhost:6379

# ============================================
# DEVELOPMENT ONLY
# ============================================
# Show debug information in console
NODE_ENV=development
```

## Important Notes

1. **NEVER commit `.env.local` to git** - It's already in `.gitignore`
2. **Store production secrets in Vercel Environment Variables**, not in files
3. **JWT_SECRET must be different** for dev/staging/production environments
4. **SPOTIFY_REDIRECT_URI** must match your Spotify app settings exactly
5. **Pusher keys** starting with `NEXT_PUBLIC_` are exposed to the browser
6. Generate secure JWT_SECRET with: `openssl rand -base64 32`

## Setup Steps

1. Copy this template to `.env.local` in project root
2. Fill in all required values (DATABASE_URL, SPOTIFY_*, PUSHER_*, JWT_SECRET)
3. Update NEXT_PUBLIC_APP_URL to match your domain
4. (Optional) Configure SMTP for password reset emails
5. Restart your development server after changes

## Vercel Deployment

Add these environment variables in Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable for Production, Preview, and Development
3. Deploy to apply changes

