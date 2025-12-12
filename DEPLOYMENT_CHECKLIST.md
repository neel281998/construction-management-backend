# Hostinger VPS Deployment Checklist

Use this checklist to track your deployment progress. Check off each item as you complete it.

## Pre-Deployment
- [ ] Hostinger VPS account created
- [ ] VPS IP address noted
- [ ] Root password saved securely
- [ ] SSH client installed (PuTTY/WinSCP for Windows)
- [ ] MongoDB Atlas account created (or plan to install MongoDB)
- [ ] Domain name ready (optional)

## Step 1: Server Connection
- [ ] Connected to VPS via SSH
- [ ] Successfully logged in as root

## Step 2: Initial Setup
- [ ] System packages updated
- [ ] Non-root user created (optional but recommended)
- [ ] SSH key authentication set up (optional)

## Step 3: Node.js Installation
- [ ] Node.js 18.x installed
- [ ] npm installed
- [ ] PM2 installed globally
- [ ] Verified: `node --version` shows v18.x.x or higher

## Step 4: MongoDB Setup
- [ ] **Option A:** MongoDB Atlas cluster created and connection string obtained
- [ ] **Option A:** VPS IP added to MongoDB Atlas whitelist
- [ ] **OR Option B:** MongoDB installed on VPS
- [ ] **OR Option B:** MongoDB service started and enabled

## Step 5: Code Upload
- [ ] Backend code uploaded to VPS (via Git/SCP/SFTP)
- [ ] Code located in `~/app/backend/` directory

## Step 6: Dependencies
- [ ] Navigated to backend directory
- [ ] Ran `npm install --production`
- [ ] All dependencies installed successfully

## Step 7: Environment Configuration
- [ ] `.env` file created
- [ ] `MONGODB_URI` set correctly
- [ ] `JWT_SECRET` generated and set
- [ ] `JWT_EXPIRES_IN` set (default: 7d)
- [ ] `FRONTEND_URL` set (if applicable)
- [ ] `PORT` set (default: 5000)
- [ ] `NODE_ENV` set to `production`
- [ ] `.env` file permissions set to 600

## Step 8: Application Start
- [ ] Application started with PM2: `pm2 start server.js --name "construction-backend"`
- [ ] PM2 startup script configured
- [ ] PM2 save executed
- [ ] Application tested locally: `curl http://localhost:5000`

## Step 9: Nginx Configuration
- [ ] Nginx installed
- [ ] Nginx configuration file created
- [ ] Reverse proxy configured to port 5000
- [ ] Nginx configuration tested: `sudo nginx -t`
- [ ] Nginx restarted
- [ ] Nginx enabled to start on boot

## Step 10: Firewall Setup
- [ ] Firewall configured (UFW or firewalld)
- [ ] SSH access allowed
- [ ] HTTP (port 80) allowed
- [ ] HTTPS (port 443) allowed
- [ ] Firewall enabled

## Step 11: SSL Certificate (If using domain)
- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] Auto-renewal configured
- [ ] HTTPS redirect configured

## Step 12: Testing
- [ ] Root endpoint accessible: `http://your-domain.com/`
- [ ] Health check works: `http://your-domain.com/api/health`
- [ ] API endpoints responding correctly
- [ ] CORS configured properly
- [ ] Database connection working

## Step 13: Verification
- [ ] PM2 shows application as "online"
- [ ] No errors in PM2 logs
- [ ] No errors in Nginx logs
- [ ] Application accessible from external network

## Post-Deployment
- [ ] Frontend updated with new backend URL
- [ ] All API endpoints tested
- [ ] Monitoring set up (optional)
- [ ] Backup strategy planned
- [ ] Documentation updated

## Troubleshooting (If needed)
- [ ] Checked PM2 logs for errors
- [ ] Checked Nginx logs for errors
- [ ] Verified environment variables
- [ ] Tested MongoDB connection
- [ ] Verified firewall rules
- [ ] Checked disk space and resources

---

## Quick Command Reference

```bash
# Connect to server
ssh root@YOUR_VPS_IP

# Check Node.js
node --version

# Navigate to app
cd ~/app/backend

# PM2 commands
pm2 start server.js --name "construction-backend"
pm2 restart construction-backend
pm2 logs construction-backend
pm2 list

# Nginx commands
sudo systemctl restart nginx
sudo nginx -t

# Check application
curl http://localhost:5000
curl http://localhost:5000/api/health
```

---

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Notes:**
- 
- 
- 

---

Last Updated: _______________


