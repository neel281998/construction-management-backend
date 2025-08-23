# Backend Deployment Guide - Vercel

This guide will help you deploy your Construction Management API backend to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a MongoDB Atlas cluster
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Prepare Your MongoDB Database

1. Create a MongoDB Atlas account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string (it looks like: `mongodb+srv://username:password@cluster.mongodb.net/database`)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Set the following configuration:
   - **Framework Preset**: Node.js
   - **Root Directory**: `backend`
   - **Build Command**: Leave empty (Vercel will auto-detect)
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Navigate to your backend directory:
   ```bash
   cd backend
   ```

3. Deploy:
   ```bash
   vercel
   ```

## Step 3: Configure Environment Variables

In your Vercel project dashboard, go to Settings → Environment Variables and add:

### Required Variables:
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: A secure random string for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (e.g., "7d")

### Optional Variables:
- `EMAIL_HOST`: SMTP host for email functionality
- `EMAIL_PORT`: SMTP port (usually 587)
- `EMAIL_USER`: Your email address
- `EMAIL_PASS`: Your email app password
- `FRONTEND_URL`: Your frontend domain for CORS

## Step 4: Test Your Deployment

1. Your API will be available at: `https://your-project-name.vercel.app`
2. Test the health endpoint: `https://your-project-name.vercel.app/api/health`
3. Test the root endpoint: `https://your-project-name.vercel.app/`

## Step 5: Update Frontend Configuration

Update your frontend API configuration to use the new Vercel URL:

```typescript
// In your frontend services/api.ts
const API_BASE_URL = 'https://your-project-name.vercel.app/api';
```

## Troubleshooting

### Common Issues:

1. **Database Connection Error**: Ensure your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0) or add Vercel's IP ranges
2. **CORS Error**: Make sure your `FRONTEND_URL` environment variable is set correctly
3. **Build Error**: Check that all dependencies are in `package.json`

### Environment Variables Format:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

## API Endpoints

After deployment, your API will have these endpoints:

- `GET /` - API status
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/sites` - Get sites
- `GET /api/vehicles` - Get vehicles
- `GET /api/inventory` - Get inventory
- `POST /api/attendance` - Record attendance

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables are set correctly
3. Test your MongoDB connection string locally first
