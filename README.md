# 🤖 GeminiChatbotv6

> **Advanced AI Chatbot with Multi-Modal Capabilities**

A powerful, feature-rich AI chatbot built with Next.js 15 and React 19, featuring multi-modal conversations, content generation, web search, and extensible tool integration through MCP servers.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20+-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)

## ✨ Features

### 🧠 Multi-Modal AI Chat
- **Text Conversations** with multiple AI models (Gemini, GPT-4, Claude)
- **Image Analysis** and generation (DALL-E, Flux, Replicate)
- **Video Processing** with transcription and generation
- **Audio Support** with transcription and text-to-speech
- **File Uploads** with automatic analysis and processing

### 🎨 Content Generation
- **Image Generation**: DALL-E 3, Flux models, Replicate
- **Video Creation**: Text-to-video and image-to-video
- **Audio Synthesis**: Multi-speaker TTS with context awareness
- **Image Editing**: AI-powered image modification
- **Upscaling**: High-quality image enhancement

### 🌐 Web Integration
- **Smart Web Search** with Perplexity integration
- **Content Extraction** via Firecrawl
- **Browser Automation** with Playwright
- **Deep Research** with multi-step analysis
- **Social Media** cookie management

### 🔧 Advanced Tools
- **MCP Servers**: Extensible tool ecosystem
- **LangGraph Workflows**: Complex task orchestration
- **Desktop Commander**: File system and terminal access
- **GitHub Integration**: Repository management
- **Database Tools**: SQL query execution

### 💾 Persistence & Storage
- **Chat History**: Full conversation persistence
- **Media Gallery**: Organized image/video/audio storage
- **Cloud Storage**: Vercel Blob integration
- **Database**: Supabase PostgreSQL backend
- **Caching**: Redis and local storage optimization

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** (managed via nvm recommended)
- **npm** or **pnpm**
- **Git**
- At least one API key (minimum: `GEMINI_API_KEY`)

### 1. Clone and Install
```bash
git clone https://github.com/AjWestfield/geminichatbotv6.git
cd geminichatbotv6
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
```

Add your API keys to `.env.local`:
```env
# Required - Get from Google AI Studio
GEMINI_API_KEY=your_gemini_api_key

# Recommended for full functionality
PERPLEXITY_API_KEY=your_perplexity_key    # Web search
OPENAI_API_KEY=your_openai_key            # GPT-4, DALL-E
```

### 3. Start Development Server
```bash
npm run dev
# or use the helper script
./start.sh
```

