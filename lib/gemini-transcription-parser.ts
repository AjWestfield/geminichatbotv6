// Utility functions to parse transcription from Gemini's response

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface ParsedTranscription {
  text: string
  segments: TranscriptionSegment[]
  language?: string
  duration?: number
}

/**
 * Parses timestamp strings like "[00:15]" or "(00:15 - 00:20)" to seconds
 */
function parseTimestamp(timestamp: string): number {
  // Match patterns like [00:15] or (00:15)
  const match = timestamp.match(/[\[\(]?(\d{1,2}):(\d{2})(?:\s*-\s*\d{1,2}:\d{2})?[\]\)]?/)
  if (!match) return 0
  
  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  return minutes * 60 + seconds
}

/**
 * Extracts transcription from Gemini's video/audio analysis response
 */
export function parseGeminiTranscription(response: string): ParsedTranscription | null {
  console.log('[Transcription Parser] Starting to parse response')
  
  // Look for transcription section with timestamps
  const transcriptionPatterns = [
    /### (?:Word-for-Word )?Transcription.*?\n([\s\S]*?)(?=###|---|\n\n##|$)/i,
    /### Audio Transcription.*?\n([\s\S]*?)(?=###|---|\n\n##|$)/i,
    /Transcription:?\s*\n([\s\S]*?)(?=###|---|\n\n##|$)/i,
    /(?:Speaker [A-Z]:|Narrator.*?:)\s*\n([\s\S]*?)(?=###|---|\n\n##|$)/i,
    /\*\*Audio Transcription.*?\*\*\s*\n([\s\S]*?)(?=###|---|\n\n##|$)/i,
    /\*\*Complete Transcription.*?\*\*\s*\n([\s\S]*?)(?=###|---|\n\n##|$)/i
  ]
  
  let transcriptionSection = ''
  for (const pattern of transcriptionPatterns) {
    const match = response.match(pattern)
    if (match) {
      transcriptionSection = match[1].trim()
      console.log('[Transcription Parser] Found transcription section with pattern:', pattern)
      break
    }
  }
  
  if (!transcriptionSection) {
    console.log('[Transcription Parser] No transcription section found')
    return null
  }
  
  const segments: TranscriptionSegment[] = []
  let fullText = ''
  
  // Parse lines with timestamps
  const lines = transcriptionSection.split('\n')
  let currentSpeaker = 'Narrator'
  
  console.log('[Transcription Parser] Processing', lines.length, 'lines')
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('---')) continue
    
    // Check for speaker designation
    const speakerMatch = trimmedLine.match(/^(Speaker [A-Z]|Narrator(?:\s*\([^)]+\))?|[A-Z]\w+):\s*$/i)
    if (speakerMatch) {
      currentSpeaker = speakerMatch[1]
      console.log('[Transcription Parser] Found speaker:', currentSpeaker)
      continue
    }
    
    // Parse timestamped content
    // Matches patterns like:
    // * (00:00 - 00:06) "Text here"
    // * [00:15] Speaker A: "Text"
    // * 00:15: "Text"
    // * • (00:00 - 00:06) "Text"  
    const timestampMatch = trimmedLine.match(/[\*•\s]*[\[\(]?(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?[\]\)]?\s*(?:(Speaker [A-Z]|[A-Z]\w+):\s*)?["']?(.+?)["']?\s*$/i)
    
    if (timestampMatch) {
      const startTime = parseTimestamp(timestampMatch[1])
      const endTime = timestampMatch[2] ? parseTimestamp(timestampMatch[2]) : startTime + 5 // Default 5 second segments
      const speaker = timestampMatch[3] || currentSpeaker
      const text = timestampMatch[4].replace(/^["']\s*|\s*["']$/g, '') // Remove quotes
      
      console.log('[Transcription Parser] Found segment:', { startTime, endTime, speaker, text: text.substring(0, 50) + '...' })
      
      segments.push({
        start: startTime,
        end: endTime,
        text,
        speaker
      })
      
      fullText += (fullText ? ' ' : '') + text
    } else if (trimmedLine && !trimmedLine.match(/^(###|--|==)/)) {
      // Add lines without timestamps to full text
      const cleanText = trimmedLine.replace(/^["']\s*|\s*["']$/g, '')
      if (cleanText) {
        fullText += (fullText ? ' ' : '') + cleanText
      }
    }
  }
  
  // Extract language if mentioned
  const languageMatch = response.match(/\[Language:\s*([^\]]+)\]/i)
  const language = languageMatch ? languageMatch[1] : undefined
  
  // Calculate duration from last segment or extract from response
  const durationMatch = response.match(/Duration:\s*(\d+):(\d+)/i)
  let duration: number | undefined
  if (durationMatch) {
    duration = parseInt(durationMatch[1], 10) * 60 + parseInt(durationMatch[2], 10)
  } else if (segments.length > 0) {
    duration = segments[segments.length - 1].end
  }
  
  const result = {
    text: fullText || transcriptionSection,
    segments,
    language,
    duration
  }
  
  console.log('[Transcription Parser] Parsing complete:', {
    textLength: result.text.length,
    segmentCount: result.segments.length,
    language: result.language,
    duration: result.duration
  })
  
  return result
}

/**
 * Checks if a message contains video/audio analysis with transcription
 */
export function hasTranscription(message: string): boolean {
  const patterns = [
    /### (?:Word-for-Word )?Transcription/i,
    /### Audio Transcription/i,
    /Transcription:?\s*\n/i,
    /\[\d{1,2}:\d{2}\]/,
    /\(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\)/
  ]
  
  return patterns.some(pattern => pattern.test(message))
}

/**
 * Removes the transcription section from Gemini's response
 * Returns the response without the transcription part
 */
export function removeTranscriptionFromResponse(response: string): string {
  // Patterns to match transcription sections
  const transcriptionPatterns = [
    // Match from ### Word-for-Word Transcription to the next ### or end
    /### (?:Word-for-Word )?Transcription.*?(?=###|$)/is,
    // Match from ### Audio Transcription to the next ### or end
    /### Audio Transcription.*?(?=###|$)/is,
    // Match sections with timestamps
    /(?:Narrator(?:\s*\([^)]+\))?:|Speaker\s+[A-Z]:)\s*\n(?:[\s\S]*?\(\d{1,2}:\d{2}[^)]*\)[^\n]*\n?)+/g,
    // Match the entire transcription block with timestamps
    /\n{2,}(?:Narrator(?:\s*\([^)]+\))?:|Speaker\s+[A-Z]:)[\s\S]*?(?:\*\s*\(\d{1,2}:\d{2}[^)]*\)[^\n]*\n?)+[\s\S]*?(?=\n{2,}###|$)/g
  ]
  
  let cleanedResponse = response
  
  // Remove each pattern
  transcriptionPatterns.forEach(pattern => {
    cleanedResponse = cleanedResponse.replace(pattern, '')
  })
  
  // Clean up extra newlines
  cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n')
  
  // Trim any leading/trailing whitespace
  cleanedResponse = cleanedResponse.trim()
  
  console.log('[Transcription Parser] Removed transcription from response')
  return cleanedResponse
}