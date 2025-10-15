# 🔐 Environment Variables Checklist

**Date:** October 9, 2025  
**Status:** Migrations Complete ✅  
**Required Action:** Update Vercel Environment Variables  

---

## ✅ Migrations Status

All migrations have been successfully completed:

- ✅ Migration 1: Multi-tenancy (run-production-migration.js)
- ✅ Migration 2: User events (run-hotfix-migration.js)  
- ✅ Migration 3: Spotify tokens (run-spotify-migration-safe.js)
- ✅ Migration 4: Super admin (run-super-admin-migration.js)
- ✅ Super admin user promoted: `superadmin`

**Database is ready for production! 🎉**

---

## 📋 Environment Variables Overview

### ✅ Variables You Already Have (Verify in Vercel)

These should already be set in your Vercel project:

```env
# Database
DATABASE_URL=your_neon_postgres_connection_string

# JWT Authentication
JWT_SECRET=your_secure_random_string_here

# Pusher Real-time
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_pusher_cluster

# Spotify OAuth
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# App URLs
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

---

## 🆕 NEW Variables (Optional - Only if Enabling Registration)

**These are ONLY needed if you want to enable public user registration in the future.**

For now, registration is disabled and only the super admin can create accounts, so these are **optional**.

```env
# Email Service (Resend) - For registration/password reset emails
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=noreply@your-domain.com

# Base URL (alternative to NEXT_PUBLIC_APP_URL)
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com
```

### How to Get Resend API Key (When Needed)

1. Go to https://resend.com
2. Sign up for free account (100 emails/day free tier)
3. Verify your sending domain (or use test mode)
4. Generate API key from dashboard
5. Add to Vercel environment variables

---

## 🎯 Current Setup Recommendation

### For Production Launch (Right Now)

**You DON'T need any new environment variables!**

Your current `.env.local` variables are sufficient because:
- Registration is disabled (invitation-only)
- Super admin creates all accounts manually
- No email verification needed
- No password reset emails needed

### When You're Ready for Public Registration

Add these to Vercel:
- `RESEND_API_KEY` - For sending emails
- `EMAIL_FROM` - Your verified sending address

---

## 🔍 Vercel Environment Variables Setup

### How to Add/Verify Variables in Vercel

1. **Go to Vercel Dashboard**
   ```
   https://vercel.com/your-account/party-playlist-request/settings/environment-variables
   ```

2. **Check Existing Variables**
   Verify these are all set:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PUSHER_APP_ID`
   - `PUSHER_KEY`
   - `PUSHER_SECRET`
   - `NEXT_PUBLIC_PUSHER_KEY`
   - `NEXT_PUBLIC_PUSHER_CLUSTER`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `NEXT_PUBLIC_APP_URL`

3. **Add New Variables (Optional)**
   If you want to enable registration later:
   - Click "Add New"
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key
   - Environment: Production, Preview, Development
   - Click "Save"

4. **Redeploy**
   After adding any new variables, redeploy your app:
   - Go to "Deployments" tab
   - Click "..." on latest deployment
   - Click "Redeploy"

---

## 📝 Variable Descriptions

### Required Variables

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `DATABASE_URL` | PostgreSQL connection | Neon dashboard |
| `JWT_SECRET` | Secure user sessions | Generate random 32+ char string |
| `PUSHER_APP_ID` | Real-time updates | Pusher dashboard |
| `PUSHER_KEY` | Pusher authentication | Pusher dashboard |
| `PUSHER_SECRET` | Pusher server auth | Pusher dashboard |
| `NEXT_PUBLIC_PUSHER_KEY` | Client-side Pusher | Same as PUSHER_KEY |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher region | Pusher dashboard (e.g., "us2") |
| `SPOTIFY_CLIENT_ID` | Spotify OAuth | Spotify Developer Dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth | Spotify Developer Dashboard |
| `NEXT_PUBLIC_APP_URL` | App base URL | Your production domain |

### Optional Variables (Registration)

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `RESEND_API_KEY` | Send verification emails | Resend.com dashboard |
| `EMAIL_FROM` | Email sender address | Your verified domain |
| `NEXT_PUBLIC_BASE_URL` | Alternative base URL | Your production domain |

