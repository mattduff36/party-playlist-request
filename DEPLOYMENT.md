# 🚀 Deployment Guide

This guide covers different deployment options for the Party DJ Request System.

## 🐳 Docker Deployment (Recommended)

### Prerequisites
- Docker and Docker Compose installed
- Spotify Developer App configured

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd party-dj-request
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Spotify credentials
   ```

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Guest Interface: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

### Production Docker Deployment

For production, update your `.env` file with production URLs:

```env
JWT_SECRET=your-super-secure-random-string
ADMIN_PASSWORD=your-secure-admin-password
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://your-backend-domain.com/api/spotify/callback
```

## ☁️ Cloud Deployment Options

### Option 1: Vercel (Frontend) + Railway/Heroku (Backend)

#### Backend on Railway

1. **Connect your GitHub repository to Railway**
2. **Set environment variables**:
   ```env
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-vercel-app.vercel.app
   JWT_SECRET=your-super-secure-random-string
   ADMIN_PASSWORD=your-secure-admin-password
   SPOTIFY_CLIENT_ID=your-spotify-client-id
   SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
   SPOTIFY_REDIRECT_URI=https://your-railway-app.railway.app/api/spotify/callback
   DATABASE_PATH=/app/db/party_dj.db
   ```
3. **Deploy from the `/backend` directory**

#### Frontend on Vercel

1. **Connect your GitHub repository to Vercel**
2. **Set build settings**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. **Set environment variables**:
   ```env
   NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app/api
   ```

### Option 2: DigitalOcean App Platform

1. **Create a new app from your GitHub repository**
2. **Configure the backend service**:
   - Source Directory: `/backend`
   - Build Command: `npm install`
   - Run Command: `npm start`
   - Environment Variables: (same as Railway above)
3. **Configure the frontend service**:
   - Source Directory: `/frontend`
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Environment Variables: `NEXT_PUBLIC_API_URL`

### Option 3: AWS/GCP/Azure

Use Docker containers with your preferred container orchestration service:
- AWS: ECS, EKS, or App Runner
- GCP: Cloud Run or GKE
- Azure: Container Instances or AKS

## 🔧 Production Considerations

### Database
- **SQLite**: Fine for small parties (< 100 guests)
- **PostgreSQL**: Recommended for larger deployments
- **Backup**: Ensure regular database backups

### Security
- **HTTPS**: Required for Spotify Web API in production
- **Environment Variables**: Never commit secrets to Git
- **Rate Limiting**: Adjust based on expected traffic
- **CORS**: Update allowed origins for your domain

### Performance
- **CDN**: Use a CDN for static assets
- **Caching**: Implement Redis for session storage
- **Monitoring**: Add logging and error tracking
- **Health Checks**: Implement proper health check endpoints

### Spotify Configuration

Update your Spotify app settings for production:
1. **Redirect URIs**: Add your production callback URL
2. **Website**: Update to your production domain
3. **Rate Limits**: Monitor Spotify API usage

## 📱 Mobile Optimization

The application is mobile-responsive, but consider:
- **PWA**: Add service worker for offline functionality
- **QR Codes**: Generate QR codes pointing to your production URL
- **Deep Links**: Consider Spotify deep links for mobile users

## 🔍 Monitoring & Logging

### Recommended Tools
- **Application Monitoring**: Sentry, LogRocket
- **Server Monitoring**: DataDog, New Relic
- **Uptime Monitoring**: Pingdom, UptimeRobot

### Key Metrics to Track
- Request submission rate
- Approval/rejection ratios
- Spotify API response times
- User engagement (searches, requests)
- Error rates and types

## 🛠️ Maintenance

### Regular Tasks
- **Database Cleanup**: Remove old requests periodically
- **Log Rotation**: Implement log rotation to save disk space
- **Security Updates**: Keep dependencies updated
- **Spotify Token Refresh**: Monitor token expiration

### Backup Strategy
```bash
# Database backup script
cp /path/to/party_dj.db /backups/party_dj_$(date +%Y%m%d).db

# Environment variables backup
cp .env /backups/env_$(date +%Y%m%d).backup
```

## 🚨 Troubleshooting Production Issues

### Common Production Issues

1. **CORS Errors**:
   - Update `FRONTEND_URL` in backend environment
   - Check browser console for specific CORS messages

2. **Spotify Authentication Failures**:
   - Verify redirect URI matches exactly
   - Check Spotify app is not in development mode
   - Ensure HTTPS is used in production

3. **Database Connection Issues**:
   - Check file permissions for SQLite
   - Verify database directory exists and is writable

4. **High Memory Usage**:
   - Implement request cleanup
   - Add memory limits to Docker containers
   - Monitor for memory leaks

### Emergency Procedures

1. **Service Down**:
   ```bash
   # Quick restart
   docker-compose restart
   
   # Check logs
   docker-compose logs -f
   ```

2. **Database Corruption**:
   ```bash
   # Restore from backup
   cp /backups/party_dj_YYYYMMDD.db /app/db/party_dj.db
   docker-compose restart backend
   ```

3. **Spotify API Issues**:
   - Check Spotify Developer Dashboard for service status
   - Verify API quotas haven't been exceeded
   - Re-authenticate if necessary

## 📞 Support

For deployment issues:
1. Check the logs first
2. Review environment variable configuration
3. Test Spotify authentication separately
4. Verify network connectivity between services

---

**Happy Deploying! 🎉**