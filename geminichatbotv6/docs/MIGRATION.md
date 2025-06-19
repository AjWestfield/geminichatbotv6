# 🔄 Migration from GeminiChatbotv5 to v6

This guide helps you migrate from your existing GeminiChatbotv5 setup to the new GeminiChatbotv6 repository.

## 📋 Pre-Migration Checklist

### 1. Backup Your Current Setup
```bash
# Navigate to your v5 directory
cd /path/to/geminichatbotv5

# Create a backup of your environment file
cp .env.local .env.local.backup

# Backup any custom configurations
cp mcp.config.json mcp.config.json.backup 2>/dev/null || echo "No MCP config to backup"
cp settings.local.json settings.local.json.backup 2>/dev/null || echo "No local settings to backup"
```

### 2. Document Your Current Configuration
```bash
# Check which API keys you have configured
npm run check-api-keys

# Note down your current database settings (if using persistence)
echo "Current Supabase URL: $SUPABASE_URL"
echo "Current Blob Token: ${BLOB_READ_WRITE_TOKEN:0:20}..."
```

## 🚀 Migration Steps

### Step 1: Create New Repository

Since I don't have permission to create repositories directly, please follow these steps:

1. **Go to GitHub**: Navigate to [github.com](https://github.com)
2. **Create New Repository**:
   - Click the "+" icon → "New repository"
   - Repository name: `geminichatbotv6`
   - Description: `Advanced AI chatbot with multi-modal capabilities, image/video generation, TTS, web search, and MCP server integration. Built with Next.js 15, React 19, and multiple AI providers.`
   - Set to **Public** (recommended) or **Private**
   - ✅ Initialize with README
   - ✅ Add .gitignore (Node template)
   - ✅ Choose MIT License
3. **Clone the new repository**:
```bash
git clone https://github.com/AjWestfield/geminichatbotv6.git
cd geminichatbotv6
```

### Step 2: Copy Core Files from v5

```bash
# Set paths (adjust these to your actual paths)
V5_PATH="/path/to/geminichatbotv5"
V6_PATH="/path/to/geminichatbotv6"

# Navigate to v6 directory
cd $V6_PATH

# Copy essential application files
cp -r $V5_PATH/app ./
cp -r $V5_PATH/components ./
cp -r $V5_PATH/lib ./
cp -r $V5_PATH/hooks ./
cp -r $V5_PATH/types ./
cp -r $V5_PATH/styles ./
cp -r $V5_PATH/public ./

# Copy configuration files
cp $V5_PATH/package.json ./
cp $V5_PATH/next.config.mjs ./
cp $V5_PATH/tailwind.config.ts ./
cp $V5_PATH/tsconfig.json ./
cp $V5_PATH/postcss.config.mjs ./
cp $V5_PATH/components.json ./
cp $V5_PATH/playwright.config.ts ./

# Copy scripts and utilities
cp -r $V5_PATH/scripts ./
cp -r $V5_PATH/tests ./
cp -r $V5_PATH/providers ./
cp -r $V5_PATH/services ./

# Copy example servers and MCP configuration
cp -r $V5_PATH/example-servers ./
cp $V5_PATH/mcp.config.example.json ./
[ -f $V5_PATH/mcp.config.json ] && cp $V5_PATH/mcp.config.json ./

# Copy helper scripts
cp $V5_PATH/start.sh ./
cp $V5_PATH/*.sh ./ 2>/dev/null || echo "No shell scripts to copy"

# Copy database files
cp -r $V5_PATH/lib/database ./lib/ 2>/dev/null || echo "Database files already copied"
```

### Step 3: Update Package Information

Edit `package.json` to update the project information:
```json
{
  "name": "geminichatbotv6",
  "version": "6.0.0",
  "description": "Advanced AI chatbot with multi-modal capabilities",
  "repository": {
    "type": "git",
    "url": "https://github.com/AjWestfield/geminichatbotv6.git"
  },
  "homepage": "https://github.com/AjWestfield/geminichatbotv6#readme",
  "bugs": {
    "url": "https://github.com/AjWestfield/geminichatbotv6/issues"
  }
}
```

### Step 4: Environment Migration

```bash
# Copy your environment file (but don't commit it!)
cp $V5_PATH/.env.local ./.env.local

# Create the example file for others
cp .env.local .env.example
# Then manually remove the actual API keys from .env.example, leaving just the variable names
```

### Step 5: Install Dependencies and Test

```bash
# Install dependencies
npm install

# Verify installation
npm run verify:install

# Check API keys
npm run check-api-keys

# Test the application
npm run dev
```

### Step 6: Database Migration (if using persistence)

If you were using Supabase in v5:

```bash
# Check database connection
npm run db:check

# The existing tables should work as-is, but run this to ensure all tables exist
npm run db:setup-all

# Verify migration
npm run db:migrate
```

### Step 7: Commit and Push

```bash
# Add all files
git add .

# Create .gitignore to exclude sensitive files
echo ".env.local" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".next/" >> .gitignore
echo "*.log" >> .gitignore

# Commit the migration
git commit -m "Initial migration from geminichatbotv5 to v6

- Migrated all core application files
- Updated package.json for v6
- Added comprehensive documentation
- Maintained backward compatibility
- Enhanced setup process"

# Push to GitHub
git push origin main
```

## 🔍 Post-Migration Verification

### 1. Functionality Test
- [ ] Application starts without errors
- [ ] All your configured AI models work
- [ ] Chat history is preserved (if using persistence)
- [ ] Generated images/videos are accessible
- [ ] Web search functionality works
- [ ] File upload and analysis work

### 2. Feature Verification
```bash
# Test image generation
npm run test-image-generation

# Test TTS functionality
npm run test-tts-functionality

# Test web search
npm run test-web-search

# Run full test suite
npm run test:e2e
```

### 3. Performance Check
- [ ] Application loads quickly
- [ ] No console errors in browser
- [ ] All API endpoints respond correctly
- [ ] Database queries are efficient

## 🆕 New Features in v6

### Enhanced Documentation
- Comprehensive setup guide
- Detailed API documentation
- Troubleshooting guides
- Contributing guidelines

### Improved Developer Experience
- Better error handling and logging
- Enhanced development scripts
- Improved testing coverage
- Streamlined configuration

### Security Enhancements
- Better API key management
- Enhanced input validation
- Improved error handling
- Security best practices

### Performance Optimizations
- Better caching strategies
- Optimized database queries
- Improved file handling
- Enhanced streaming responses

## 🔧 Troubleshooting Migration Issues

### Common Issues

#### Missing Dependencies
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Environment Variables Not Working
```bash
# Verify .env.local exists and has correct format
cat .env.local | head -5

# Check for hidden characters or encoding issues
file .env.local
```

#### Database Connection Issues
```bash
# Test connection
npm run db:check

# Recreate tables if needed
npm run db:setup-all
```

#### API Keys Not Recognized
```bash
# Verify API key format
npm run check-api-keys

# Test individual services
npm run test-gemini-api
npm run test-openai-api
```

### Getting Help

1. **Check the logs**: Browser console and terminal output
2. **Compare with v5**: Ensure all files were copied correctly
3. **Verify environment**: Double-check all environment variables
4. **Test incrementally**: Test one feature at a time
5. **Create an issue**: If problems persist, create a GitHub issue

## 📚 Next Steps

### 1. Explore New Features
- Review the updated documentation
- Try new AI models and capabilities
- Explore enhanced MCP integration
- Test improved web search functionality

### 2. Customize Your Setup
- Update your MCP server configurations
- Customize the UI and themes
- Add any custom integrations
- Configure advanced features

### 3. Share and Contribute
- Star the repository on GitHub
- Share your setup with the community
- Contribute improvements and bug fixes
- Help others with their migrations

---

**Migration Complete! 🎉**

Your GeminiChatbotv6 is now ready with all the enhanced features and improved documentation. Enjoy the upgraded experience!
