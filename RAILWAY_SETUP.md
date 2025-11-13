# Railway Backend Deployment Guide

## Your Railway Project
https://railway.com/project/b1c2270c-7b65-475d-8063-02930fcf44c9?environmentId=b652f501-63bb-4e6a-b80e-bb047869a1d4

---

## Step 1: Connect GitHub Repository

1. In Railway dashboard, click **"Deploy from GitHub repo"**
2. Select repository: `xtm888/medflow-clinic`
3. **IMPORTANT**: Set **Root Directory** to `backend`

---

## Step 2: Add Environment Variables

Go to **Variables** tab in Railway and add:

### Required Variables

```
MONGODB_URI=mongodb+srv://aioxtm:Magloire123@cluster0.nyylqsu.mongodb.net/medflow?retryWrites=true&w=majority&appName=Cluster0
```

```
NODE_ENV=production
```

```
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2025
```

```
JWT_EXPIRE=7d
```

```
JWT_COOKIE_EXPIRE=7
```

```
PORT=5001
```

```
FRONTEND_URL=https://your-frontend.vercel.app
```

**Note**: Update `FRONTEND_URL` after deploying frontend to Vercel

---

## Step 3: Deploy Backend

1. Click **"Deploy"** button
2. Wait for build to complete (usually 2-3 minutes)
3. Check logs for any errors
4. Look for "✅ Connected to MongoDB" and "🚀 Server running on port 5001"

---

## Step 4: Get Backend URL

After successful deployment:

1. Go to **Settings** tab
2. Find **Domains** section
3. Copy your Railway domain (e.g., `medflow-backend-production.up.railway.app`)
4. Your API URL will be: `https://[your-domain]/api`

Example: `https://medflow-backend-production.up.railway.app/api`

---

## Step 5: Test Backend

Test your backend is working:

```bash
curl https://[your-railway-domain]/api/health
```

Or open in browser:
```
https://[your-railway-domain]/api/health
```

Should return something like:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## Next: Deploy Frontend to Vercel

After backend is deployed and you have the URL:

1. Go to https://vercel.com/new
2. Import `xtm888/medflow-clinic` repository
3. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Add environment variable:
   - `VITE_API_URL` = `https://[your-railway-domain]/api`

5. Deploy

6. **Update Railway**: Go back to Railway and update `FRONTEND_URL` with your Vercel URL

---

## Troubleshooting

### "Cannot find module" errors
- Check Root Directory is set to `backend`
- Verify all dependencies are in `backend/package.json`

### MongoDB connection errors
- Verify `MONGODB_URI` is correct in Railway Variables
- Check MongoDB Atlas IP whitelist includes `0.0.0.0/0`

### CORS errors after deployment
- Make sure `FRONTEND_URL` in Railway matches your actual Vercel URL
- Redeploy backend after updating `FRONTEND_URL`

### Port errors
- Railway automatically assigns a PORT environment variable
- Our code uses `process.env.PORT || 5001` so it should work automatically

---

## Login Credentials (After Deployment)

- **Admin**: admin@medflow.com / Admin123!
- **Doctor**: doctor@medflow.com / Admin123!
- **Ophthalmologist**: ophthalmologist@medflow.com / Admin123!

All test accounts use password: `Admin123!`

---

## Important Notes

- ✅ MongoDB Atlas is already configured and seeded
- ✅ Backend code is production-ready
- ✅ Environment variables are documented
- ⚠️ Remember to update `FRONTEND_URL` after deploying frontend
- ⚠️ Update `JWT_SECRET` to a strong random value for production

---

Generated: 2025-11-14
