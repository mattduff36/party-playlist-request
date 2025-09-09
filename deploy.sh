#!/bin/bash

echo "🚀 Party DJ Request System - Deployment Helper"
echo "================================================"

echo ""
echo "📋 Deployment Checklist:"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d "backend" ] && [ ! -d "frontend" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "1. Backend Deployment Options:"
echo "   🔹 Railway: https://railway.app (Recommended)"
echo "   🔹 Render: https://render.com"
echo "   🔹 Heroku: https://heroku.com"
echo ""

echo "2. Frontend Deployment (Vercel):"
echo "   🔹 Go to: https://vercel.com"
echo "   🔹 Import your GitHub repository"
echo "   🔹 Set Root Directory: 'frontend'"
echo "   🔹 Framework: Next.js"
echo ""

echo "3. Required Environment Variables:"
echo ""
echo "   Backend Variables:"
echo "   ==================="
cat << 'EOF'
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-vercel-app.vercel.app
   DATABASE_PATH=/app/db/party_dj.db
   JWT_SECRET=your-secure-random-string
   ADMIN_PASSWORD=your-admin-password
   SPOTIFY_CLIENT_ID=your-spotify-client-id
   SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
   SPOTIFY_REDIRECT_URI=https://your-backend-url.com/api/spotify/callback
EOF

echo ""
echo "   Frontend Variables (Vercel):"
echo "   ============================="
echo "   NEXT_PUBLIC_API_URL=https://your-backend-url.com/api"
echo ""

echo "4. Spotify App Configuration:"
echo "   🔹 Update redirect URI to: https://your-backend-url.com/api/spotify/callback"
echo "   🔹 Update website to: https://your-vercel-app.vercel.app"
echo ""

echo "5. Testing URLs:"
echo "   🔹 Guest Interface: https://your-vercel-app.vercel.app"
echo "   🔹 Admin Panel: https://your-vercel-app.vercel.app/admin"
echo "   🔹 Backend Health: https://your-backend-url.com/health"
echo ""

echo "📖 For detailed instructions, see:"
echo "   - VERCEL-DEPLOYMENT.md"
echo "   - ENVIRONMENT-VARIABLES.md"
echo ""

# Generate a secure JWT secret
echo "🔐 Here's a secure JWT_SECRET for you:"
node -e "console.log('   JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || echo "   (Install Node.js to generate JWT_SECRET)"
echo ""

echo "🎉 Ready to deploy! Follow the steps above."