# Deploy Updated Backend to VPS

This guide shows you how to deploy your updated backend code to your VPS after pushing changes to Git.

## 🚀 Quick Deployment Steps

### Option 1: Using PowerShell/SSH (Recommended)

1. **Connect to your VPS via SSH**
   ```powershell
   ssh root@YOUR_VPS_IP
   # Or if you have a deploy user:
   ssh deploy@YOUR_VPS_IP
   ```

2. **Navigate to your backend directory**
   ```bash
   cd ~/app/backend
   ```

3. **Pull latest changes from Git**
   ```bash
   git pull origin main
   ```
   (Replace `main` with your branch name if different)

4. **Install any new dependencies**
   ```bash
   npm install --production
   ```

5. **Restart your application**
   ```bash
   pm2 restart construction-backend
   ```

6. **Check if everything is working**
   ```bash
   # Check PM2 status
   pm2 list
   
   # View recent logs
   pm2 logs construction-backend --lines 20
   
   # Test API endpoint
   curl http://localhost:5000/api/health
   ```

### Option 2: Using the Deployment Script

1. **Upload the deployment script to your VPS** (if not already there)
   ```powershell
   # From your local machine (PowerShell)
   scp deploy-update.sh root@YOUR_VPS_IP:~/app/backend/
   ```

2. **Connect to your VPS**
   ```powershell
   ssh root@YOUR_VPS_IP
   ```

3. **Run the deployment script**
   ```bash
   cd ~/app/backend
   bash deploy-update.sh
   ```

## 📋 Detailed Step-by-Step Guide

### Step 1: Connect to Your VPS

**Using Windows PowerShell:**
```powershell
ssh root@YOUR_VPS_IP
```

**Using PuTTY (if you prefer GUI):**
1. Open PuTTY
2. Enter your VPS IP address
3. Port: 22
4. Click "Open"
5. Login as: `root`
6. Enter your password

### Step 2: Navigate to Backend Directory

```bash
cd ~/app/backend
```

If your backend is in a different location, adjust the path accordingly.

### Step 3: Pull Latest Code from Git

```bash
# Check current branch
git branch

# Pull latest changes
git pull origin main

# If you get an error about uncommitted changes, you can:
# Option A: Stash changes (if any local modifications)
git stash
git pull origin main
git stash pop

# Option B: Reset to match remote (WARNING: This discards local changes)
git fetch origin
git reset --hard origin/main
```

### Step 4: Install/Update Dependencies

```bash
# Install production dependencies
npm install --production

# If you need dev dependencies too (not recommended for production)
# npm install
```

### Step 5: Restart the Application

```bash
# Restart the PM2 process
pm2 restart construction-backend

# If restart fails, try stopping and starting
pm2 stop construction-backend
pm2 start server.js --name "construction-backend"
```

### Step 6: Verify Deployment

```bash
# Check PM2 status (should show "online")
pm2 list

# View logs for any errors
pm2 logs construction-backend --lines 50

# Test the API locally on the server
curl http://localhost:5000/api/health

# Test from your local machine (replace with your domain/IP)
curl http://YOUR_VPS_IP/api/health
# or
curl https://your-domain.com/api/health
```

## 🔍 Troubleshooting

### Issue: Git pull fails with "authentication required"

**Solution:** Make sure your VPS has access to your Git repository. You may need to:
- Set up SSH keys on your VPS
- Or use HTTPS with credentials
- Or use a personal access token

```bash
# If using HTTPS, you might need to configure credentials
git config --global credential.helper store
# Then enter your credentials when prompted
```

### Issue: PM2 restart fails

**Solution:**
```bash
# Check if the process exists
pm2 list

# If it doesn't exist, start it fresh
pm2 start server.js --name "construction-backend"
pm2 save

# If it exists but won't restart, delete and recreate
pm2 delete construction-backend
pm2 start server.js --name "construction-backend"
pm2 save
```

### Issue: Application won't start after update

**Solution:**
```bash
# Check logs for errors
pm2 logs construction-backend

# Check if there are syntax errors
node -c server.js

# Verify environment variables
cat .env

# Check if port is already in use
sudo netstat -tulpn | grep 5000

# Try starting manually to see errors
cd ~/app/backend
node server.js
```

### Issue: Dependencies installation fails

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --production

# If still failing, check Node.js version
node --version  # Should be 18.x or higher
```

### Issue: Changes not reflecting

**Solution:**
```bash
# Make sure you pulled the latest code
git pull origin main

# Verify you're on the correct branch
git branch

# Check if files were actually updated
git log --oneline -5

# Hard restart PM2
pm2 delete construction-backend
pm2 start server.js --name "construction-backend"
```

## 🔄 Automated Deployment (Optional)

If you want to automate deployments, you can set up a webhook or use CI/CD. For now, the manual process above works well.

## 📝 Quick Reference Commands

```bash
# Connect to VPS
ssh root@YOUR_VPS_IP

# Navigate to backend
cd ~/app/backend

# Pull updates
git pull origin main

# Install dependencies
npm install --production

# Restart app
pm2 restart construction-backend

# Check status
pm2 list
pm2 logs construction-backend

# Test API
curl http://localhost:5000/api/health
```

## ✅ Deployment Checklist

After deploying, verify:
- [ ] Git pull completed successfully
- [ ] Dependencies installed without errors
- [ ] PM2 shows application as "online"
- [ ] No errors in PM2 logs
- [ ] API health endpoint responds correctly
- [ ] Application accessible from browser/external network

## 🎉 Done!

Your updated backend should now be live on your VPS!

**Next Steps:**
- Test all critical API endpoints
- Monitor logs for any issues: `pm2 logs construction-backend`
- Update your frontend if API changes require it