---

## 🔒 Security Best Practices

### JWT_SECRET
- Should be at least 32 characters
- Use random characters (letters, numbers, symbols)
- Never commit to git
- Generate with: `openssl rand -base64 32`

### Secrets Management
- Never expose secrets in client-side code
- Only variables starting with `NEXT_PUBLIC_` are exposed to client
- Keep API keys and secrets server-side only

---

## ✅ Pre-Launch Checklist

Before going live, verify:

### Database
- [ ] `DATABASE_URL` points to production database
- [ ] All 4 migrations completed successfully
- [ ] Super admin account exists and promoted

### Authentication
- [ ] `JWT_SECRET` is set and secure (32+ chars)
- [ ] Can login to production site
- [ ] Super admin can access `/superadmin`

### Real-Time (Pusher)
- [ ] All Pusher variables set correctly
- [ ] `NEXT_PUBLIC_PUSHER_KEY` matches `PUSHER_KEY`
- [ ] Cluster is correct for your region
- [ ] Pusher connection works in production

### Spotify
- [ ] Spotify redirect URI updated in Spotify Developer Dashboard
- [ ] Should be: `https://your-domain.com/api/spotify/callback`
- [ ] Client ID and Secret are from correct Spotify app
- [ ] Can connect Spotify account in production

### URLs
- [ ] `NEXT_PUBLIC_APP_URL` matches your actual domain
- [ ] Includes https:// protocol
- [ ] No trailing slash

---

## 🧪 Testing After Deployment

### Test 1: Basic Access
```bash
# Visit your production URL
https://your-domain.com/

# Should show Spotify-themed landing page
```

### Test 2: Authentication
```bash
# Login as superadmin
https://your-domain.com/login

# Should redirect to /superadmin after login
```

### Test 3: Super Admin
```bash
# Create a test user
1. Login as superadmin
2. Go to /superadmin
3. Click "Add User"
4. Create test account
```

### Test 4: User Flow
```bash
# Login as test user
1. Logout from superadmin
2. Login with test credentials
3. Should redirect to /:username/admin/overview
4. Start an event (should generate PIN)
5. Connect Spotify
```

### Test 5: Public Pages
```bash
# Test request page
https://your-domain.com/testuser/request

# Should show PIN entry or party status
```

---

## 🆘 Troubleshooting

### Issue: "Cannot connect to database"
- Check `DATABASE_URL` is correct
- Verify database accepts connections from Vercel IPs
- Check SSL settings in connection string

### Issue: "JWT verification failed"
- Verify `JWT_SECRET` is set in Vercel
- Check it matches between environments
- Try logging out and back in

### Issue: "Pusher connection failed"
- Check all Pusher env vars are set
- Verify `NEXT_PUBLIC_PUSHER_KEY` is public (client accessible)
- Check cluster matches your Pusher app region
- Verify key/secret are from same Pusher app

### Issue: "Spotify OAuth fails"
- Update redirect URI in Spotify Developer Dashboard
- Must be: `https://your-domain.com/api/spotify/callback`
- Check Client ID and Secret are correct
- Verify Spotify app is in Development or Extended Quota mode

### Issue: Can't access superadmin
- Run: `node migrations/set-superadmin-role.js your-username`
- Logout and login again
- Check browser console for errors

---

## 📊 Summary

### You're Ready to Deploy! ✅

**Required Actions:**
1. ✅ Migrations completed (all 4)
2. ✅ Super admin promoted
3. ✅ Database ready

**Next Steps:**
1. Verify all existing Vercel env vars are set
2. Deploy to production (should auto-deploy from main branch)
3. Test login as superadmin
4. Create test user accounts
5. Test full user flow

**Optional (For Later):**
- Set up Resend account for email functionality
- Add `RESEND_API_KEY` and `EMAIL_FROM` to Vercel
- Enable public registration

---

## 🎉 Deployment Ready!

Your database is migrated and ready. No new environment variables are required for launch!

Just verify your existing variables in Vercel and you're good to go! 🚀

