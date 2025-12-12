# .env File Configuration Guide for VPS

## 📋 Quick Answer

**For your `.env` file:**
- ✅ **Use your DOMAIN** (if you have one) - e.g., `https://api.yourdomain.com`
- ✅ **OR use your VPS IP** (if no domain) - e.g., `http://123.45.67.89`
- ✅ **FRONTEND_URL** = Where your frontend/mobile app is hosted (NOT the backend)

## 🔍 Detailed Explanation

### What is FRONTEND_URL?

`FRONTEND_URL` is where your **frontend application** (mobile app, web app) is hosted. This is used for CORS (Cross-Origin Resource Sharing) to allow your frontend to make API requests to your backend.

**Examples:**
- If your frontend is on Vercel: `https://your-app.vercel.app`
- If your frontend is on Netlify: `https://your-app.netlify.app`
- If your frontend is on your own domain: `https://app.yourdomain.com`
- If testing locally: `http://localhost:8081`

### What is BACKEND_URL? (Optional)

`BACKEND_URL` is where your **backend API** is hosted. This is optional but recommended if you have a domain.

**Examples:**
- If you have a domain: `https://api.yourdomain.com` or `https://backend.yourdomain.com`
- If using IP only: `http://123.45.67.89` (your VPS IP)
- **Note:** This is mainly for CORS if needed, but your backend URL is determined by where you deploy it

## 📝 Complete .env File Example

### Scenario 1: You have a domain for backend
```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Frontend URL (where your mobile app/frontend is hosted)
FRONTEND_URL=https://your-frontend-app.vercel.app

# Backend URL (optional - your backend domain)
BACKEND_URL=https://api.yourdomain.com

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server Configuration
PORT=5000
NODE_ENV=production
```

### Scenario 2: No domain, using VPS IP only
```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Frontend URL (where your mobile app/frontend is hosted)
FRONTEND_URL=https://your-frontend-app.vercel.app

# Backend URL (optional - your VPS IP)
BACKEND_URL=http://123.45.67.89

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server Configuration
PORT=5000
NODE_ENV=production
```

## 🎯 Common Scenarios

### Scenario A: Frontend on Vercel, Backend on VPS with Domain
```env
FRONTEND_URL=https://my-app.vercel.app
BACKEND_URL=https://api.mydomain.com
```

### Scenario B: Frontend on Vercel, Backend on VPS with IP Only
```env
FRONTEND_URL=https://my-app.vercel.app
BACKEND_URL=http://123.45.67.89
# Note: You'll need to configure Nginx with your IP
```

### Scenario C: Everything on Same Domain (Subdomains)
```env
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

### Scenario D: Local Development
```env
FRONTEND_URL=http://localhost:8081
BACKEND_URL=http://localhost:5000
# Or leave BACKEND_URL empty
```

## ⚠️ Important Notes

1. **FRONTEND_URL is REQUIRED** if your frontend is not on localhost
   - This is where your mobile app/web app makes API calls from
   - Must match exactly (including http/https)

2. **BACKEND_URL is OPTIONAL**
   - Only needed if you want to explicitly allow your backend domain in CORS
   - Your backend will work without it

3. **Use HTTPS for production**
   - Always use `https://` for production domains
   - Only use `http://` for localhost or IP addresses without SSL

4. **Domain vs IP**
   - **Domain is better**: `https://api.yourdomain.com` (professional, SSL, easier to remember)
   - **IP works too**: `http://123.45.67.89` (but no SSL unless you set it up)

## 🔧 How to Set Up Domain for Backend

If you bought a domain (e.g., `yourdomain.com`):

1. **Point domain to your VPS:**
   - Go to your domain registrar (where you bought the domain)
   - Add an A record: `api.yourdomain.com` → Your VPS IP address
   - Or use `yourdomain.com` → Your VPS IP address

2. **Update Nginx config:**
   ```nginx
   server_name api.yourdomain.com www.api.yourdomain.com;
   ```

3. **Set up SSL:**
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

4. **Update .env:**
   ```env
   BACKEND_URL=https://api.yourdomain.com
   ```

## ✅ Checklist

- [ ] `FRONTEND_URL` = Your frontend/mobile app URL
- [ ] `BACKEND_URL` = Your backend domain (if you have one) or VPS IP
- [ ] `MONGODB_URI` = Your MongoDB connection string
- [ ] `JWT_SECRET` = Strong random string
- [ ] `PORT` = 5000 (or your preferred port)
- [ ] `NODE_ENV` = production

## 🆘 Still Confused?

**Simple rule:**
- **FRONTEND_URL** = Where your app (that calls the API) is hosted
- **BACKEND_URL** = Where this backend code is running (optional)

**Example:**
- Your mobile app is on: `https://myapp.vercel.app` → This is FRONTEND_URL
- Your backend will be on: `https://api.mydomain.com` → This is BACKEND_URL (optional)

The backend URL doesn't need to be in .env for the backend to work - it's just helpful for CORS configuration.


