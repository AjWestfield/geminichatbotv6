/**
 * WaveSpeed TTS Handler
 * Handles text-to-speech generation using WaveSpeed Dia TTS API
 */

export interface TTSContent {
  text: string
  voiceName?: string
  style?: string
  multiSpeaker: boolean
  generateScript: boolean
}

export interface TTSGenerationResult {
  success: boolean
  audioBase64?: string
  mimeType?: string
  script?: string
  metadata?: {
    speakers?: number
    duration?: number
    voiceId?: string
    provider?: string
  }
  error?: string
}

/**
 * Detects if content contains TTS commands
 */
export function containsTTSCommand(content: string): boolean {
  const ttsPatterns = [
    /\b(read|speak|say|narrate|voice)\s+(this|out loud|the following)?\s*:/i,
    /\b(tts|text.?to.?speech)\b/i,
    /\b(generate|create)\s+(speech|audio|voice)\b/i,
    /\bread\s+this\s+aloud\b/i,
    /\bvoice\s+over\b/i,
    /\bnarrate\s+(this|the following)\b/i
  ]

  return ttsPatterns.some(pattern => pattern.test(content))
}

/**
 * Detects if content contains multi-speaker TTS commands
 */
export function containsMultiSpeakerTTSCommand(content: string): boolean {
  const multiSpeakerPatterns = [
    /\b(multi.?speaker|dialogue|conversation|multiple.?voice)\b/i,
    /\b(create|generate)\s+(a\s+)?(dialogue|conversation)\b/i,
    /\b(two|multiple)\s+(people|speakers|voices)\b/i,
    /\bdialogue\s+between\b/i,
    /\bconversation\s+(about|between)\b/i
  ]

  return multiSpeakerPatterns.some(pattern => pattern.test(content))
}

/**
 * Detects if content is a pure multi-speaker script with speaker tags
 */
export function isPureMultiSpeakerScript(content: string): boolean {
  // Check for speaker tags like [S1], [S2], etc.
  const speakerTagPattern = /\[S\d+\]/g
  const speakerTags = content.match(speakerTagPattern)

  if (!speakerTags || speakerTags.length < 2) {
    return false
  }

  // Check if the content is primarily a script (more than 50% is dialogue)
  const lines = content.split('\n').filter(line => line.trim())
  const scriptLines = lines.filter(line => /\[S\d+\]/.test(line))

  return scriptLines.length >= Math.ceil(lines.length * 0.5)
}

/**
 * Extracts TTS content from a message
 */
export function extractTTSContent(content: string): TTSContent {
  // Check if it's a multi-speaker script
  const isMultiSpeaker = isPureMultiSpeakerScript(content) || containsMultiSpeakerTTSCommand(content)

  // Extract text after TTS commands
  let text = content

  // Remove common TTS command prefixes
  text = text.replace(/^(read this aloud|tts|text to speech|say this|narrate this):\s*/i, '')
  text = text.replace(/^(generate|create)\s+(speech|audio|voice)\s+(for|from):\s*/i, '')

  // For multi-speaker requests without script, generate a simple dialogue
  if (isMultiSpeaker && !isPureMultiSpeakerScript(content)) {
    return {
      text: content,
      multiSpeaker: true,
      generateScript: true,
      voiceName: 'Multi-Speaker',
      style: 'natural'
    }
  }

  return {
    text: text.trim(),
    multiSpeaker: isMultiSpeaker,
    generateScript: false,
    voiceName: isMultiSpeaker ? 'Multi-Speaker' : 'Default',
    style: 'natural'
  }
}

/**
 * Parses multi-speaker text and extracts speaker dialogues
 */
