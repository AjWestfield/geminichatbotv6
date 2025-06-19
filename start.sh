#!/bin/bash

# Start script for Gemini Chatbot

echo "🚀 Starting Gemini AI Chatbot..."

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 20
nvm use 20

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check API keys
echo ""
echo "🔑 Checking API keys..."
npm run check-api-keys
echo ""

# Start the development server
echo "🌐 Starting development server..."
npm run dev