Open [http://localhost:3000](http://localhost:3000) and start chatting! 🎉

## 📋 Complete Setup Guide

### Required API Keys

#### Essential (Minimum Setup)
```env
GEMINI_API_KEY=your_gemini_key                    # Google AI Studio (free tier available)
```

#### Recommended for Full Features
```env
PERPLEXITY_API_KEY=your_perplexity_key           # Web search capabilities
OPENAI_API_KEY=your_openai_key                   # GPT-4 and DALL-E access
```

#### Optional Enhancements
```env
ANTHROPIC_API_KEY=your_claude_key                # Claude models
REPLICATE_API_KEY=your_replicate_key             # Video generation
WAVESPEED_API_KEY=your_wavespeed_key             # Advanced TTS and Flux
TAVILY_API_KEY=your_tavily_key                   # Alternative web search
XAI_API_KEY=your_xai_key                         # X.AI models
OPENROUTER_API_KEY=your_openrouter_key           # OpenRouter models
```

### Storage & Persistence (Optional)

For chat history, media storage, and advanced features:

#### Supabase Setup (Recommended)
1. Create account at [supabase.com](https://supabase.com) (free tier available)
2. Create new project
3. Go to Settings → API → Copy your URL and anon key
4. Add to `.env.local`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your_anon_key
```

#### Vercel Blob Storage (Recommended)
1. Create account at [vercel.com](https://vercel.com) (free tier available)
2. Go to Storage → Create Blob Store
3. Generate read/write token
4. Add to `.env.local`:
```env
BLOB_READ_WRITE_TOKEN=your_blob_token
```

#### Database Setup
```bash
# Verify database connection
npm run db:check

# Create all required tables
npm run db:setup-all

# Run any pending migrations
npm run db:migrate
```

### MCP Servers (Optional)

For advanced tool integration:
```env
FIRECRAWL_API_KEY=your_firecrawl_key             # Web scraping
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token   # GitHub integration
```

## 🛠️ Development

### Available Scripts
```bash
# Development
npm run dev                # Start development server
npm run build             # Build for production
npm run start             # Start production server
npm run lint              # Run ESLint

# Testing
npm run test:e2e          # Run Playwright tests
npm run test:e2e:ui       # Run tests with UI
npm run check-api-keys    # Verify API configuration

# Database Management
npm run db:check          # Verify database connection
npm run db:setup-all      # Create all tables
npm run db:migrate        # Run migrations

# Utilities
npm run setup-persistence # Setup database and storage
npm run verify:install    # Verify installation
```

### Project Structure
```
geminichatbotv6/
├── app/                   # Next.js app directory
│   ├── api/              # API routes
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main application
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── chat-interface.tsx
│   ├── app-sidebar.tsx
│   └── canvas-view.tsx
├── lib/                  # Core utilities
│   ├── services/        # Business logic
│   ├── database/        # Database utilities
│   ├── storage/         # File storage
│   └── utils/           # Helper functions
├── hooks/               # Custom React hooks
├── scripts/             # Utility scripts
├── tests/               # Test files
└── docs/                # Documentation
```

### Technology Stack
- **Framework**: Next.js 15.2.4 with App Router
- **Frontend**: React 19, TypeScript 5
- **Styling**: Tailwind CSS, shadcn/ui, Framer Motion
- **State**: Zustand, React Hook Form
- **AI**: Vercel AI SDK, multiple providers
- **Database**: Supabase (PostgreSQL)
- **Storage**: Vercel Blob, IndexedDB
- **Testing**: Playwright, Jest
- **Tools**: ESLint, Prettier, Husky

## 🧪 Testing

### End-to-End Testing
```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run specific test
npx playwright test tests/chat-functionality.spec.ts
```

### API Testing
```bash
# Test specific features
npm run test-image-generation
npm run test-tts-functionality
npm run test-web-search
```

### Manual Testing
Comprehensive test guides are provided in the `docs/` directory for manual verification of all features.

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Self-Hosted
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables for Production
Ensure all required environment variables are set in your production environment. The app will gracefully degrade functionality for missing optional services.

## 🔧 Configuration

### Feature Toggles
The application automatically detects available services and enables/disables features accordingly:
- Missing `SUPABASE_URL`: Disables persistence, uses local storage
- Missing `BLOB_READ_WRITE_TOKEN`: Disables cloud storage
- Missing AI API keys: Hides corresponding model options

### Customization
- **Models**: Configure available AI models in `lib/models/`
- **Themes**: Customize appearance in `app/globals.css`
- **Components**: Extend UI components in `components/`
- **Tools**: Add MCP servers in `mcp.config.json`

## 📚 Documentation

- [**Setup Guide**](docs/SETUP.md) - Detailed setup instructions
- [**API Reference**](docs/API.md) - API endpoint documentation
- [**MCP Integration**](docs/MCP.md) - Model Context Protocol setup
- [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [**Contributing**](docs/CONTRIBUTING.md) - Development guidelines

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vercel](https://vercel.com) for the AI SDK and hosting platform
- [Supabase](https://supabase.com) for the database and storage
- [OpenAI](https://openai.com), [Google](https://ai.google.dev), [Anthropic](https://anthropic.com) for AI models
- [shadcn/ui](https://ui.shadcn.com) for the component library
- All the open-source contributors who made this possible

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/AjWestfield/geminichatbotv6/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AjWestfield/geminichatbotv6/discussions)
- **Documentation**: [Project Wiki](https://github.com/AjWestfield/geminichatbotv6/wiki)

---

**Made with ❤️ by the GeminiChatbot community**
