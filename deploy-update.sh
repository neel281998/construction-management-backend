#!/bin/bash

# Quick deployment script for updating backend on VPS
# Run this script on your VPS after connecting via SSH
# Usage: bash deploy-update.sh

echo "🚀 Deploying updated backend to VPS..."
echo ""

# Navigate to backend directory
cd ~/app/backend || {
    echo "❌ Error: Backend directory not found at ~/app/backend"
    echo "Please check your directory structure"
    exit 1
}

echo "📁 Current directory: $(pwd)"
echo ""

# Pull latest changes from git
echo "📥 Pulling latest changes from git..."
git pull origin main || {
    echo "❌ Error: Failed to pull from git"
    echo "Make sure you're in the correct directory and git is configured"
    exit 1
}

echo "✅ Git pull completed"
echo ""

# Install/update dependencies
echo "📦 Installing/updating dependencies..."
npm install --production || {
    echo "❌ Error: Failed to install dependencies"
    exit 1
}

echo "✅ Dependencies installed"
echo ""

# Restart PM2 application
echo "🔄 Restarting application with PM2..."
pm2 restart construction-backend || {
    echo "⚠️  Warning: PM2 restart failed, trying to start..."
    pm2 start server.js --name "construction-backend" || {
        echo "❌ Error: Failed to start application"
        exit 1
    }
}

echo "✅ Application restarted"
echo ""

# Show PM2 status
echo "📊 Current PM2 status:"
pm2 list

echo ""
echo "📋 Recent logs:"
pm2 logs construction-backend --lines 20 --nostream

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 To monitor logs in real-time, run:"
echo "   pm2 logs construction-backend"
echo ""
echo "🧪 Test your API:"
echo "   curl http://localhost:5000/api/health"

