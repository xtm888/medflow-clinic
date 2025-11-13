# Vercel Environment Variables

## 🔐 IMPORTANT: Add these to Vercel Dashboard

### For Backend Deployment

Go to Vercel Dashboard → Your Backend Project → Settings → Environment Variables

Add the following variables:

```
MONGODB_URI=mongodb+srv://aioxtm:Magloire123@cluster0.nyylqsu.mongodb.net/medflow?retryWrites=true&w=majority&appName=Cluster0

NODE_ENV=production

JWT_SECRET=your-super-secret-jwt-key-change-in-production-2025

JWT_EXPIRE=7d

JWT_COOKIE_EXPIRE=7

PORT=5001

FRONTEND_URL=https://your-frontend-app.vercel.app
```

**Replace `your-frontend-app.vercel.app` with your actual frontend URL after deployment.**

---

### For Frontend Deployment

Go to Vercel Dashboard → Your Frontend Project → Settings → Environment Variables

Add the following variable:

```
VITE_API_URL=https://your-backend-app.vercel.app/api
```

**Replace `your-backend-app.vercel.app` with your actual backend URL after deployment.**

---

## 🚀 Deployment Steps

### Option 1: Deploy Both on Vercel (Current Setup)

1. **Deploy Backend First**:
   ```bash
   cd backend
   vercel
   ```
   - Follow prompts
   - Add environment variables in Vercel dashboard (see above)
   - Note the backend URL (e.g., `medflow-backend-xyz.vercel.app`)

2. **Deploy Frontend**:
   ```bash
   cd frontend
   vercel
   ```
   - Add `VITE_API_URL` in Vercel dashboard with backend URL
   - Deploy

3. **Update CORS**:
   - Go back to backend Vercel settings
   - Update `FRONTEND_URL` with the actual frontend URL

---

### Option 2: Deploy Backend on Railway (Easier)

Railway is better for Node.js backends:

1. **Go to** https://railway.app
2. **Click** "Start a New Project"
3. **Deploy from GitHub** → Select your repo → Select `backend` folder
4. **Add Environment Variables**:
   - All the backend variables listed above
5. **Copy** the Railway backend URL
6. **Deploy Frontend on Vercel**:
   - Use Railway backend URL for `VITE_API_URL`

---

## ✅ Current Status

- ✅ MongoDB Atlas configured and seeded
- ✅ Backend running locally with cloud database
- ✅ Frontend configured for deployment
- ✅ Vercel configuration ready (`vercel.json`)

---

## 🔒 Security Notes

- ⚠️ **Never commit** `.env` file to GitHub (already in `.gitignore`)
- ✅ Use environment variables in Vercel for production
- ✅ MongoDB Atlas user created: `aioxtm`
- ✅ IP whitelist set to allow all (required for Vercel)

---

## 📊 Login Credentials for Demo

After deployment, you can login with:

- **Email**: `admin@medflow.com`
- **Password**: `Admin123!`

Other test accounts:
- `doctor@medflow.com` (Doctor)
- `ophthalmologist@medflow.com` (Ophthalmologist)
- `nurse@medflow.com` (Nurse)
- `reception@medflow.com` (Receptionist)
- `pharmacist@medflow.com` (Pharmacist)

All use password: `Admin123!`

---

## 🐛 Troubleshooting

### CORS errors
- Make sure `FRONTEND_URL` in backend matches actual frontend URL
- Check CORS configuration in `backend/server.js`

### Database connection errors
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check environment variable is correct in Vercel

### Build errors
- Make sure `vercel.json` is in root directory
- Check build logs in Vercel dashboard

---

Generated: 2025-11-14
