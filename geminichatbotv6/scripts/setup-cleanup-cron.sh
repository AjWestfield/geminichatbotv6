#!/bin/bash
# Setup script for file cleanup cron job

echo "🔧 Setting up file cleanup cron job..."
echo "====================================="

# Check if node-cron is installed
if ! npm list node-cron >/dev/null 2>&1; then
    echo "📦 Installing node-cron..."
    npm install node-cron
fi

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 detected, using PM2 for process management"
    
    # Stop existing process if running
    pm2 delete file-cleanup 2>/dev/null || true
    
    # Start the cleanup cron job with PM2
    echo "🚀 Starting cleanup cron job with PM2..."
    pm2 start cleanup-cron.js --name file-cleanup --time
    
    # Save PM2 configuration
    pm2 save
    
    echo "✅ Cleanup cron job started successfully!"
    echo ""
    echo "📋 PM2 Commands:"
    echo "  View logs:    pm2 logs file-cleanup"
    echo "  View status:  pm2 status"
    echo "  Stop job:     pm2 stop file-cleanup"
    echo "  Restart job:  pm2 restart file-cleanup"
    echo ""
    echo "🔧 To make the job persist after reboot:"
    echo "  Run: pm2 startup"
    echo "  Follow the instructions provided"
    
else
    echo "⚠️  PM2 not found. Running in basic mode..."
    echo ""
    echo "For production use, we recommend installing PM2:"
    echo "  npm install -g pm2"
    echo ""
    echo "Starting cleanup job in foreground mode..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Run in foreground
    node cleanup-cron.js
fi