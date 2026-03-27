# AWS Amplify Deployment Guide

## Issues Fixed

### 1. **404 Error on `/login/` Route**
**Problem:** SPA routing wasn't configured, causing Amplify to return 404 for non-root routes.
**Solution:** Added rewrites in `amplify.yml` to redirect all routes to `index.html` for React Router to handle.

**Files Updated:**
- `amplify.yml` - Added rewrites section for SPA routing
- `frontend/public/_redirects` - Created for additional routing compatibility

### 2. **Logo Image Not Loading**
**Problem:** VVITU logo URL (https://www.vvitu.ac.in/src/assets/images/VVIT_logo.png) was broken/blocked.
**Solution:** Updated all logo references to working image URL.

**Files Updated:**
- `frontend/index.html`
- `frontend/src/pages/auth/Login.jsx`
- `frontend/src/layouts/PublicLayout.jsx`
- `frontend/src/components/shared/Navbar.jsx`

### 3. **Login Not Proceeding After Authentication**
**Problem:** Frontend deployed on Amplify couldn't reach backend API because `VITE_API_URL` environment variable wasn't set.
**Solution:** Configure environment variables in AWS Amplify console.

## Deployment Steps

### Step 1: Deploy Backend (Use Render or any Node-compatible hosting)

1. Go to [https://render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repo
4. Set Environment Variables:
   ```
   DEBUG=False
   ALLOWED_HOSTS=.onrender.com,your-domain.com
   MONGODB_URI=<set-your-mongodb-atlas-uri-in-render-dashboard>
   SECRET_KEY=your-secret-key-here
   CORS_ALLOWED_ORIGINS=https://your-frontend-amplify-domain
   ```
5. Build Command: `pip install -r requirements.txt`
6. Start Command: `python manage.py runserver 0.0.0.0:8000`
7. Deploy

**Note:** You'll get a Render backend URL like: `https://alumni-connect-backend.onrender.com`

### Step 2: Configure AWS Amplify Console

1. Go to AWS Amplify Console
2. Select your Alumni Connect app
3. Go to **Deployments** > **App settings** > **Environment variables**
4. Add environment variable:
   ```
   VITE_API_URL = https://alumni-connect-backend.onrender.com/api
   ```
5. Go back to **Deployments** and trigger a new deployment

### Step 3: Configure Backend CORS

Update `backend/core/settings.py` to allow requests from Amplify:

```python
CORS_ALLOWED_ORIGINS = [
    'https://main.d3sjduhcx0uu6o.amplifyapp.com',  # Your Amplify domain
    'https://your-custom-domain.com',
    'http://localhost:3000',  # For local dev
]
```

## Local Development Setup

### Start Backend:
```bash
cd backend
python manage.py runserver 8000
```

### Start Frontend:
```bash
cd frontend
npm run dev
```

Frontend will be at `http://localhost:3000` and will proxy API requests to `http://localhost:8000/api`

## Testing Deployment

1. Go to your Amplify URL: `https://main.d3sjduhcx0uu6o.amplifyapp.com`
2. Try accessing `/login/` - should load login page (no 404)
3. Login with credentials
4. Should redirect to role-specific home page
5. Navigation should work without logging out

## Environment Variable Reference

| Variable | Development | Production |
|----------|------------|------------|
| `VITE_API_URL` | `http://127.0.0.1:8000/api` | `https://alumni-connect-backend.onrender.com/api` |
| `VITE_USE_MOCK` | `false` | `false` |

## Troubleshooting

### Still getting 404 on routes?
- Hard refresh browser: `Ctrl+Shift+R`
- Clear CloudFront cache in Amplify console
- Verify `amplify.yml` has rewrites section

### Login still not proceeding?
- Check browser Network tab to see if API requests are going to correct URL
- Check backend console for errors
- Verify `CORS_ALLOWED_ORIGINS` includes your Amplify domain
- Check MongoDB connection on backend

### Logo still broken?
- Clear browser cache: `Ctrl+Shift+Delete`
- Verify the image URL loads directly in new tab
- Check network tab for 403/404 errors

## Git Commit

After these changes:
```bash
git add .
git commit -m "fix: Fix Amplify SPA routing, update logo URL, optimize prod build"
```
