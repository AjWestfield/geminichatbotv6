import { Message } from 'ai'

// Generate intelligent chat title based on message content
export function generateChatTitle(messages: Message[], maxLength: number = 50): string {
  console.log('[ChatNaming] Generating title from messages:', messages.length)
  console.log('[ChatNaming] Messages:', messages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + '...' })))
  
  // Find the first substantive user message
  const firstUserMessage = messages.find(msg => 
    msg.role === 'user' && 
    msg.content.trim().length > 10 &&
    !msg.content.toLowerCase().includes('hello') &&
    !msg.content.toLowerCase().includes('hi') &&
    !msg.content.toLowerCase().includes('hey')
  )
  
  console.log('[ChatNaming] First substantive user message:', firstUserMessage?.content.substring(0, 100))

  if (!firstUserMessage) {
    // Fallback to any user message
    const anyUserMessage = messages.find(msg => msg.role === 'user' && msg.content.trim().length > 5)
    if (anyUserMessage) {
      return truncateWithEllipsis(anyUserMessage.content.trim(), maxLength)
    }
    return generateTimeBasedTitle()
  }

  let content = firstUserMessage.content.trim()

  // Clean up common patterns
  content = content
    .replace(/^(please|can you|could you|would you|help me|i need|i want|how do i|how to|what is|what are|tell me|explain|show me)\s+/i, '')
    .replace(/\?+$/, '')
    .replace(/\.+$/, '')
    .trim()

  // Detect content types and create descriptive titles
  if (isImageGenerationRequest(content)) {
    const imagePrompt = extractImagePrompt(content)
    return `Image: ${truncateWithEllipsis(imagePrompt, maxLength - 7)}`
  }

  if (isVideoGenerationRequest(content)) {
    const videoPrompt = extractVideoPrompt(content)
    return `Video: ${truncateWithEllipsis(videoPrompt, maxLength - 7)}`
  }

  if (isCodeRequest(content)) {
    const language = extractCodeLanguage(content)
    return `Code: ${language ? `${language} - ` : ''}${truncateWithEllipsis(content, maxLength - (language ? 8 + language.length : 6))}`
  }

  if (isQuestionRequest(content)) {
    return `Q: ${truncateWithEllipsis(content, maxLength - 3)}`
  }

  // Default: use the cleaned content
  const finalTitle = truncateWithEllipsis(capitalizeFirst(content), maxLength)
  console.log('[ChatNaming] Final generated title:', finalTitle)
  return finalTitle
}

// Helper functions
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

function capitalizeFirst(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function isImageGenerationRequest(content: string): boolean {
  const imageKeywords = [
    'create an image', 'generate an image', 'make an image', 'draw', 'picture of',
    'image of', 'photo of', 'illustration', 'artwork', 'design', 'sketch'
  ]
  return imageKeywords.some(keyword => content.toLowerCase().includes(keyword))
}

function isVideoGenerationRequest(content: string): boolean {
  const videoKeywords = [
    'create a video', 'generate a video', 'make a video', 'animate', 'video of',
    'animation', 'movie', 'clip'
  ]
  return videoKeywords.some(keyword => content.toLowerCase().includes(keyword))
}

function isCodeRequest(content: string): boolean {
  const codeKeywords = [
    'write code', 'code for', 'function', 'class', 'method', 'algorithm',
    'script', 'program', 'implementation', 'syntax', 'debug', 'fix code'
  ]
  const codeLanguages = [
    'javascript', 'python', 'java', 'c++', 'typescript', 'react', 'html', 'css',
    'sql', 'php', 'go', 'rust', 'swift', 'kotlin', 'dart', 'flutter'
  ]
  
  return codeKeywords.some(keyword => content.toLowerCase().includes(keyword)) ||
         codeLanguages.some(lang => content.toLowerCase().includes(lang))
}

function isQuestionRequest(content: string): boolean {
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which']
  const lowerContent = content.toLowerCase()
  
  return questionWords.some(word => lowerContent.startsWith(word)) || 
         content.includes('?') ||
         lowerContent.includes('explain') ||
         lowerContent.includes('tell me about')
}

function extractImagePrompt(content: string): string {
  // Extract the main subject/prompt for image generation
  const patterns = [
    /(?:create|generate|make|draw)(?:\s+an?)?\s+image\s+of\s+(.+)/i,
    /(?:picture|photo|illustration)\s+of\s+(.+)/i,
    /(?:create|generate|make|draw)\s+(.+)/i
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return content
}

function extractVideoPrompt(content: string): string {
  // Extract the main subject/prompt for video generation
  const patterns = [
    /(?:create|generate|make)(?:\s+a)?\s+video\s+of\s+(.+)/i,
    /animate\s+(.+)/i,
    /(?:create|generate|make)\s+(.+)/i
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return content
}

function extractCodeLanguage(content: string): string | null {
  const languages = [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'php', 'go', 
    'rust', 'swift', 'kotlin', 'dart', 'html', 'css', 'sql', 'react', 'vue', 'angular'
  ]
  
  const lowerContent = content.toLowerCase()
  for (const lang of languages) {
    if (lowerContent.includes(lang)) {
      return lang.charAt(0).toUpperCase() + lang.slice(1)
    }
  }
  
  return null
}

function generateTimeBasedTitle(): string {
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return `Chat ${dateStr} ${timeStr}`
}

// Generate chat title with timestamp for sidebar display
export function formatChatTitleWithTime(title: string, createdAt: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  let timeStr: string
  if (diffDays === 0) {
    // Today - show time
    timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    // Yesterday
    timeStr = 'Yesterday'
  } else if (diffDays < 7) {
    // This week - show day
    timeStr = createdAt.toLocaleDateString([], { weekday: 'short' })
  } else {
    // Older - show date
    timeStr = createdAt.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  
  return `${title} • ${timeStr}`
}