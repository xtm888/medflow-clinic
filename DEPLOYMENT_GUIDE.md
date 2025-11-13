# MedFlow Deployment Guide

## Architecture

MedFlow has two parts that need to be deployed separately:
1. **Frontend** (React/Vite) → Deploy to Vercel
2. **Backend** (Node.js/Express) → Deploy to Vercel or Railway

---

## Option 1: Deploy Both to Vercel (Recommended for CEO Demo)

### A. Deploy Backend First

1. **Create separate Vercel project for backend**:
   ```bash
   cd backend
   vercel
   ```

2. **Configure environment variables in Vercel dashboard**:
   - `MONGODB_URI` = Your MongoDB Atlas connection string
   - `JWT_SECRET` = your-super-secret-jwt-key-change-in-production
   - `NODE_ENV` = production
   - `FRONTEND_URL` = https://your-frontend.vercel.app

3. **Note the backend URL**: e.g., `https://medflow-backend.vercel.app`

### B. Deploy Frontend

1. **Update frontend API URL**:
   - Create `frontend/.env.production`:
     ```env
     VITE_API_URL=https://medflow-backend.vercel.app/api
     ```

2. **Deploy frontend**:
   ```bash
   cd frontend
   vercel
   ```

3. **Environment variables in Vercel**:
   - `VITE_API_URL` = https://your-backend.vercel.app/api

---

## Option 2: Simpler - Deploy Frontend Only (Static Demo)

If you just want to show the UI without backend:

1. **Go to Vercel Dashboard**: https://vercel.com/new
2. **Import your GitHub repo**: xtm888/medflow-clinic
3. **Configure build settings**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables**:
   - `VITE_API_URL` = `http://localhost:5001/api` (for local backend)

5. **Click "Deploy"**

---

## Quick Fix for Current Vercel Error

Your current error is because Vercel is building from root directory instead of frontend.

### Solution 1: Update Vercel Project Settings

1. Go to Vercel Dashboard → Your Project → Settings
2. **Root Directory**: Change to `frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`
6. Redeploy

### Solution 2: Use vercel.json (I already created this)

I created `/Users/xtm888/magloire/vercel.json` with proper configuration.

Just commit and push:
```bash
git add vercel.json DEPLOYMENT_GUIDE.md
git commit -m "Add Vercel deployment configuration"
git push origin main
```

Then Vercel will automatically redeploy with correct settings.

---

## MongoDB Atlas Environment Variables

For production, add these to Vercel:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.nyylqsu.mongodb.net/medflow?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=production
PORT=5001
```

---

## Testing Deployment

After deployment:
1. **Frontend URL**: https://your-app.vercel.app
2. **Login with**: admin@medflow.com / Admin123!

---

## Troubleshooting

### "vite: command not found"
- ✅ Fixed with vercel.json
- OR change Root Directory to `frontend` in Vercel settings

### "Failed to fetch git submodules"
- This is just a warning, can be ignored
- If it causes issues, remove git submodules

### Backend CORS errors
- Make sure `FRONTEND_URL` is set in backend environment variables
- Update CORS configuration in backend/server.js

---

## Recommended Approach for CEO Demo

1. **Deploy Backend to Railway** (easier than Vercel for Node.js):
   - Go to https://railway.app
   - Connect GitHub
   - Select `backend` folder
   - Add MongoDB Atlas URL
   - Get backend URL

2. **Deploy Frontend to Vercel**:
   - Select `frontend` folder
   - Add `VITE_API_URL` pointing to Railway backend
   - Deploy

This separation is cleaner and more reliable.
