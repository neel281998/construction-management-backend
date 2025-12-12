# Complete Guide: Deploying Backend to Hostinger VPS

This is a comprehensive step-by-step guide to deploy your Node.js backend to a Hostinger VPS server from scratch.

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Hostinger VPS account with root access
- ✅ SSH client (PuTTY for Windows, Terminal for Mac/Linux)
- ✅ Your VPS IP address and root password
- ✅ MongoDB Atlas account (or plan to install MongoDB on VPS)
- ✅ Domain name (optional but recommended)

---

## 🚀 Step 1: Connect to Your VPS

### For Windows (Using PuTTY):
1. Download PuTTY from [putty.org](https://www.putty.org/)
2. Open PuTTY
3. Enter your VPS IP address
4. Port: 22
5. Connection type: SSH
6. Click "Open"
7. Login as: `root`
8. Enter your root password when prompted

### For Mac/Linux (Using Terminal):
```bash
ssh root@YOUR_VPS_IP
# Enter your root password when prompted
```

---

## 🔧 Step 2: Initial Server Setup

### 2.1 Update System Packages
```bash
# For Ubuntu/Debian
apt update && apt upgrade -y

# For CentOS/RHEL
yum update -y
```

### 2.2 Create a Non-Root User (Recommended)
```bash
# Create new user
adduser deploy
usermod -aG sudo deploy  # For Ubuntu/Debian
usermod -aG wheel deploy  # For CentOS/RHEL

# Switch to new user
su - deploy
```

### 2.3 Set Up SSH Key Authentication (Optional but Recommended)
```bash
# On your local machine, generate SSH key
ssh-keygen -t rsa -b 4096

# Copy public key to server
ssh-copy-id deploy@YOUR_VPS_IP
```

---

## 📦 Step 3: Install Node.js

### 3.1 Install Node.js 18.x (Required version)
```bash
# For Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# For CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 3.2 Verify Installation
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show version number
```

### 3.3 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

---

## 🗄️ Step 4: Set Up MongoDB

### Option A: Use MongoDB Atlas (Recommended - Cloud Database)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Get your connection string
4. Add your VPS IP to MongoDB Atlas Network Access whitelist
5. **Skip to Step 5** if using Atlas

### Option B: Install MongoDB on VPS
```bash
# For Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

---

## 📁 Step 5: Upload Your Backend Code

### Option A: Using Git (Recommended)
```bash
# Install Git if not installed
sudo apt install git -y  # Ubuntu/Debian
sudo yum install git -y  # CentOS/RHEL

# Create application directory
mkdir -p ~/app
cd ~/app

# Clone your repository (replace with your repo URL)
git clone https://github.com/neel281998/construction-management-backend backend
cd backend

# Or if backend is in a subdirectory
cd backend
```

### Option B: Using SCP (File Transfer)
```bash
# On your local machine (Windows PowerShell or Terminal)
# Navigate to your backend folder, then:
scp -r * deploy@YOUR_VPS_IP:~/app/backend/
```

### Option C: Using SFTP Client (WinSCP for Windows)
1. Download WinSCP
2. Connect to your VPS
3. Upload your backend folder to `~/app/backend/`

---

## ⚙️ Step 6: Install Dependencies

```bash
cd ~/app/backend
npm install --production
```

---

## 🔐 Step 7: Configure Environment Variables

### 7.1 Create .env File
```bash
cd ~/app/backend
nano .env
```

### 7.2 Add Your Environment Variables
```env
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
JWT_EXPIRES_IN=7d

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Frontend URL (for CORS) - Where your frontend/mobile app is hosted
# This is where your app makes API calls FROM (not where the backend is)
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Backend URL (optional) - Your backend domain or VPS IP
# Use your domain if you have one: https://api.yourdomain.com
# Or use your VPS IP: http://123.45.67.89
BACKEND_URL=https://api.yourdomain.com

# Server Configuration
PORT=5000
NODE_ENV=production
```

**Important:** 
- **FRONTEND_URL**: Where your frontend/mobile app is hosted (e.g., Vercel, Netlify, or your domain)
- **BACKEND_URL**: Your backend domain (if you have one) or VPS IP address (optional)
- Replace `MONGODB_URI` with your actual MongoDB connection string
- Generate a strong `JWT_SECRET` (you can use: `openssl rand -base64 32`)
- Save and exit: `Ctrl+X`, then `Y`, then `Enter`

**Note:** If you don't have a domain yet, you can use your VPS IP for `BACKEND_URL` or leave it empty. The backend will work either way.

### 7.3 Secure the .env File
```bash
chmod 600 .env
```

---

## 🚀 Step 8: Start Your Application with PM2

### 8.1 Start the Application
```bash
cd ~/app/backend
pm2 start server.js --name "construction-backend"
```

### 8.2 Configure PM2 to Start on Boot
```bash
pm2 startup
# Run the command that PM2 outputs (it will be different for each system)
pm2 save
```

### 8.3 Useful PM2 Commands
```bash
pm2 list              # View all processes
pm2 logs              # View logs
pm2 logs construction-backend  # View specific app logs
pm2 restart construction-backend  # Restart app
pm2 stop construction-backend    # Stop app
pm2 delete construction-backend  # Delete app from PM2
pm2 monit             # Monitor resources
```

### 8.4 Test Your Application
```bash
# Test locally on server
curl http://localhost:5000
curl http://localhost:5000/api/health
```

---

## 🌐 Step 9: Install and Configure Nginx

### 9.1 Install Nginx
```bash
sudo apt install nginx -y  # Ubuntu/Debian
sudo yum install nginx -y  # CentOS/RHEL
```

### 9.2 Configure Nginx as Reverse Proxy
```bash
sudo nano /etc/nginx/sites-available/construction-backend
```

**For Ubuntu/Debian**, add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for large requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**For CentOS/RHEL**, create the file in `/etc/nginx/conf.d/`:
```bash
sudo nano /etc/nginx/conf.d/construction-backend.conf
```
(Use the same configuration above)

### 9.3 Enable the Site (Ubuntu/Debian)
```bash
sudo ln -s /etc/nginx/sites-available/construction-backend /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### 9.4 Start and Enable Nginx (CentOS/RHEL)
```bash
sudo nginx -t  # Test configuration
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 🔒 Step 10: Configure Firewall

### 10.1 For Ubuntu/Debian (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### 10.2 For CentOS/RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 🔐 Step 11: Set Up SSL Certificate (Let's Encrypt)

### 11.1 Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### 11.2 Obtain SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts:
- Enter your email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 11.3 Auto-Renewal (Already configured by Certbot)
```bash
# Test renewal
sudo certbot renew --dry-run
```

---

## ✅ Step 12: Test Your Deployment

### 12.1 Test from Browser
- Visit: `http://your-domain.com` or `https://your-domain.com`
- Visit: `http://your-domain.com/api/health`

### 12.2 Test API Endpoints
```bash
# From your local machine
curl https://your-domain.com/api/health
curl https://your-domain.com/
```

### 12.3 Check Logs
```bash
# Application logs
pm2 logs construction-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Step 13: Update Your Application

### 13.1 When You Make Changes
```bash
cd ~/app/backend

# If using Git
git pull origin main

# Install new dependencies (if any)
npm install --production

# Restart the application
pm2 restart construction-backend

# Check logs
pm2 logs construction-backend
```

---

## 🛠️ Troubleshooting

### Issue: Application won't start
```bash
# Check PM2 logs
pm2 logs construction-backend

# Check if port is in use
sudo netstat -tulpn | grep 5000

# Check environment variables
cd ~/app/backend
cat .env
```

### Issue: Can't connect to MongoDB
- Verify MongoDB Atlas network access includes your VPS IP
- Check MongoDB connection string in `.env`
- Test connection: `mongosh "your-connection-string"`

### Issue: Nginx 502 Bad Gateway
```bash
# Check if Node.js app is running
pm2 list

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify app is listening on port 5000
curl http://localhost:5000
```

### Issue: CORS Errors
- Update `FRONTEND_URL` in `.env` file
- Restart application: `pm2 restart construction-backend`

### Issue: Permission Denied
```bash
# Fix file permissions
sudo chown -R deploy:deploy ~/app
chmod 600 ~/app/backend/.env
```

---

## 📊 Monitoring and Maintenance

### Daily Checks
```bash
# Check application status
pm2 status

# Check server resources
htop  # or top

# Check disk space
df -h
```

### Weekly Tasks
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
sudo yum update -y  # CentOS/RHEL

# Check PM2 logs for errors
pm2 logs construction-backend --lines 100
```

---

## 🔐 Security Best Practices

1. **Keep System Updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use Strong Passwords**
   - Change default root password
   - Use SSH keys instead of passwords

3. **Configure Fail2Ban** (Protect against brute force)
   ```bash
   sudo apt install fail2ban -y
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

4. **Regular Backups**
   - Backup your `.env` file
   - Backup your code
   - Backup your database

5. **Monitor Logs Regularly**
   ```bash
   pm2 logs construction-backend
   sudo tail -f /var/log/nginx/access.log
   ```

---

## 📝 Quick Reference Commands

```bash
# Application Management
pm2 start server.js --name "construction-backend"
pm2 restart construction-backend
pm2 stop construction-backend
pm2 logs construction-backend
pm2 list

# Nginx Management
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t

# System Management
sudo apt update && sudo apt upgrade -y
df -h  # Check disk space
free -h  # Check memory
htop  # Monitor resources

# Firewall
sudo ufw status  # Ubuntu/Debian
sudo firewall-cmd --list-all  # CentOS/RHEL
```

---

## 🎉 You're Done!

Your backend should now be:
- ✅ Running on your VPS
- ✅ Accessible via your domain/IP
- ✅ Protected with SSL (if you set up domain)
- ✅ Auto-restarting on server reboot
- ✅ Monitored with PM2

**Next Steps:**
1. Update your frontend to use the new backend URL
2. Test all API endpoints
3. Set up monitoring alerts
4. Configure regular backups

---

## 📞 Need Help?

If you encounter issues:
1. Check PM2 logs: `pm2 logs construction-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify environment variables are set correctly
4. Ensure MongoDB connection is working
5. Check firewall rules

Good luck with your deployment! 🚀

