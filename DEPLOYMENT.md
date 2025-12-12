# Vercel Deployment Guide

This guide will help you deploy the frontend to Vercel without any issues.

## Pre-Deployment Checklist

### ✅ 1. Code Review
- [x] Fixed `next.config.ts` - removed deprecated `buildActivity` property
- [x] Fixed TypeScript errors in `api.ts` - changed `HeadersInit` to `Record<string, string>`
- [x] Fixed embed URL to use environment variables instead of hardcoded URL
- [x] All environment variables are properly configured
- [x] `.gitignore` properly excludes `.env*` files

### ✅ 2. Build Test
Before pushing to GitHub, test the build locally:
```bash
cd frontend
npm run build
```

If the build succeeds, you're ready to deploy!

## Deployment Steps

### Step 1: Create GitHub Repository

1. Go to GitHub and create a **new empty repository**
2. Copy the repository URL

### Step 2: Push Frontend to GitHub

```bash
cd frontend

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Frontend ready for Vercel deployment"

# Add remote (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (or leave empty if frontend is the root)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Step 4: Set Environment Variables in Vercel

**IMPORTANT**: You must set environment variables in Vercel dashboard, NOT in `.env.local` file in the repository.

1. In your Vercel project, go to **Settings** → **Environment Variables**
2. Add the following variables:

#### Required for Production:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend-api-domain.com
```

**Example:**
```
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

#### Optional (for embed code generation):
```
NEXT_PUBLIC_SITE_URL=https://your-frontend-domain.com
```

**Note**: Vercel automatically provides `NEXT_PUBLIC_VERCEL_URL` which contains your deployment URL. You can use this or set a custom domain.

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete
3. Your site will be live at `https://your-project.vercel.app`

## Environment Variables Reference

### For Local Development (`.env.local`)

Create a `.env.local` file in the `frontend` folder:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### For Production (Vercel Dashboard)

Set these in Vercel's Environment Variables section:

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-api-domain.com
NEXT_PUBLIC_SITE_URL=https://your-frontend-domain.com  # Optional
```

## Important Notes

### ✅ What's Fixed:
1. **Next.js Config**: Removed deprecated `buildActivity` property
2. **TypeScript Errors**: Fixed `HeadersInit` type issue in `api.ts`
3. **Embed URL**: Now uses environment variables instead of hardcoded URL
4. **Environment Variables**: Properly configured with fallbacks

### ⚠️ Common Issues & Solutions:

#### Issue 1: Build Fails with TypeScript Errors
**Solution**: All TypeScript errors have been fixed. If you see new errors, check:
- Node.js version (should be 18+)
- TypeScript version matches package.json

#### Issue 2: API Calls Fail in Production
**Solution**: Make sure `NEXT_PUBLIC_BACKEND_URL` is set correctly in Vercel:
- Must start with `https://` (not `http://`)
- Should NOT include `/api` at the end (it's added automatically)
- Example: `https://api.yourdomain.com`

#### Issue 3: Embed Code Shows Wrong URL
**Solution**: The embed code now uses:
1. `window.location.origin` (client-side)
2. `NEXT_PUBLIC_SITE_URL` (if set)
3. `NEXT_PUBLIC_VERCEL_URL` (auto-provided by Vercel)
4. Falls back to relative path

#### Issue 4: CORS Errors
**Solution**: Make sure your backend allows requests from your Vercel domain:
- Add your Vercel URL to CORS allowed origins
- Example: `https://your-project.vercel.app`

## Post-Deployment

### 1. Test Your Deployment
- [ ] Visit your Vercel URL
- [ ] Test login/signup
- [ ] Test API calls
- [ ] Test embed calendar functionality
- [ ] Check browser console for errors

### 2. Custom Domain (Optional)
1. Go to Vercel project settings
2. Add your custom domain
3. Update `NEXT_PUBLIC_SITE_URL` if needed

### 3. Monitor Builds
- Check Vercel dashboard for build logs
- Set up error tracking if needed

## File Structure

```
frontend/
├── .env.local          # Local development (NOT committed to git)
├── .env.example        # Example file (committed to git)
├── .gitignore          # Excludes .env* files
├── next.config.ts      # ✅ Fixed - no deprecated properties
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
└── src/
    ├── lib/
    │   └── api.ts      # ✅ Fixed - proper type definitions
    └── app/
        └── dashboard/
            └── embed/
                └── page.tsx  # ✅ Fixed - uses env variables
```

## Support

If you encounter any deployment issues:
1. Check Vercel build logs
2. Verify environment variables are set correctly
3. Ensure backend API is accessible from Vercel
4. Check browser console for client-side errors

---

**Last Updated**: All known deployment issues have been fixed. The code is ready for Vercel deployment! 🚀

