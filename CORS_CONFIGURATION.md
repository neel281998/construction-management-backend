# CORS Configuration Guide - FRONTEND_URL Setup

This guide explains how to configure the `FRONTEND_URL` environment variable for CORS (Cross-Origin Resource Sharing) in your Construction Management API.

## What is FRONTEND_URL?

The `FRONTEND_URL` environment variable tells your backend API which frontend domains are allowed to make requests to your API. This is a security measure to prevent unauthorized websites from accessing your API.

## Current CORS Configuration

Your backend currently allows requests from these origins:

```javascript
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:8081',
    'http://localhost:8081',
    'http://localhost:3000',
    'http://localhost:19006', // Expo web
    'https://snack.expo.dev', // Expo Snack
    'https://*.vercel.app', // Vercel deployments
    'https://*.netlify.app' // Netlify deployments
  ],
  credentials: true
}));
```

## Setting FRONTEND_URL for Different Scenarios

### 1. Local Development

**For Expo Development:**
```bash
FRONTEND_URL=http://localhost:8081
```

**For React Native Web:**
```bash
FRONTEND_URL=http://localhost:3000
```

**For Expo Web:**
```bash
FRONTEND_URL=http://localhost:19006
```

### 2. Expo Go App (Mobile)

**For Expo Go on Physical Device:**
```bash
FRONTEND_URL=exp://192.168.1.100:8081
```
*Replace `192.168.1.100` with your computer's local IP address*

### 3. Production Deployment

**If your frontend is deployed on Vercel:**
```bash
FRONTEND_URL=https://your-frontend-app.vercel.app
```

**If your frontend is deployed on Netlify:**
```bash
FRONTEND_URL=https://your-frontend-app.netlify.app
```

**If your frontend is deployed on Expo:**
```bash
FRONTEND_URL=https://your-app.expo.dev
```

**If you have a custom domain:**
```bash
FRONTEND_URL=https://yourdomain.com
```

## How to Set Environment Variables

### Option 1: Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `FRONTEND_URL`
   - **Value**: Your frontend URL
   - **Environment**: Production (and Preview if needed)
4. Click **Save**

### Option 2: Local Development (.env file)

Create a `.env` file in your backend directory:

```bash
# .env
FRONTEND_URL=http://localhost:8081
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### Option 3: Command Line

```bash
# For local development
export FRONTEND_URL=http://localhost:8081

# For production
export FRONTEND_URL=https://your-frontend-app.vercel.app
```

## Common FRONTEND_URL Values

### Development Scenarios:

| Scenario | FRONTEND_URL Value |
|----------|-------------------|
| Expo Development Server | `http://localhost:8081` |
| React Native Web | `http://localhost:3000` |
| Expo Web | `http://localhost:19006` |
| Expo Go (Local Network) | `exp://192.168.1.100:8081` |
| Expo Snack | `https://snack.expo.dev` |

### Production Scenarios:

| Platform | FRONTEND_URL Format |
|----------|-------------------|
| Vercel | `https://your-app.vercel.app` |
| Netlify | `https://your-app.netlify.app` |
| Expo | `https://your-app.expo.dev` |
| Custom Domain | `https://yourdomain.com` |

## Multiple Frontend URLs

If you need to support multiple frontend URLs, you can modify the CORS configuration:

```javascript
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:8081',
      'http://localhost:3000',
      'http://localhost:19006',
      'https://snack.expo.dev',
      'https://your-production-app.vercel.app',
      'https://your-staging-app.vercel.app'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

## Testing CORS Configuration

### 1. Check if CORS is working:

```bash
# Test from your frontend
curl -H "Origin: http://localhost:8081" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://your-backend.vercel.app/api/auth/login
```

### 2. Check browser console for CORS errors:

Look for errors like:
```
Access to fetch at 'https://your-backend.vercel.app/api/auth/login' 
from origin 'http://localhost:8081' has been blocked by CORS policy
```

## Troubleshooting CORS Issues

### Issue: "CORS policy has been blocked"

**Solutions:**
1. Check that your `FRONTEND_URL` is set correctly
2. Ensure the URL matches exactly (including protocol, domain, and port)
3. Add your frontend URL to the CORS origins array
4. Check for typos in the URL

### Issue: "Credentials not supported"

**Solution:**
- Ensure `credentials: true` is set in CORS configuration
- Make sure your frontend requests include `credentials: 'include'`

### Issue: "Multiple CORS headers"

**Solution:**
- Check if you have multiple CORS middleware
- Ensure CORS is configured only once

## Security Best Practices

1. **Never use wildcards in production**: Avoid `*` in CORS origins for production
2. **Use HTTPS in production**: Always use `https://` for production URLs
3. **Limit origins**: Only allow necessary frontend URLs
4. **Environment-specific**: Use different URLs for development, staging, and production

## Example Environment Variables for Different Environments

### Development (.env.development):
```bash
FRONTEND_URL=http://localhost:8081
NODE_ENV=development
```

### Staging (.env.staging):
```bash
FRONTEND_URL=https://staging-app.vercel.app
NODE_ENV=staging
```

### Production (.env.production):
```bash
FRONTEND_URL=https://production-app.vercel.app
NODE_ENV=production
```

## Quick Setup Checklist

- [ ] Set `FRONTEND_URL` in Vercel environment variables
- [ ] Test API calls from your frontend
- [ ] Check browser console for CORS errors
- [ ] Verify credentials are working (if using authentication)
- [ ] Test with different environments (dev, staging, prod)

## Support

If you're still having CORS issues:
1. Check the browser's Network tab for detailed error messages
2. Verify your environment variables are set correctly
3. Test with a simple curl command
4. Check Vercel function logs for backend errors
