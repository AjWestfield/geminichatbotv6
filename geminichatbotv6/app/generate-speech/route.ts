import { NextRequest, NextResponse } from 'next/server'
import { 
  extractTTSContent, 
  generateWaveSpeedTTS, 
  containsTTSCommand,
  containsMultiSpeakerTTSCommand,
  generateMultiSpeakerScript
} from '@/lib/wavespeed-tts-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice, style, multiSpeaker } = body

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required for speech generation' },
        { status: 400 }
      )
    }

    console.log('[TTS API] Processing request:', {
      textLength: text.length,
      voice,
      style,
      multiSpeaker,
      preview: text.substring(0, 100) + '...'
    })

    // Extract TTS content and determine if it's multi-speaker
    const ttsContent = extractTTSContent(text)
    const isMultiSpeaker = multiSpeaker || ttsContent.multiSpeaker

    console.log('[TTS API] TTS Content Analysis:', {
      multiSpeaker: isMultiSpeaker,
      generateScript: ttsContent.generateScript,
      voiceName: ttsContent.voiceName
    })

    // If it's a multi-speaker request but needs script generation
    let processedText = ttsContent.text
    if (isMultiSpeaker && ttsContent.generateScript) {
      processedText = generateMultiSpeakerScript(ttsContent.text)
      console.log('[TTS API] Generated script:', processedText)
    }

    // Generate audio using WaveSpeed
    const result = await generateWaveSpeedTTS(processedText, {
      multiSpeaker: isMultiSpeaker,
      voiceName: voice || ttsContent.voiceName,
      style: style || ttsContent.style
    })

    if (!result.success) {
      console.error('[TTS API] Generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Speech generation failed' },
        { status: 500 }
      )
    }

    console.log('[TTS API] Generation successful:', {
      speakers: result.metadata?.speakers,
      duration: result.metadata?.duration,
      provider: result.metadata?.provider
    })

    // Return the generated audio and metadata
    return NextResponse.json({
      success: true,
      audio: result.audioBase64,
      mimeType: result.mimeType,
      script: result.script,
      metadata: {
        ...result.metadata,
        originalText: text,
        processedText,
        isMultiSpeaker,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[TTS API] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error during speech generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text')

  if (!text) {
    return NextResponse.json(
      { error: 'Text parameter is required' },
      { status: 400 }
    )
  }

  // Analyze the text for TTS capabilities
  const hasTTS = containsTTSCommand(text)
  const hasMultiSpeaker = containsMultiSpeakerTTSCommand(text)
  const ttsContent = extractTTSContent(text)

  return NextResponse.json({
    hasTTS,
    hasMultiSpeaker,
    analysis: {
      multiSpeaker: ttsContent.multiSpeaker,
      generateScript: ttsContent.generateScript,
      voiceName: ttsContent.voiceName,
      extractedText: ttsContent.text.substring(0, 200) + (ttsContent.text.length > 200 ? '...' : '')
    }
  })
}
