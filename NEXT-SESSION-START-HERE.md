# 🚀 Next Session: Start Here!

## 📊 Current Status

**Phase 1:** ✅ **COMPLETE** - Multi-tenant core functionality working
**Phase 2 Backend:** ✅ **COMPLETE** - Registration system APIs ready  
**Phase 2 UI:** ⏳ **PENDING** - Needs UI components

---

## 🎯 What You Need to Know

### Phase 1 is FULLY WORKING! 🎉

All these features are tested and working:
- ✅ **PIN Isolation:** Each user has unique event PIN
- ✅ **Event Status Controls:** Offline/Standby/Live states work correctly
- ✅ **Page Controls:** Enable/disable request and display pages
- ✅ **Multi-Tenancy:** Data completely isolated per user
- ✅ **Real-Time:** Pusher working with user-specific channels
- ✅ **Request Flow:** Submit, approve, manage requests
- ✅ **Display Page:** Shows approved songs and notifications

**Test Users in Database:**
- `newtestuser` (password: `test123`)
- `testuser2024` (password: `test123`)

---

## 🎨 Phase 2 UI: What Needs Building

### 1. Landing Page (Public Homepage) - Priority

**Route:** `/` (root)  
**Purpose:** Public-facing page for new users

**Sections Needed:**
- Hero section with tagline
- Feature highlights (3-4 key features)
- CTA button → Register
- Login link for existing users
- Footer with links

**Copy Ideas:**
- "Create interactive playlist experiences for your parties"
- "Let guests request songs in real-time"
- "Connect your Spotify, share a link, done!"

---

### 2. Registration Page

**Route:** `/register` or `/auth/register`  
**API:** `POST /api/auth/register` ✅ Ready

**Form Fields:**
1. Username
   - Real-time availability check (as user types)
   - Validation: 3-30 chars, lowercase, [a-z0-9_-]
   - Show check mark if available
   - API: `POST /api/auth/check-username`

2. Email
   - Standard email validation
   - Show error if invalid format

3. Password
   - Minimum 8 characters
   - Strength indicator (weak/medium/strong)
   - Show/hide toggle

4. Confirm Password
   - Must match password
   - Real-time validation

5. Terms & Conditions
   - Checkbox: "I agree to Terms and Privacy Policy"
   - Links to (placeholder) pages

**UI States:**
- Loading (submitting)
- Success → Show message "Check your email!"
- Error → Show API error message
- Validation errors → Show inline

**Success Flow:**
1. Submit form
2. Show success message
3. Redirect to `/auth/verify-email-sent?email=xxx`
4. Show instructions to check email

---

### 3. Email Verification Sent Page

**Route:** `/auth/verify-email-sent`  
**Purpose:** Confirm email was sent

**Content:**
- 📧 Icon
- "Check your email!"
- "We've sent a verification link to {email}"
- "Click the link to activate your account"
- "Didn't receive it?" → Resend button (optional)

---

### 4. Email Verification Page

**Route:** `/auth/verify-email?token=xxx`  
**API:** `GET /api/auth/verify-email?token=xxx` ✅ Ready

**States:**
1. **Loading:**
   - Spinner
   - "Verifying your email..."

2. **Success:**
   - ✅ Icon
   - "Email verified!"
   - "Your account is now active"
   - Button → "Go to Dashboard" (login first)

3. **Error (Invalid/Expired):**
   - ❌ Icon
   - "Verification link is invalid or expired"
   - Button → "Request new verification email"

**On Success:**
- Redirect to login page
- Pre-fill username (if possible)
- Show success toast

---

### 5. Login Page Updates

**Current Route:** `/auth/login`  
**Needs:** Link to registration + forgot password

**Add:**
- "Don't have an account?" → Link to `/register`
- "Forgot password?" → Link to `/auth/forgot-password`

---

### 6. Forgot Password Page

**Route:** `/auth/forgot-password`  
**API:** `POST /api/auth/forgot-password` ✅ Ready

**Form:**
1. Email input
2. Submit button

**Success State:**
- "Check your email!"
- "If an account exists, you'll receive reset instructions"
- Link back to login

**Note:** Always shows success (anti-enumeration)

---

### 7. Reset Password Page

**Route:** `/auth/reset-password?token=xxx`  
**API:** `POST /api/auth/reset-password` ✅ Ready

**Form:**
1. New Password
   - Strength indicator
   - Show/hide toggle

2. Confirm Password
   - Must match
   - Real-time validation

**States:**
1. **Valid Token:**
   - Show form

2. **Invalid/Expired Token:**
   - Error message
   - "This link is invalid or has expired"
   - Link → "Request new reset link"

3. **Success:**
   - "Password reset successfully!"
   - Redirect to login
   - Auto-fill username if possible

---

## 🛠️ Implementation Tips

