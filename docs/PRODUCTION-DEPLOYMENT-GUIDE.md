# 🚀 Production Deployment Guide

**Date:** October 9, 2025  
**Status:** Ready for Production Deployment  
**Branch:** `main` (merged from `phase1/auth-and-landing`)

---

## ✅ Pre-Deployment Checklist

### 1. Code Status
- ✅ All changes merged to `main` branch
- ✅ All changes pushed to GitHub
- ✅ Working tree clean
- ✅ 142 files changed, ~20,000 lines added

### 2. What's New in Production
- ✅ Multi-tenant architecture (users can have their own admin panels)
- ✅ JWT-based authentication
- ✅ User registration system (currently disabled)
- ✅ Super admin panel for user management
- ✅ Complete Spotify color theme (black & green)
- ✅ Email verification system (requires Resend API)
- ✅ Password reset functionality
- ✅ PIN/Token authentication for public pages

---

## 🗄️ Database Migrations Required

**CRITICAL:** You must run these migrations in order on your production database!

### Migration 1: Multi-Tenancy (REQUIRED)
```bash
node migrations/run-production-migration.js
```
This adds:
- `users` table
- `user_id` columns to all tables
- Indexes for performance
- Creates default user from existing data

### Migration 2: User Events (REQUIRED)
```bash
node migrations/run-hotfix-migration.js
```
This adds:
- `user_events` table for event management
- PIN system
- Event status tracking

### Migration 3: Spotify Auth (REQUIRED)
```bash
node migrations/run-spotify-migration.js
```
This adds:
- `spotify_tokens` table
- User-specific Spotify authentication

### Migration 4: Account Management (OPTIONAL - For Registration)
```bash
node migrations/run-account-management-migration.js
```
This adds:
- Email verification columns
- Password reset tokens table
- User sessions table
- Account status tracking

### Migration 5: Super Admin (REQUIRED)
```bash
node migrations/run-super-admin-migration.js
```
This adds:
- `role` column to users table
- Super admin capabilities

---

## 🔐 Environment Variables Required

Add these to your Vercel production environment:

### Existing Variables (Verify These)
```env
DATABASE_URL=your_production_postgres_url
JWT_SECRET=your_strong_jwt_secret_here
PUSHER_APP_ID=your_pusher_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### New Variables (Optional - For Registration)
```env
# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@your-domain.com

# App URLs
NEXT_PUBLIC_BASE_URL=https://your-production-domain.com
```

---

## 📋 Deployment Steps

### Step 1: Push to GitHub ✅ DONE
```bash
# Already completed!
git checkout main
git merge phase1/auth-and-landing
git push origin main
```

### Step 2: Vercel Automatic Deployment
Vercel should automatically deploy when you push to `main`. Check:
- Go to https://vercel.com/your-username/party-playlist-request
- Look for the new deployment in progress
- Wait for build to complete

### Step 3: Run Database Migrations
**IMPORTANT:** Do this BEFORE accessing the production site!

Option A: Run locally pointing to production database
```bash
# In your local terminal
# Make sure DATABASE_URL points to production in .env.local temporarily
node migrations/run-production-migration.js
node migrations/run-hotfix-migration.js
node migrations/run-spotify-migration.js
node migrations/run-super-admin-migration.js
```

Option B: Use Vercel CLI
```bash
vercel env pull .env.production
# Then run migrations with production DATABASE_URL
```

### Step 4: Create Your Super Admin Account
```bash
# After migrations, promote your user to superadmin
node migrations/set-superadmin-role.js your-username

# Or if you need to create a new user first:
# 1. Login to production
# 2. Go to /superadmin (you'll be redirected to login)
# 3. Run the script above
# 4. Login again
```

### Step 5: Verify Deployment
Visit these URLs in production:

1. **Landing Page:** `https://your-domain.com/`
   - Should show Spotify-themed landing page
   
2. **Login:** `https://your-domain.com/login`
   - Should show login form with Spotify colors
   
3. **Super Admin:** (after promotion)
   - Login with your superadmin account
   - Should redirect to `/superadmin`
   - Create a test user
   
4. **User Admin Panel:** `https://your-domain.com/testuser/admin/overview`
   - Login as test user
   - Should see admin panel with Spotify theme
   
5. **Request Page:** `https://your-domain.com/testuser/request`
   - Should show PIN entry or 'Party Not Started'
   
6. **Display Page:** `https://your-domain.com/testuser/display`
   - Should show display screen

---

## 🧪 Post-Deployment Testing

### Critical Path Tests

1. **Super Admin Flow**
   - [ ] Login as superadmin
   - [ ] Access `/superadmin`
   - [ ] Create a new user
   - [ ] Edit user details
   - [ ] Verify user list loads

2. **User Authentication**
   - [ ] Login as regular user
   - [ ] Redirects to `/:username/admin/overview`
   - [ ] Can access all admin pages
   - [ ] Logout works

3. **Event Management**
   - [ ] Create/start event (generates PIN)
   - [ ] Event status changes (Offline → Standby → Live)
   - [ ] Page controls work (enable/disable request/display)
   - [ ] PIN authentication on request page

4. **Spotify Integration**
   - [ ] Connect Spotify account
   - [ ] View devices
   - [ ] Search for songs
   - [ ] Submit request
   - [ ] Approve request
   - [ ] Song added to queue

