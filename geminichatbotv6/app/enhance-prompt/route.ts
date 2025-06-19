import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

interface EnhancePromptRequest {
  prompt: string
  model?: string
  context?: string
  regenerate?: boolean
}

// Context-specific enhancement prompts
const getEnhancementPrompt = (context?: string) => {
  const basePrompt = `You are an expert prompt engineer. Your task is to enhance user prompts to make them more effective and likely to produce better AI responses.

When enhancing a prompt, follow these principles:

1. **Clarity and Specificity**: Make vague requests more specific and clear
2. **Context Setting**: Add relevant context that helps the AI understand the task better
3. **Structure**: Organize the request in a logical, easy-to-follow format
4. **Examples**: Include examples when they would be helpful
5. **Output Format**: Specify the desired output format when relevant
6. **Constraints**: Add helpful constraints or guidelines
7. **Role Definition**: Define the AI's role when appropriate

IMPORTANT: Never add technical parameters like aspect ratios, dimensions, or size specifications to prompts. The user has separate controls for these settings.`

  const contextSpecific = {
    "image-edit": `
Additionally for image editing prompts:
- Focus on visual elements, colors, lighting, and composition
- Be specific about what to add, remove, or modify
- Include style references when relevant (e.g., "photorealistic", "oil painting style")
- Specify areas of the image (e.g., "foreground", "top-left corner")
- Include quality descriptors (e.g., "high detail", "sharp focus")
- Do NOT include aspect ratio or size specifications (user controls these separately)`,

    "video": `
Additionally for video/animation prompts:
- Focus on motion, timing, and transitions
- Describe camera movements (e.g., "slow zoom", "pan left")
- Include movement descriptors (e.g., "smooth", "dramatic", "subtle")
- Mention any effects or transitions
- Do NOT include aspect ratio, duration, or size specifications (user controls these separately)`,

    "audio": `
Additionally for audio/speech prompts:
- Focus on tone, emotion, and pacing
- Specify voice characteristics when relevant
- Include pauses and emphasis where needed
- Mention any sound effects or background elements
- Consider dialogue flow and natural speech patterns`,

    "multi-image": `
Additionally for multi-image editing prompts:
- Describe how images should be combined or transitioned
- Specify relationships between the images
- Include blending or composition instructions
- Mention consistency requirements across images
- Describe the overall narrative or theme
- Do NOT include aspect ratio or size specifications (user controls these separately)`
  }

  const guidelines = `

Guidelines:
- Preserve the user's original intent completely
- Don't change the core request, only enhance it
- Make the prompt more actionable and specific
- Use clear, concise language
- Remove ambiguity while maintaining natural flow
- Add structure with bullet points, numbered lists, or sections when helpful
- Include relevant context that would help produce better results
- NEVER add aspect ratio specifications (like "16:9", "9:16", "1:1", "landscape", "portrait", "square") as the user has separate aspect ratio settings
- Focus only on creative and descriptive elements, not technical parameters

Return ONLY the enhanced prompt without any explanations, prefixes, or meta-commentary.`

  return basePrompt + (contextSpecific[context as keyof typeof contextSpecific] || '') + guidelines
}

