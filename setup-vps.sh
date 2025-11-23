#!/bin/bash

# Hostinger VPS Setup Script for Construction Management Backend
# Run this script on your VPS server after connecting via SSH
# Usage: bash setup-vps.sh

set -e  # Exit on error

echo "🚀 Starting VPS Setup for Construction Management Backend..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS $VER${NC}"
echo ""

# Function to install Node.js
install_nodejs() {
    echo -e "${YELLOW}Installing Node.js 18.x...${NC}"
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    else
        echo -e "${RED}Unsupported OS for automatic Node.js installation${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Node.js installed: $(node --version)${NC}"
    echo -e "${GREEN}npm installed: $(npm --version)${NC}"
}

# Function to install PM2
install_pm2() {
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}PM2 installed${NC}"
}

# Function to install Nginx
install_nginx() {
    echo -e "${YELLOW}Installing Nginx...${NC}"
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update
        apt-get install -y nginx
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y nginx
    fi
    
    systemctl enable nginx
    systemctl start nginx
    echo -e "${GREEN}Nginx installed and started${NC}"
}

# Function to install Git
install_git() {
    echo -e "${YELLOW}Installing Git...${NC}"
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y git
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y git
    fi
    
    echo -e "${GREEN}Git installed${NC}"
}

# Function to configure firewall
configure_firewall() {
    echo -e "${YELLOW}Configuring firewall...${NC}"
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        if command -v ufw &> /dev/null; then
            ufw allow OpenSSH
            ufw allow 'Nginx Full'
            echo -e "${YELLOW}Firewall rules added. Run 'ufw enable' to activate.${NC}"
        fi
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        if command -v firewall-cmd &> /dev/null; then
            firewall-cmd --permanent --add-service=ssh
            firewall-cmd --permanent --add-service=http
            firewall-cmd --permanent --add-service=https
            firewall-cmd --reload
            echo -e "${GREEN}Firewall configured${NC}"
        fi
    fi
}

# Main installation
echo "Step 1: Updating system packages..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt update && apt upgrade -y
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum update -y
fi

echo ""
echo "Step 2: Installing required software..."
install_git
install_nodejs
install_pm2
install_nginx

echo ""
echo "Step 3: Configuring firewall..."
configure_firewall

echo ""
echo -e "${GREEN}✅ Basic setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Create application directory: mkdir -p ~/app && cd ~/app"
echo "2. Upload your backend code to ~/app/backend/"
echo "3. Create .env file with your configuration"
echo "4. Run: cd ~/app/backend && npm install --production"
echo "5. Start with PM2: pm2 start server.js --name 'construction-backend'"
echo "6. Configure PM2 startup: pm2 startup && pm2 save"
echo "7. Configure Nginx reverse proxy (see HOSTINGER_VPS_DEPLOYMENT.md)"
echo ""
echo "For detailed instructions, see: HOSTINGER_VPS_DEPLOYMENT.md"