5. **Display Screen**
   - [ ] Access display page with token
   - [ ] Shows current song
   - [ ] Shows approved requests
   - [ ] Updates in real-time

6. **Real-Time Updates (Pusher)**
   - [ ] Open admin in two browsers
   - [ ] Change event status in one
   - [ ] Verify it updates in the other
   - [ ] Test with different users (should be isolated)

---

## ⚠️ Known Issues & Limitations

### Current State
1. **Registration Disabled:** Public registration is turned off
   - Only superadmin can create accounts
   - This is intentional until you set up payment system

2. **Email Service:** Requires Resend API key
   - Not needed for basic functionality
   - Only needed if you enable registration later

3. **Spotify Watcher:** Some Pusher events disabled
   - `spotify-watcher` route has TODOs for per-user refactor
   - Non-critical, doesn't affect main functionality

### Migration Considerations
1. **Existing Data:** 
   - Migration 1 will migrate your existing single-user data
   - All existing requests will be assigned to the default user
   - Existing Spotify tokens will be migrated

2. **Pusher Channels:**
   - Old global channels will still exist
   - New user-specific channels are now used
   - No conflicts, but old channels can be ignored

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong:

### Option 1: Revert on Vercel
1. Go to Vercel dashboard
2. Find previous deployment (before merge)
3. Click "Redeploy"
4. This WILL NOT revert database changes

### Option 2: Revert Git
```bash
git revert HEAD
git push origin main
```

### Option 3: Database Rollback
**CAUTION:** Only do this if you backed up your database first!
- Restore from backup taken before migration
- You'll lose any new data created after deployment

---

## 📊 Monitoring After Deployment

### Things to Watch

1. **Error Logs:**
   - Check Vercel function logs for errors
   - Look for authentication failures
   - Watch for database connection issues

2. **Performance:**
   - Page load times
   - API response times
   - Pusher connection status

3. **User Issues:**
   - Can users login?
   - Are events being created?
   - Is Spotify connecting?

### Vercel Dashboard
- Go to: https://vercel.com/your-username/party-playlist-request
- Check "Functions" tab for API errors
- Check "Analytics" for performance
- Check "Logs" for real-time issues

---

## 🎯 Next Steps After Deployment

### Immediate (Day 1)
1. [ ] Run all migrations
2. [ ] Create your superadmin account
3. [ ] Create 1-2 test users
4. [ ] Test the complete flow end-to-end
5. [ ] Monitor for errors for 24 hours

### Short Term (Week 1)
1. [ ] Invite beta testers (if any)
2. [ ] Test with real Spotify usage
3. [ ] Monitor Pusher usage/limits
4. [ ] Check database performance
5. [ ] Set up error monitoring (Sentry?)

### Medium Term (Month 1)
1. [ ] Decide on payment/subscription model
2. [ ] Enable public registration (if desired)
3. [ ] Set up Resend for emails
4. [ ] Create Terms of Service page
5. [ ] Create Privacy Policy page
6. [ ] Plan Phase 3 features

---

## 🆘 Troubleshooting

### Issue: "Authentication required" errors
- Check JWT_SECRET is set in production
- Verify cookies are being set (check HTTPS)
- Check browser console for cookie issues

### Issue: Pusher not connecting
- Verify all Pusher env vars are set
- Check NEXT_PUBLIC_PUSHER_KEY is correct
- Look for CORS issues in console

### Issue: Database connection fails
- Verify DATABASE_URL is correct
- Check database is accessible from Vercel
- Verify SSL settings

### Issue: Spotify not connecting
- Check redirect URI in Spotify dashboard
- Should be: `https://your-domain.com/api/spotify/callback`
- Verify SPOTIFY_CLIENT_ID and SECRET

### Issue: Can't access superadmin
- Run: `node migrations/set-superadmin-role.js your-username`
- Make sure user exists in database
- Try logging out and back in

---

## 📞 Support & Documentation

- **Phase 1 Status:** See `PHASE-1-COMPLETE-STATUS.md`
- **Phase 2 Status:** See `PHASE-2-COMPLETE.md`
- **Spotify Theme:** See `SPOTIFY-THEME-COMPLETE.md`
- **Testing Guide:** See `PHASE-2-TESTING-GUIDE.md`

---

## ✅ Deployment Completion Checklist

Mark these off as you complete them:

- [ ] Code pushed to main branch ✅ (DONE)
- [ ] Vercel deployment completed
- [ ] All 5 database migrations run successfully
- [ ] Super admin account created
- [ ] Production environment variables verified
- [ ] Landing page accessible
- [ ] Login working
- [ ] Super admin panel accessible
- [ ] Test user created via super admin
- [ ] Test user can login and access admin
- [ ] Event creation working (PIN generated)
- [ ] Spotify connection working
- [ ] Request submission working
- [ ] Display screen working
- [ ] Real-time updates working (Pusher)
- [ ] No errors in Vercel logs
- [ ] 24-hour monitoring completed

---

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ All migrations complete without errors
2. ✅ You can login as superadmin
3. ✅ You can create a new user
4. ✅ New user can login and access their admin panel
5. ✅ User can connect Spotify
6. ✅ User can create an event and get a PIN
7. ✅ Request page works with PIN
8. ✅ Display page shows real-time updates
9. ✅ Everything has Spotify black/green theme
10. ✅ No errors in production logs

---

**Good luck with your deployment! 🚀**

If you encounter any issues, check the troubleshooting section or review the detailed documentation in the repo.

