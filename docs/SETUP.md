# 🚀 GeminiChatbotv6 Complete Setup Guide

This guide will walk you through setting up GeminiChatbotv6 from scratch, including all optional features and services.

## 📋 Prerequisites

### System Requirements
- **Node.js 20+** (LTS recommended)
- **npm** or **pnpm** package manager
- **Git** for version control
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Node.js Setup with nvm (Recommended)
```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source profile
source ~/.bashrc  # or ~/.zshrc

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
```

## 🔑 API Keys Setup

### Step 1: Essential API Key (Required)

#### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" → "Create API Key"
4. Copy your API key

### Step 2: Recommended API Keys

#### Perplexity (Web Search)
1. Go to [Perplexity API](https://www.perplexity.ai/settings/api)
2. Sign up for an account
3. Generate an API key
4. Copy your API key

#### OpenAI (GPT-4 & DALL-E)
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up and add billing information
3. Go to API Keys → Create new secret key
4. Copy your API key

### Step 3: Optional API Keys

#### Anthropic Claude
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up for an account
3. Generate an API key
4. Copy your API key

#### Replicate (Video Generation)
1. Go to [Replicate](https://replicate.com/)
2. Sign up for an account
3. Go to Account → API Tokens
4. Create and copy your token

#### Wavespeed (Advanced TTS & Flux)
1. Go to [Wavespeed](https://wavespeed.ai/)
2. Sign up for an account
3. Generate an API key
4. Copy your API key

## 💾 Storage & Database Setup (Optional but Recommended)

### Supabase Database Setup

#### Create Supabase Project
1. Go to [Supabase](https://supabase.com/)
2. Sign up for a free account
3. Click "New Project"
4. Choose organization and fill project details:
   - **Name**: `geminichatbotv6`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your location
5. Wait for project creation (2-3 minutes)

#### Get Supabase Credentials
1. Go to Settings → API
2. Copy the following:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGc...`)

#### Setup Database Tables
The application will automatically create required tables, or you can run:
```bash
npm run db:setup-all
```

### Vercel Blob Storage Setup

#### Create Blob Store
1. Go to [Vercel](https://vercel.com/)
2. Sign up for a free account
3. Go to Storage tab
4. Click "Create Database" → "Blob"
5. Name it: `geminichatbotv6-storage`
6. Click "Create"

#### Get Blob Token
1. Go to your blob store
2. Click "Settings" → "Tokens"
3. Create new token with **Read/Write** access
4. Copy the token (starts with `vercel_blob_rw_...`)

## 🛠️ Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/AjWestfield/geminichatbotv6.git
cd geminichatbotv6
```

### Step 2: Install Dependencies
```bash
# Using npm
npm install

# Or using pnpm (faster)
pnpm install
```

### Step 3: Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local
```

### Step 4: Configure Environment Variables

Edit `.env.local` with your API keys:

```env
# ===== REQUIRED =====
# Get from Google AI Studio (free tier available)
GEMINI_API_KEY=your_gemini_api_key_here

# ===== RECOMMENDED =====
# Web search capabilities
PERPLEXITY_API_KEY=your_perplexity_key_here

# GPT-4 and DALL-E access
OPENAI_API_KEY=your_openai_key_here

# ===== STORAGE & PERSISTENCE (OPTIONAL) =====
# Supabase for chat history and data persistence
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your_supabase_anon_key_here

# Vercel Blob for media storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# ===== OPTIONAL AI PROVIDERS =====
# Claude models
ANTHROPIC_API_KEY=your_claude_key_here

# Video generation
REPLICATE_API_KEY=your_replicate_key_here

# Advanced TTS and Flux image generation
WAVESPEED_API_KEY=your_wavespeed_key_here

# Alternative web search
TAVILY_API_KEY=your_tavily_key_here

# X.AI models
XAI_API_KEY=your_xai_key_here

# OpenRouter models
OPENROUTER_API_KEY=your_openrouter_key_here

# ===== ADVANCED FEATURES (OPTIONAL) =====
# Web scraping capabilities
FIRECRAWL_API_KEY=your_firecrawl_key_here

# GitHub integration
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token_here

# Redis caching (if you have Redis server)
REDIS_URL=redis://localhost:6379

# Authentication (for future features)
AUTH_SECRET=your_random_32_character_secret_here

# Cookie encryption for social media features
COOKIE_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

## 🚀 First Run

### Step 1: Verify Installation
```bash
# Check if all dependencies are installed correctly
npm run verify:install

# Verify API keys are configured
npm run check-api-keys
```

### Step 2: Setup Database (if using Supabase)
```bash
# Check database connection
npm run db:check

# Create all required tables
npm run db:setup-all

# Verify tables were created
npm run db:migrate
```

### Step 3: Start Development Server
```bash
# Start the development server
npm run dev

# Or use the helper script (recommended)
./start.sh
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## ✅ Verification Steps

### 1. Basic Functionality
- [ ] Application loads without errors
- [ ] Can send a text message and receive AI response
- [ ] Settings panel opens and shows configured models

### 2. Image Features (if OpenAI/Wavespeed configured)
- [ ] Can generate images from text prompts
- [ ] Can upload and analyze images
- [ ] Image gallery displays generated images

### 3. Web Search (if Perplexity configured)
- [ ] Can ask questions that trigger web search
- [ ] Search results appear in responses
- [ ] Web search indicator shows during searches

### 4. Persistence (if Supabase configured)
- [ ] Chat history persists after page refresh
- [ ] Can create new chats and switch between them
- [ ] Generated images persist in gallery

### 5. File Upload
- [ ] Can upload images, videos, and audio files
- [ ] Files are analyzed automatically
- [ ] Upload progress is shown

## 🔧 Troubleshooting

### Common Issues

#### "Module not found" errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### API key not working
```bash
# Verify API keys are set correctly
npm run check-api-keys

# Check .env.local file exists and has correct format
cat .env.local | grep API_KEY
```

#### Database connection issues
```bash
# Verify Supabase credentials
npm run db:check

# Check if tables exist
npm run db:setup-all
```

#### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Getting Help

1. **Check the logs**: Look at browser console and terminal output
2. **Verify environment**: Ensure all required environment variables are set
3. **Check API quotas**: Verify you haven't exceeded API limits
4. **Review documentation**: Check specific feature documentation
5. **Create an issue**: If problem persists, create a GitHub issue

## 🎯 Next Steps

### Explore Features
1. **Try different AI models** in the settings panel
2. **Upload various file types** to test multi-modal capabilities
3. **Generate images and videos** using different prompts
4. **Use web search** for current information
5. **Explore MCP tools** for advanced functionality

### Customize Your Setup
1. **Configure MCP servers** for additional tools
2. **Set up browser automation** for web scraping
3. **Enable social media features** with cookie management
4. **Add custom themes** and styling

### Production Deployment
1. **Deploy to Vercel** for easy hosting
2. **Set up monitoring** and error tracking
3. **Configure backups** for your data
4. **Set up CI/CD** for automated deployments

## 📚 Additional Resources

- [API Documentation](docs/API.md)
- [MCP Integration Guide](docs/MCP.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Feature Documentation](docs/FEATURES.md)

---

**Congratulations! 🎉 Your GeminiChatbotv6 is now ready to use!**