export function parseMultiSpeakerText(text: string): Array<{speaker: string, text: string, emotion?: string}> {
  const lines = text.split('\n').filter(line => line.trim())
  const dialogues: Array<{speaker: string, text: string, emotion?: string}> = []

  for (const line of lines) {
    const match = line.match(/\[S(\d+)\]\s*(.+)/)
    if (match) {
      const speakerNum = match[1]
      let speakerText = match[2].trim()
      let emotion: string | undefined

      // Extract emotion tags like (excited), (laughs), etc.
      const emotionMatch = speakerText.match(/\(([^)]+)\)/)
      if (emotionMatch) {
        emotion = emotionMatch[1]
        speakerText = speakerText.replace(/\([^)]+\)/g, '').trim()
      }

      dialogues.push({
        speaker: `S${speakerNum}`,
        text: speakerText,
        emotion
      })
    }
  }

  return dialogues
}

/**
 * Converts text to WaveSpeed format for API call
 */
export function convertToWaveSpeedFormat(text: string, isMultiSpeaker: boolean = false): string {
  if (!isMultiSpeaker) {
    return text
  }

  // If it's already in the correct format, return as-is
  if (isPureMultiSpeakerScript(text)) {
    return text
  }

  // For multi-speaker requests without proper format, create a simple dialogue
  return `[S1] ${text} [S2] That's interesting! Tell me more about that.`
}

/**
 * Generates a simple multi-speaker script from a topic
 */
export function generateMultiSpeakerScript(topic: string, speakerCount: number = 2): string {
  const scripts = [
    `[S1] Let's talk about ${topic}. What do you think about it? [S2] That's a fascinating topic! I find it really interesting how it impacts our daily lives.`,
    `[S1] I've been thinking about ${topic} lately. [S2] Oh really? What aspects of it interest you the most? [S1] Well, there are so many different perspectives to consider.`,
    `[S1] Have you heard about ${topic}? [S2] Yes, I have! It's quite remarkable how it's evolving. [S1] Absolutely, the implications are far-reaching.`
  ]

  return scripts[Math.floor(Math.random() * scripts.length)]
}

/**
 * Calls WaveSpeed Dia TTS API
 */
export async function generateWaveSpeedTTS(text: string, options: {
  multiSpeaker?: boolean
  voiceName?: string
  style?: string
} = {}): Promise<TTSGenerationResult> {
  try {
    const apiKey = process.env.WAVESPEED_API_KEY
    if (!apiKey) {
      throw new Error('WAVESPEED_API_KEY not configured')
    }

    // For testing purposes, return a mock response if in development mode
    if (process.env.NODE_ENV === 'development' && process.env.TTS_MOCK_MODE === 'true') {
      console.log('[WaveSpeed TTS] Using mock mode for development')
      return generateMockTTSResponse(text, options)
    }

    const formattedText = convertToWaveSpeedFormat(text, options.multiSpeaker)

    console.log('[WaveSpeed TTS] Generating audio:', {
      text: formattedText.substring(0, 100) + '...',
      multiSpeaker: options.multiSpeaker,
      textLength: formattedText.length
    })

    const response = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/dia-tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: formattedText
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`WaveSpeed API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    console.log('[WaveSpeed TTS] API Response:', {
      hasError: !!result.error,
      keys: Object.keys(result),
      resultPreview: JSON.stringify(result).substring(0, 200) + '...'
    })

    if (result.error) {
      throw new Error(`WaveSpeed API error: ${result.error}`)
    }

    // WaveSpeed returns audio as base64 or URL - check various possible field names
    const audioBase64 = result.audio_base64 || result.audio || result.output || result.data || result.result

    if (!audioBase64) {
      console.error('[WaveSpeed TTS] No audio data found in response:', result)
      throw new Error(`No audio data received from WaveSpeed API. Response keys: ${Object.keys(result).join(', ')}`)
    }

    const speakerCount = options.multiSpeaker ? parseMultiSpeakerText(formattedText).length : 1

    return {
      success: true,
      audioBase64,
      mimeType: 'audio/wav',
      script: formattedText,
      metadata: {
        speakers: speakerCount,
        duration: Math.ceil(formattedText.length / 10), // Rough estimate
        voiceId: options.multiSpeaker ? 'dia-multi' : 'dia-single',
        provider: 'wavespeed'
      }
    }
  } catch (error) {
    console.error('[WaveSpeed TTS] Generation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
