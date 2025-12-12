# Quick Start: Deploy to Hostinger VPS

This is your quick reference guide. For detailed instructions, see `HOSTINGER_VPS_DEPLOYMENT.md`.

## 🎯 What You Need

- Hostinger VPS IP address and root password
- MongoDB Atlas connection string (or plan to install MongoDB)
- Your backend code ready

## ⚡ Quick Steps

### 1. Connect to Your VPS
```bash
ssh root@YOUR_VPS_IP
```

### 2. Run Setup Script (Optional - Automates installation)
```bash
# Upload setup-vps.sh to your VPS first, then:
bash setup-vps.sh
```

**OR** Install manually:
```bash
# Update system
apt update && apt upgrade -y  # Ubuntu/Debian
# OR
yum update -y  # CentOS/RHEL

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs  # Ubuntu/Debian

# Install PM2
npm install -g pm2

# Install Nginx
apt install nginx -y  # Ubuntu/Debian
```

### 3. Upload Your Backend Code
```bash
# Option A: Using Git
mkdir -p ~/app
cd ~/app
git clone YOUR_REPO_URL backend
cd backend

# Option B: Using SCP (from your local machine)
# scp -r * root@YOUR_VPS_IP:~/app/backend/
```

### 4. Install Dependencies
```bash
cd ~/app/backend
npm install --production
```

### 5. Create .env File
```bash
nano .env
```

Add:
```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=generate-with-openssl-rand-base64-32
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-frontend-domain.com
PORT=5000
NODE_ENV=production
```

Save: `Ctrl+X`, `Y`, `Enter`

### 6. Start Application
```bash
pm2 start server.js --name "construction-backend"
pm2 startup
pm2 save
```

### 7. Configure Nginx
```bash
# Copy nginx-config.conf content to:
sudo nano /etc/nginx/sites-available/construction-backend  # Ubuntu/Debian
# OR
sudo nano /etc/nginx/conf.d/construction-backend.conf  # CentOS/RHEL

# Update server_name with your domain/IP
# Enable site (Ubuntu/Debian only)
sudo ln -s /etc/nginx/sites-available/construction-backend /etc/nginx/sites-enabled/

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Configure Firewall
```bash
# Ubuntu/Debian
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 9. Test
```bash
# From server
curl http://localhost:5000

# From browser
http://YOUR_VPS_IP/
http://YOUR_VPS_IP/api/health
```

### 10. SSL (If you have a domain)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## ✅ Verify Everything Works

```bash
# Check PM2
pm2 list
pm2 logs construction-backend

# Check Nginx
sudo systemctl status nginx

# Test endpoints
curl http://localhost:5000/api/health
```

## 📚 Full Documentation

- **Complete Guide**: `HOSTINGER_VPS_DEPLOYMENT.md`
- **Checklist**: `DEPLOYMENT_CHECKLIST.md`
- **Nginx Config**: `nginx-config.conf`

## 🆘 Common Issues

**Application won't start?**
```bash
pm2 logs construction-backend
```

**502 Bad Gateway?**
```bash
# Check if app is running
pm2 list
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

**Can't connect to MongoDB?**
- Verify MongoDB Atlas network access includes your VPS IP
- Check connection string in `.env`

## 🎉 Done!

Your backend should now be running at `http://YOUR_VPS_IP` or `https://your-domain.com`


