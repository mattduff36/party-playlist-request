# 🚀 **Vercel Deployment Guide**

## **Deployment Architecture**

```
Frontend (Vercel) ←→ Backend (Railway/Render) ←→ Spotify API
     ↓                        ↓
  Static Files          Database + API
```

## **Step 1: Deploy Backend First**

You need to deploy your backend API server before the frontend. Here are your options:

### **Option A: Railway (Recommended)**
1. Go to [Railway.app](https://railway.app)
2. Connect your GitHub repository
3. Select "Deploy from GitHub repo"
4. Choose **root directory** (not frontend folder)
5. Railway will auto-detect it's a Node.js app

### **Option B: Render**
1. Go to [Render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repository
4. Set **Root Directory**: `backend`
5. **Build Command**: `npm install`
6. **Start Command**: `npm start`

### **Option C: Heroku**
```bash
# From your project root
heroku create your-party-dj-api
git subtree push --prefix backend heroku main
```

## **Step 2: Configure Backend Environment Variables**

In your backend hosting platform, add these environment variables:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
DATABASE_PATH=/app/db/party_dj.db
JWT_SECRET=your-super-secure-random-string-here
ADMIN_PASSWORD=your-secure-admin-password
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://your-backend-url.com/api/spotify/callback
```

**Important**: Replace `your-backend-url.com` with your actual backend URL from Railway/Render/Heroku.

## **Step 3: Deploy Frontend to Vercel**

### **Method 1: Vercel Dashboard (Recommended)**

1. **Go to [Vercel.com](https://vercel.com)**
2. **Click "Add New Project"**
3. **Import your GitHub repository**
4. **Configure the project**:
   - **Framework Preset**: Next.js ✓
   - **Root Directory**: `frontend` ⚠️ (Important!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. **Add Environment Variables** (see below)
6. **Click Deploy**

### **Method 2: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# From the frontend directory
cd frontend
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? party-dj-frontend
# - Directory? ./
# - Override settings? No
```

## **Step 4: Vercel Environment Variables**

In your Vercel project settings, add these environment variables:

### **Required Variables:**
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
```

### **Optional (for better performance):**
```env
NODE_ENV=production
```

**⚠️ Critical**: Replace `your-backend-url.com` with your actual backend URL from Step 1.

## **Step 5: Update Spotify App Settings**

In your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):

1. **Edit your app settings**
2. **Add production redirect URI**:
   ```
   https://your-backend-url.com/api/spotify/callback
   ```
3. **Update website URL**:
   ```
   https://your-vercel-app.vercel.app
   ```

## **Step 6: Test Your Deployment**

1. **Visit your Vercel URL**: `https://your-vercel-app.vercel.app`
2. **Test guest interface**: Search for songs, submit requests
3. **Test admin panel**: `https://your-vercel-app.vercel.app/admin`
4. **Test Spotify connection**: Go to Spotify Setup in admin panel

## **🔧 Vercel Configuration Files**

I've created these files for you:

### **`frontend/vercel.json`**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 10
    }
  }
}
```

### **`frontend/next.config.ts`** (already configured)
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: []
  }
};
```

## **🚨 Common Issues & Solutions**

### **"API calls failing" Error**
- Check that `NEXT_PUBLIC_API_URL` points to your backend URL
- Verify backend is deployed and running
- Check CORS settings in backend

### **"Build failed" Error**
- Make sure Root Directory is set to `frontend`
- Check that all dependencies are in `frontend/package.json`
- Verify Node.js version compatibility

### **"Spotify authentication fails" Error**
- Update Spotify app redirect URI to production backend URL
- Check backend environment variables are set correctly
- Verify HTTPS is used (required for Spotify in production)

## **📊 Deployment Checklist**

### **Backend Deployment:**
- [ ] Backend deployed to Railway/Render/Heroku
- [ ] Environment variables configured
- [ ] Database initialized
- [ ] API accessible at `/health` endpoint
- [ ] CORS configured for Vercel frontend URL

### **Frontend Deployment:**
- [ ] Vercel project created with `frontend` as root directory
- [ ] `NEXT_PUBLIC_API_URL` environment variable set
- [ ] Build completes successfully
- [ ] Site accessible and loads correctly

### **Spotify Integration:**
- [ ] Production redirect URI added to Spotify app
- [ ] Production website URL updated in Spotify app
- [ ] Spotify authentication tested in production
- [ ] Playlist creation works in production

### **End-to-End Testing:**
- [ ] Guest can search and request songs
- [ ] Admin can login and see requests
- [ ] Admin can connect Spotify account
- [ ] Approved requests add to Spotify queue/playlist
- [ ] Playback controls work (skip, pause, resume)

## **🔗 Useful Commands**

### **Update Vercel deployment:**
```bash
# From frontend directory
vercel --prod
```

### **View Vercel logs:**
```bash
vercel logs
```

### **Check environment variables:**
```bash
vercel env ls
```

### **Add environment variable:**
```bash
vercel env add NEXT_PUBLIC_API_URL
```

## **💡 Pro Tips**

1. **Use Vercel's Preview Deployments**: Every git push creates a preview URL for testing
2. **Set up Custom Domain**: Add your own domain in Vercel project settings
3. **Monitor Performance**: Use Vercel Analytics to track usage
4. **Enable Speed Insights**: Add `@vercel/speed-insights` for performance monitoring

---

**Your URLs will be:**
- **Frontend**: `https://your-project-name.vercel.app`
- **Admin Panel**: `https://your-project-name.vercel.app/admin`
- **Backend API**: `https://your-backend-service.railway.app` (or similar)

**Happy deploying! 🎉**