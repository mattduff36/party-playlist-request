# 🔐 **Environment Variables for Deployment**

## **Backend Environment Variables** 
**(Railway/Render/Heroku)**

Copy and paste these into your backend hosting platform:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app
DATABASE_PATH=/app/db/party_dj.db
JWT_SECRET=party-dj-super-secret-key-change-this-in-production
ADMIN_PASSWORD=your-secure-admin-password-here
SPOTIFY_CLIENT_ID=your-spotify-client-id-from-developer-dashboard
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret-from-developer-dashboard
SPOTIFY_REDIRECT_URI=https://your-backend-url.railway.app/api/spotify/callback
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=us2
```

### **⚠️ Important Notes:**
- Replace `your-vercel-app` with your actual Vercel app name
- Replace `your-backend-url` with your actual backend URL
- Use your real Spotify credentials from the developer dashboard
- Get Pusher credentials from https://pusher.com (free tier available)
- Generate a secure JWT_SECRET (use a random string generator)
- Choose a secure admin password

---

## **Frontend Environment Variables**
**(Vercel)**

Add this in your Vercel project settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

### **⚠️ Important Notes:**
- Replace `your-backend-url` with your actual backend URL from Railway/Render
- This must be the full API URL including `/api` at the end
- Must start with `NEXT_PUBLIC_` to be available in the browser

---

## **Step-by-Step Variable Setup**

### **1. Backend Variables (Railway Example)**

1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add each variable one by one:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_URL` | `https://your-vercel-app.vercel.app` |
| `DATABASE_PATH` | `/app/db/party_dj.db` |
| `JWT_SECRET` | `your-secure-random-string` |
| `ADMIN_PASSWORD` | `your-admin-password` |
| `SPOTIFY_CLIENT_ID` | `your-spotify-client-id` |
| `SPOTIFY_CLIENT_SECRET` | `your-spotify-client-secret` |
| `SPOTIFY_REDIRECT_URI` | `https://your-backend-url.railway.app/api/spotify/callback` |
| `PUSHER_APP_ID` | `your-pusher-app-id` |
| `PUSHER_KEY` | `your-pusher-key` |
| `PUSHER_SECRET` | `your-pusher-secret` |
| `PUSHER_CLUSTER` | `us2` |

### **2. Frontend Variables (Vercel)**

1. Go to your Vercel project dashboard
2. Go to Settings → Environment Variables
3. Add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend-url.railway.app/api` | Production, Preview, Development |
| `NEXT_PUBLIC_PUSHER_KEY` | `your-pusher-key` | Production, Preview, Development |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `us2` | Production, Preview, Development |

---

## **🔒 Security Best Practices**

### **JWT_SECRET Generation**
Use a cryptographically secure random string:
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### **Admin Password**
- Use a strong password with mixed case, numbers, and symbols
- Don't use common passwords
- Consider using a password manager

### **Spotify Credentials**
- Never commit these to Git
- Keep them secure and don't share
- Regenerate if compromised

### **Pusher Credentials**
- Sign up at https://pusher.com (free tier available)
- Create a new app in your Pusher dashboard
- Copy the App ID, Key, Secret, and Cluster from your app settings
- Use the same Key and Cluster for both backend and frontend

---

## **🔧 URL Pattern Examples**

### **If your backend is on Railway:**
```env
SPOTIFY_REDIRECT_URI=https://party-dj-backend-production.up.railway.app/api/spotify/callback
NEXT_PUBLIC_API_URL=https://party-dj-backend-production.up.railway.app/api
FRONTEND_URL=https://party-dj-frontend.vercel.app
```

### **If your backend is on Render:**
```env
SPOTIFY_REDIRECT_URI=https://party-dj-backend.onrender.com/api/spotify/callback
NEXT_PUBLIC_API_URL=https://party-dj-backend.onrender.com/api
FRONTEND_URL=https://party-dj-frontend.vercel.app
```

### **If your backend is on Heroku:**
```env
SPOTIFY_REDIRECT_URI=https://party-dj-backend.herokuapp.com/api/spotify/callback
NEXT_PUBLIC_API_URL=https://party-dj-backend.herokuapp.com/api
FRONTEND_URL=https://party-dj-frontend.vercel.app
```

---

## **✅ Verification Checklist**

After setting all variables:

- [ ] Backend deploys successfully
- [ ] Backend health check responds at `/health`
- [ ] Frontend builds and deploys on Vercel
- [ ] Frontend can reach backend API
- [ ] Admin login works with your password
- [ ] Spotify authentication redirect works
- [ ] Guest interface can search songs
- [ ] Approved requests add to Spotify queue

---

**Need help?** Check the troubleshooting section in `VERCEL-DEPLOYMENT.md`