### Username Availability Check
```typescript
// Debounce the API call (500ms)
const checkUsername = debounce(async (username: string) => {
  const res = await fetch('/api/auth/check-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  const data = await res.json();
  // Show checkmark or error
}, 500);
```

### Password Strength Indicator
```typescript
function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';
  
  let score = 0;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}
```

### Form Validation
- Use react-hook-form or similar
- Show errors inline below inputs
- Disable submit until valid
- Handle API errors gracefully

---

## 📦 Required npm Packages

**Already Installed:**
- `bcrypt` ✅
- `resend` ✅
- `crypto` (Node.js built-in) ✅

**May Need:**
- `react-hook-form` (form management)
- `zod` (schema validation)
- `@hookform/resolvers` (if using zod)

---

## 🧪 Testing Checklist

Once UI is built, test:

### Registration Flow:
1. [ ] Register with valid data
2. [ ] Check for verification email (check logs if no email service)
3. [ ] Click verification link
4. [ ] See success message
5. [ ] Login with new account
6. [ ] Check dashboard loads

### Username Availability:
1. [ ] Try existing username → Shows "taken"
2. [ ] Try new username → Shows "available"
3. [ ] Try reserved word → Shows "reserved"
4. [ ] Try invalid format → Shows format error

### Password Reset:
1. [ ] Request reset for existing email
2. [ ] Check for reset email
3. [ ] Click reset link
4. [ ] Enter new password
5. [ ] Login with new password

### Error Cases:
1. [ ] Try registering with existing email
2. [ ] Try registering with existing username
3. [ ] Try verifying with expired token
4. [ ] Try resetting with expired token
5. [ ] Try invalid email formats

---

## 🎨 Design Guidelines

### Colors (from existing app):
- Primary: `#667eea` → `#764ba2` (gradient)
- Success: `#10b981` (green-500)
- Error: `#ef4444` (red-500)
- Warning: `#f59e0b` (amber-500)

### Components to Match:
- Use same button styles as login page
- Use same input styles as login page
- Use same card/panel style as admin
- Keep gradient backgrounds consistent

### Mobile First:
- All forms should be mobile-responsive
- Test on small screens (375px)
- Use responsive padding/margins
- Stack elements vertically on mobile

---

## 🚨 Known Issues / TODOs

### Backend:
1. ⚠️ **Spotify Watcher:** Still running in global mode (needs per-user refactor)
   - Not critical for Phase 2
   - Can fix in Phase 3

2. ⚠️ **Email Service:** Needs RESEND_API_KEY in production
   - Get API key from resend.com
   - Verify sender domain
   - Test in staging first

### Environment:
1. Add `RESEND_API_KEY` to `.env.local`
2. Add `EMAIL_FROM` to `.env.local`
3. Update `NEXT_PUBLIC_APP_URL` for production

---

## 📚 Useful Files to Reference

### For Styling:
- `src/app/auth/login/page.tsx` - Login page styling
- `src/app/[username]/request/page.tsx` - Public page styling
- `src/components/admin/*` - Admin component styles

### For Forms:
- Look at login form structure
- Copy button styles
- Match input styles

### For API Integration:
- `src/app/auth/login/page.tsx` - Shows how to call auth APIs
- `src/hooks/useAuth.ts` - Auth hook pattern

---

## 🎯 Suggested Development Order

1. **Landing Page** (30-45 min)
   - Simple, static page
   - Hero + features + CTA
   - Gets users excited

2. **Registration Page** (60-90 min)
   - Most complex form
   - Username availability check
   - Password strength
   - All validation

3. **Verification Pages** (30 min)
   - Email sent page (static)
   - Email verify page (API call + redirect)

4. **Password Reset Pages** (45-60 min)
   - Forgot password form
   - Reset password form
   - Similar to registration

5. **Polish & Testing** (30-60 min)
   - Test all flows
   - Fix bugs
   - Improve UX
   - Add loading states

**Total Estimate:** 3-5 hours for complete Phase 2 UI

---

## 🎉 When Phase 2 UI is Complete

Phase 2 will be **100% DONE** and you'll have:

✅ Fully functional multi-tenant app (Phase 1)  
✅ Public user registration with email verification  
✅ Password reset flow  
✅ Beautiful landing page  
✅ Professional UX

**Then Phase 3:** Advanced features (analytics, billing, etc.)

---

## 💬 Questions to Consider

1. **Landing Page Design:**
   - Do you have specific copy/tagline in mind?
   - Any specific features to highlight?
   - Logo or just text?

2. **Registration Flow:**
   - Require email verification before login?
   - Or allow login immediately with banner "Please verify"?

3. **Branding:**
   - App name: "Party Playlist" or different?
   - Tagline?
   - Color preferences (or keep current gradient)?

---

**Ready to build UI? Start with the Landing Page! 🚀**

---

**Last Updated:** October 7, 2025  
**Session Commits:** [cf20130, 90a1ea6, 417adbc]