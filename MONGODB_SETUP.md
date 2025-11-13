# MongoDB Atlas Setup for Production

## Why You Need This
- Local MongoDB only works on your computer
- Vercel (cloud deployment) cannot connect to your local MongoDB
- MongoDB Atlas provides FREE cloud database hosting

## Step-by-Step Setup (5 minutes)

### 1. Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for FREE account
3. Choose "Shared" (FREE tier - M0)

### 2. Create Cluster
1. Choose AWS as provider
2. Select closest region to your users (e.g., "Frankfurt" for Europe or "us-east-1" for USA)
3. Cluster Name: "medflow-cluster"
4. Click "Create Cluster" (takes 3-5 minutes)

### 3. Create Database User
1. Click "Database Access" (left sidebar)
2. Click "Add New Database User"
3. Username: `medflow_admin`
4. Password: Generate secure password (SAVE THIS!)
5. Database User Privileges: "Read and write to any database"
6. Click "Add User"

### 4. Whitelist IP Addresses
1. Click "Network Access" (left sidebar)
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
   - This allows Vercel to connect
4. Click "Confirm"

### 5. Get Connection String
1. Click "Database" (left sidebar)
2. Click "Connect" button on your cluster
3. Choose "Connect your application"
4. Copy the connection string (looks like):
   ```
   mongodb+srv://medflow_admin:<password>@medflow-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password
6. Add database name at the end: `/medflow`

Final format:
```
mongodb+srv://medflow_admin:YourPassword@medflow-cluster.xxxxx.mongodb.net/medflow?retryWrites=true&w=majority
```

### 6. Update Your .env File

**Local Development (.env):**
```env
# For local development, you can use either:
# Local MongoDB (current):
MONGODB_URI=mongodb://localhost:27017/medflow

# OR MongoDB Atlas (same as production):
MONGODB_URI=mongodb+srv://medflow_admin:YourPassword@medflow-cluster.xxxxx.mongodb.net/medflow?retryWrites=true&w=majority
```

**Vercel Production:**
1. Go to your Vercel project settings
2. Click "Environment Variables"
3. Add variable:
   - Name: `MONGODB_URI`
   - Value: Your MongoDB Atlas connection string
4. Click "Save"

### 7. Seed Production Database (One Time)
After deploying to Vercel, run seed script once:
```bash
# Update .env to use Atlas
MONGODB_URI=mongodb+srv://... node backend/scripts/seed.js
```

## Cost
- **FREE** for up to 512 MB storage
- Perfect for startups/demos
- Can upgrade later if needed

## Security Tips
- Never commit connection string to GitHub
- Always use environment variables
- Rotate passwords regularly
