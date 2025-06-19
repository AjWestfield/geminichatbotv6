# 🔧 GeminiChatbotv6 Troubleshooting Guide

This guide helps you resolve common issues when setting up and using GeminiChatbotv6.

## 🚨 Quick Diagnostics

### Run Built-in Diagnostics
```bash
# Check overall installation
npm run verify:install

# Verify API keys
npm run check-api-keys

# Test database connection (if using persistence)
npm run db:check

# Check environment variables
npm run check-env
```

## 🔑 API Key Issues

### Problem: "API key not configured" or "Invalid API key"

#### Solution 1: Verify Environment File
```bash
# Check if .env.local exists
ls -la .env.local

# Verify content format (should not show actual keys)
head -5 .env.local
```

#### Solution 2: Check API Key Format
```bash
# Gemini API key should start with "AIza"
echo $GEMINI_API_KEY | cut -c1-4

# OpenAI API key should start with "sk-"
echo $OPENAI_API_KEY | cut -c1-3

# Perplexity API key should start with "pplx-"
echo $PERPLEXITY_API_KEY | cut -c1-5
```

#### Solution 3: Test Individual APIs
```bash
# Test Gemini API
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY"

# Test OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}],"max_tokens":5}' \
     https://api.openai.com/v1/chat/completions
```

### Problem: API quota exceeded

#### Solution: Check Usage and Limits
1. **Gemini**: Check [Google AI Studio](https://aistudio.google.com/) quota
2. **OpenAI**: Check [OpenAI Usage](https://platform.openai.com/usage)
3. **Perplexity**: Check [Perplexity Dashboard](https://www.perplexity.ai/settings/api)

## 🗄️ Database Issues

### Problem: "Database connection failed"

#### Solution 1: Verify Supabase Configuration
```bash
# Check Supabase URL format
echo $SUPABASE_URL | grep -E "^https://[a-z]+\.supabase\.co$"

# Test connection
curl -H "apikey: $SUPABASE_API_KEY" \
     -H "Authorization: Bearer $SUPABASE_API_KEY" \
     "$SUPABASE_URL/rest/v1/"
```

#### Solution 2: Check Database Tables
```bash
# Run database setup
npm run db:setup-all

# Verify tables exist
npm run db:check
```

### Problem: "Table does not exist"

#### Solution: Create Missing Tables
```bash
# Create all required tables
npm run db:setup-all

# Run specific migrations
npm run db:migrate

# Check table creation
npm run db:check
```

## 📁 File Storage Issues

### Problem: "Blob storage not configured"

#### Solution: Setup Vercel Blob
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Storage → Create Blob Store
3. Generate read/write token
4. Add to `.env.local`:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_token_here
```

### Problem: File uploads failing

#### Solution 1: Check File Size Limits
- Maximum file size: 50MB
- Supported formats: Images (JPEG, PNG, WebP, HEIC), Videos (MP4, MOV), Audio (MP3, WAV)

#### Solution 2: Verify Upload Endpoint
```bash
# Test upload endpoint
curl -X POST http://localhost:3000/api/upload \
     -F "file=@/path/to/test/image.jpg"
```

## 🌐 Network and Connectivity Issues

### Problem: "Failed to fetch" or connection timeouts

#### Solution 1: Check Network Configuration
```bash
# Test internet connectivity
ping google.com

# Check if ports are available
lsof -i :3000
```

#### Solution 2: Firewall and Proxy Issues
- Ensure port 3000 is not blocked
- Check corporate firewall settings
- Verify proxy configuration if applicable

### Problem: CORS errors in browser

#### Solution: Check API Configuration
- Ensure API routes are properly configured
- Verify CORS headers in API responses
- Check browser developer tools for specific errors

## 🔧 Installation Issues

### Problem: "Module not found" errors

#### Solution 1: Clean Installation
```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
```

#### Solution 2: Node.js Version Issues
```bash
# Check Node.js version (should be 20+)
node --version

# Use correct version with nvm
nvm use 20
```

### Problem: Permission errors during installation

#### Solution: Fix Permissions
```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm

# Or use nvm to avoid permission issues
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

## 🎨 UI and Display Issues

### Problem: Styles not loading or broken layout

#### Solution 1: Rebuild Styles
```bash
# Clear Next.js cache
rm -rf .next

# Restart development server
npm run dev
```

#### Solution 2: Check Tailwind Configuration
```bash
# Verify Tailwind is working
npx tailwindcss --help

# Check configuration
cat tailwind.config.ts
```

### Problem: Images not displaying

#### Solution 1: Check Image URLs
- Verify blob storage is configured
- Check browser network tab for failed requests
- Ensure images are properly uploaded

#### Solution 2: Clear Browser Cache
- Hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Clear browser cache and cookies
- Try incognito/private browsing mode

## 🤖 AI Model Issues

### Problem: AI responses are slow or timing out

#### Solution 1: Check Model Configuration
```bash
# Verify model settings in the app
# Check if using appropriate model for request type
```

#### Solution 2: Optimize Requests
- Reduce prompt length for faster responses
- Use streaming responses when available
- Check API rate limits

### Problem: Poor quality responses

#### Solution: Adjust Model Parameters
- Try different AI models (GPT-4, Claude, Gemini)
- Adjust temperature and other parameters
- Provide more specific prompts

## 🔍 Development Issues

### Problem: Hot reload not working

#### Solution: Restart Development Server
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Restart server
npm run dev
```

### Problem: TypeScript errors

#### Solution: Check TypeScript Configuration
```bash
# Run TypeScript check
npx tsc --noEmit

# Check TypeScript version
npx tsc --version
```

## 📱 Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Problem: Features not working in specific browsers

#### Solution: Check Browser Compatibility
- Update browser to latest version
- Enable JavaScript
- Check for browser extensions blocking functionality
- Try different browser for comparison

## 🆘 Getting Additional Help

### 1. Enable Debug Mode
```env
# Add to .env.local
DEBUG=true
NODE_ENV=development
```

### 2. Check Logs
```bash
# Browser console logs
# Terminal output from npm run dev
# Network tab in browser developer tools
```

### 3. Create Detailed Issue Report

When creating a GitHub issue, include:

```markdown
## Environment
- OS: [e.g., macOS 12.0, Windows 11, Ubuntu 20.04]
- Node.js version: [run `node --version`]
- Browser: [e.g., Chrome 96, Firefox 94]
- Package version: [check package.json]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Third step]

## Expected Behavior
[What you expected to happen]

## Actual Behavior
[What actually happened]

## Error Messages
```
[Paste any error messages here]
```

## Additional Context
[Any other relevant information]
```

### 4. Community Resources
- **GitHub Issues**: [Repository Issues](https://github.com/AjWestfield/geminichatbotv6/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AjWestfield/geminichatbotv6/discussions)
- **Documentation**: [Project Wiki](https://github.com/AjWestfield/geminichatbotv6/wiki)

## 🔄 Reset to Clean State

### Complete Reset (Last Resort)
```bash
# Backup your .env.local
cp .env.local .env.local.backup

# Remove all generated files
rm -rf node_modules .next package-lock.json

# Reinstall everything
npm install

# Restore environment
cp .env.local.backup .env.local

# Start fresh
npm run dev
```

---

**Still having issues?** Don't hesitate to create a GitHub issue with detailed information about your problem. The community is here to help! 🤝
