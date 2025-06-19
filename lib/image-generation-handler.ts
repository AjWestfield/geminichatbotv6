/**
 * Image Generation Handler
 * Detects and processes image generation requests
 */

export interface ImageGenerationRequest {
  type: 'text-to-image'
  prompt: string
  model: 'gpt-image-1' | 'flux-dev-ultra-fast' | 'flux-kontext-pro' | 'flux-kontext-max'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  size?: '1024x1024' | '1792x1024' | '1024x1536'
}

export class ImageGenerationHandler {
  // Image generation keywords and patterns
  private static readonly IMAGE_KEYWORDS = [
    'generate image', 'create image', 'make image', 'draw', 'paint', 'illustrate',
    'generate a picture', 'create a picture', 'make a picture',
    'generate an image', 'create an image', 'make an image',
    'visualize', 'render', 'design', 'sketch',
    'photo of', 'picture of', 'illustration of', 'artwork of',
    'create art', 'generate art', 'make art',
    'flux', 'dall-e', 'gpt-image', 'wavespeed'
  ]

  private static readonly IMAGE_PATTERNS = [
    /(?:generate|create|make|draw|paint|illustrate|render|design|sketch)\s+(?:a|an|the)?\s*(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)/i,
    /(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)\s+of\s+/i,
    /(?:can you|could you|please|I want|I need|I'd like)\s+.*(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)/i,
    /(?:show me|give me|create for me|make for me)\s+.*(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)/i,
    /^(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch):\s*/i,
    /using\s+(?:flux|dall-e|gpt-image|wavespeed|replicate)/i
  ]

  /**
   * Detect if a message is requesting image generation
   */
  static detectImageRequest(message: string, userSelectedModel?: string): ImageGenerationRequest | null {
    const lowerMessage = message.toLowerCase()

    // Check for explicit keywords
    const hasKeyword = this.IMAGE_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    )

    // Check for patterns
    const hasPattern = this.IMAGE_PATTERNS.some(pattern => 
      pattern.test(message)
    )

    if (!hasKeyword && !hasPattern) {
      return null
    }

    // Extract the actual image prompt
    let prompt = message

    // Remove common prefixes
    const prefixPatterns = [
      /^(?:please\s+)?(?:can you|could you|I want|I need|I'd like|I would like)\s+(?:to\s+)?(?:generate|create|make|draw|paint|illustrate|render|design|sketch)\s+(?:a|an|the)?\s*(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)\s+(?:of|showing|depicting|that shows)?\s*/i,
      /^(?:generate|create|make|draw|paint|illustrate|render|design|sketch)\s+(?:a|an|the)?\s*(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch)\s+(?:of|showing|depicting|that shows)?\s*/i,
      /^(?:image|picture|photo|illustration|artwork|art|visual|graphic|drawing|painting|sketch):\s*/i,
      /^(?:show me|give me|create for me|make for me)\s+(?:a|an|the)?\s*/i
    ]

    for (const pattern of prefixPatterns) {
      prompt = prompt.replace(pattern, '')
    }

    // Remove trailing punctuation
    prompt = prompt.replace(/[.!?]+$/, '').trim()

    // If prompt is empty after cleaning, use a more aggressive extraction
    if (!prompt || prompt.length < 5) {
      // Try to extract content after "of", "showing", "depicting", etc.
      const contentMatch = message.match(/(?:of|showing|depicting|that shows|with|featuring)\s+(.+)/i)
      if (contentMatch) {
        prompt = contentMatch[1].trim()
      } else {
        // Use the original message if we can't extract a good prompt
        prompt = message
      }
    }

    // Detect model preference
    let model: ImageGenerationRequest['model'] = 'gpt-image-1' // Default fallback
    let quality: ImageGenerationRequest['quality'] = 'hd'

    // First, check if user explicitly mentions a model in their message (highest priority)
    if (lowerMessage.includes('flux') || lowerMessage.includes('wavespeed') || lowerMessage.includes('fast')) {
      model = 'flux-dev-ultra-fast'
      quality = 'standard'
    } else if (lowerMessage.includes('kontext pro')) {
      model = 'flux-kontext-pro'
      quality = 'hd'
    } else if (lowerMessage.includes('kontext max')) {
      model = 'flux-kontext-max'
      quality = 'hd'
    } else if (lowerMessage.includes('standard quality') || lowerMessage.includes('quick')) {
      model = 'flux-dev-ultra-fast'
      quality = 'standard'
    } else if (userSelectedModel) {
      // If no explicit model mentioned, use the user's selected model from settings
      model = userSelectedModel as ImageGenerationRequest['model']
      // Set quality based on model
      if (model === 'flux-dev-ultra-fast') {
        quality = 'standard'
      } else {
        quality = 'hd'
      }
    }

    // Detect style preference
    let style: ImageGenerationRequest['style'] = 'vivid'
    if (lowerMessage.includes('natural') || lowerMessage.includes('realistic') || lowerMessage.includes('photorealistic')) {
      style = 'natural'
    }

    // Detect size preference
    let size: ImageGenerationRequest['size'] = '1024x1024'
    if (lowerMessage.includes('landscape') || lowerMessage.includes('wide') || lowerMessage.includes('horizontal')) {
      size = '1792x1024'
    } else if (lowerMessage.includes('portrait') || lowerMessage.includes('tall') || lowerMessage.includes('vertical')) {
      size = '1024x1536'
    }

    return {
      type: 'text-to-image',
      prompt,
      model,
      quality,
      style,
      size
    }
  }

  /**
   * Generate a response for image generation
   */
  static generateResponse(request: ImageGenerationRequest): string {
    const modelName = request.model === 'gpt-image-1' ? 'GPT-Image-1' : 
                     request.model === 'flux-kontext-pro' ? 'Flux Kontext Pro' :
                     request.model === 'flux-kontext-max' ? 'Flux Kontext Max' :
                     'WaveSpeed AI'
    
    // Use the correct response template based on the model
    if (request.model === 'gpt-image-1') {
      return `I've created your image with **GPT-Image-1** ✨

*"${request.prompt}"*

Your HD image is now ready in the **Images** tab.`
    } else if (request.model === 'flux-kontext-pro') {
      return `I've generated your image with **Flux Kontext Pro** 🎨

*"${request.prompt}"*

Your professional-quality image is now ready in the **Images** tab.`
    } else if (request.model === 'flux-kontext-max') {
      return `I've created your image with **Flux Kontext Max** 🚀

*"${request.prompt}"*

Your maximum-quality image is now ready in the **Images** tab.`
    } else {
      return `I've generated your image with **WaveSpeed AI** ⚡

*"${request.prompt}"*

Your image is now ready in the **Images** tab.`
    }
  }
}