export async function POST(req: NextRequest) {
  console.log('[Enhance Prompt API] Request received')

  try {
    let requestBody: EnhancePromptRequest
    try {
      requestBody = await req.json()
    } catch (parseError) {
      console.error('[Enhance Prompt API] Invalid JSON in request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Unknown parsing error' },
        { status: 400 }
      )
    }

    const { prompt, model = 'gemini', context, regenerate = false } = requestBody

    console.log('[Enhance Prompt API] Request parameters:', {
      promptLength: prompt?.length || 0,
      model,
      context,
      regenerate,
      hasPrompt: !!prompt
    })

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log('[Enhance Prompt API] Invalid prompt provided')
      return NextResponse.json(
        {
          error: 'Valid prompt is required',
          details: !prompt ? 'No prompt provided' : typeof prompt !== 'string' ? 'Prompt must be a string' : 'Prompt cannot be empty'
        },
        { status: 400 }
      )
    }

    // Trim the prompt and check minimum length
    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length < 2) {
      console.log('[Enhance Prompt API] Prompt too short:', trimmedPrompt.length)
      return NextResponse.json(
        { error: 'Prompt is too short to enhance', details: `Prompt length: ${trimmedPrompt.length} characters (minimum: 2)` },
        { status: 400 }
      )
    }

    // Validate model
    const supportedModels = ['gemini', 'openai', 'anthropic', 'xai']
    const actualModel = supportedModels.includes(model) ? model : 'gemini'
    if (actualModel !== model) {
      console.log('[Enhance Prompt API] Unsupported model, falling back to Gemini:', model)
    }

    let enhancedPrompt: string
    const systemPrompt = getEnhancementPrompt(context)
    const userPrompt = regenerate
      ? `Original prompt to enhance with variation: "${trimmedPrompt}"\n\nGenerate a different enhancement than before.`
      : `Original prompt to enhance: "${trimmedPrompt}"`

    console.log('[Enhance Prompt API] Starting enhancement with model:', actualModel)

    try {
      switch (actualModel) {
        case 'openai':
          enhancedPrompt = await enhanceWithOpenAI(userPrompt, systemPrompt)
          break
        case 'anthropic':
          enhancedPrompt = await enhanceWithAnthropic(userPrompt, systemPrompt)
          break
        case 'xai':
          enhancedPrompt = await enhanceWithXAI(userPrompt, systemPrompt)
          break
        case 'gemini':
        default:
          enhancedPrompt = await enhanceWithGemini(userPrompt, systemPrompt)
          break
      }

      console.log('[Enhance Prompt API] Enhancement successful:', {
        model: actualModel,
        originalLength: trimmedPrompt.length,
        enhancedLength: enhancedPrompt.length
      })

      return NextResponse.json({
        success: true,
        originalPrompt: trimmedPrompt,
        enhancedPrompt,
        model: actualModel
      })
    } catch (modelError) {
      console.error(`[Enhance Prompt API] Error with ${actualModel}:`, modelError)

      // Fallback to Gemini if the selected model fails
      if (actualModel !== 'gemini') {
        console.log('[Enhance Prompt API] Attempting fallback to Gemini')
        try {
          enhancedPrompt = await enhanceWithGemini(userPrompt, systemPrompt)

          console.log('[Enhance Prompt API] Fallback to Gemini successful')
          return NextResponse.json({
            success: true,
            originalPrompt: trimmedPrompt,
            enhancedPrompt,
            model: 'gemini',
            fallback: true,
            fallbackReason: `${actualModel} failed: ${modelError instanceof Error ? modelError.message : 'Unknown error'}`
          })
        } catch (fallbackError) {
          console.error('[Enhance Prompt API] Fallback to Gemini also failed:', fallbackError)
        }
      }

      throw modelError
    }
  } catch (error) {
    console.error('[Enhance Prompt API] Unhandled error:', error)

    // Provide detailed error information
    let errorMessage = 'Failed to enhance prompt'
    let errorDetails = 'Unknown error'
    let statusCode = 500

    if (error instanceof Error) {
      errorDetails = error.message

      // Check for specific error types
      if (error.message.includes('API key')) {
        errorMessage = 'API key configuration error'
        statusCode = 401
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'Rate limit or quota exceeded'
        statusCode = 429
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout'
        statusCode = 408
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error'
        statusCode = 503
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        success: false
      },
      { status: statusCode }
    )
  }
}

async function enhanceWithGemini(userPrompt: string, systemPrompt: string): Promise<string> {
  console.log('[Enhance Prompt API] Using Gemini for enhancement')

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[Enhance Prompt API] Gemini API key not found in environment')
    throw new Error('Gemini API key not configured - check GEMINI_API_KEY environment variable')
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    console.log('[Enhance Prompt API] Sending request to Gemini API')
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ])

    const response = await result.response
    const enhancedPrompt = response.text().trim()

    console.log('[Enhance Prompt API] Gemini response received:', {
      responseLength: enhancedPrompt.length,
      hasContent: !!enhancedPrompt
    })

    if (!enhancedPrompt) {
      throw new Error('Empty response from Gemini API')
    }

    return enhancedPrompt
  } catch (error) {
    console.error('[Enhance Prompt API] Gemini API error:', error)
    if (error instanceof Error) {
      // Handle specific Gemini API errors
      if (error.message.includes('API_KEY_INVALID')) {
        throw new Error('Invalid Gemini API key - check your GEMINI_API_KEY configuration')
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        throw new Error('Gemini API quota exceeded - try again later')
      } else if (error.message.includes('SAFETY')) {
        throw new Error('Content was blocked by Gemini safety filters')
      } else {
        throw new Error(`Gemini API error: ${error.message}`)
      }
    }
    throw error
  }
}

async function enhanceWithOpenAI(userPrompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = new OpenAI({ apiKey })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000,
    temperature: 0.3
  })

  const enhancedPrompt = completion.choices[0]?.message?.content?.trim()

  if (!enhancedPrompt) {
    throw new Error('Empty response from OpenAI')
  }

  return enhancedPrompt
}

async function enhanceWithAnthropic(userPrompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Anthropic API key not configured')
  }

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  })

  const enhancedPrompt = message.content[0]?.type === 'text'
    ? message.content[0].text.trim()
    : ''

  if (!enhancedPrompt) {
    throw new Error('Empty response from Anthropic')
  }

  return enhancedPrompt
}

async function enhanceWithXAI(userPrompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    throw new Error('XAI API key not configured')
  }

  // XAI uses OpenAI-compatible API
  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  })

  const completion = await openai.chat.completions.create({
    model: 'grok-beta',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000,
    temperature: 0.3
  })

  const enhancedPrompt = completion.choices[0]?.message?.content?.trim()

  if (!enhancedPrompt) {
    throw new Error('Empty response from XAI')
  }

  return enhancedPrompt
}
