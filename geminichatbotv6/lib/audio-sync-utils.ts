// Audio synchronization utilities for word-level highlighting

export interface WordTimestamp {
  word: string
  startTime: number
  endTime: number
  index: number
}

export interface AudioSyncData {
  transcript: string
  words: WordTimestamp[]
  duration: number
}

// Estimate word timestamps based on audio duration and text
export function generateWordTimestamps(text: string, audioDuration: number): AudioSyncData {
  // Clean and prepare text
  const cleanText = text
    .replace(/\[.*?\]/g, '') // Remove audio tags
    .replace(/\s+/g, ' ')
    .trim()
  
  // Split into words, preserving punctuation
  const words = cleanText.match(/\S+/g) || []
  
  // ElevenLabs v3 tends to speak at ~140-160 wpm for natural speech
  // This is about 2.33-2.67 words per second
  const estimatedWPM = 150
  const baseWordsPerSecond = estimatedWPM / 60
  
  // Calculate actual rate based on duration
  const actualRate = words.length / audioDuration
  
  // Use a weighted average favoring the actual rate but bounded by realistic limits
  const minRate = 1.8 // Minimum 108 wpm (very slow)
  const maxRate = 3.5 // Maximum 210 wpm (very fast)
  const rate = Math.max(minRate, Math.min(maxRate, actualRate))
  
  // Generate timestamps with more sophisticated timing
  const wordTimestamps: WordTimestamp[] = []
  let currentTime = 0
  
  // Add initial pause (ElevenLabs often has a small lead-in)
  currentTime += 0.1
  
  words.forEach((word, index) => {
    const cleanWord = word.replace(/[.,!?;:'"]/g, '')
    const syllableCount = estimateSyllables(cleanWord)
    
    // Base duration on syllables rather than just word length
    const baseWordDuration = syllableCount * 0.22 // ~220ms per syllable
    
    // Adjust for word type and position
    let wordDuration = baseWordDuration
    
    // Common short words are spoken faster
    const quickWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'is', 'it', 'be', 'are', 'was', 'were', 'been']
    if (quickWords.includes(cleanWord.toLowerCase())) {
      wordDuration *= 0.7
    }
    
    // Longer, complex words need more time
    if (syllableCount > 3) {
      wordDuration *= 1.1
    }
    
    // First word of sentence gets slight emphasis
    if (index === 0 || (index > 0 && /[.!?]/.test(words[index - 1]))) {
      wordDuration *= 1.05
    }
    
    // Numbers and acronyms are spoken more slowly
    if (/^\d+$/.test(cleanWord) || /^[A-Z]{2,}$/.test(cleanWord)) {
      wordDuration *= 1.3
    }
    
    // Calculate pauses based on punctuation
    let pauseAfter = 0
    
    // More nuanced pause durations
    if (word.endsWith('.') || word.endsWith('!') || word.endsWith('?')) {
      // End of sentence - longer pause
      pauseAfter = 0.4 + (Math.random() * 0.1) // 400-500ms
      
      // Questions often have slightly longer pauses
      if (word.endsWith('?')) {
        pauseAfter += 0.1
      }
    } else if (word.endsWith(',')) {
      // Comma - medium pause
      pauseAfter = 0.2 + (Math.random() * 0.05) // 200-250ms
    } else if (word.endsWith(';') || word.endsWith(':')) {
      // Semicolon/colon - medium-long pause
      pauseAfter = 0.3
    } else if (word.includes('...') || word.endsWith('…')) {
      // Ellipsis - dramatic pause
      pauseAfter = 0.6
    } else if (word.endsWith(')') || word.endsWith('"') || word.endsWith("'")) {
      // Closing quotes/parens often have small pauses
      pauseAfter = 0.1
    }
    
    // Natural micro-pauses between words (breathing rhythm)
    if (pauseAfter === 0 && index < words.length - 1) {
      // Add tiny random variations to make it more natural
      pauseAfter = 0.02 + (Math.random() * 0.03) // 20-50ms
    }
    
    const startTime = currentTime
    const endTime = currentTime + wordDuration
    
    wordTimestamps.push({
      word,
      startTime: Math.max(0, startTime),
      endTime: Math.min(audioDuration, endTime),
      index
    })
    
    currentTime = endTime + pauseAfter
  })
  
  // Fine-tune the timing to match the actual audio duration
  if (wordTimestamps.length > 0) {
    const lastWord = wordTimestamps[wordTimestamps.length - 1]
    const estimatedDuration = lastWord.endTime
    
    if (Math.abs(estimatedDuration - audioDuration) > 0.5) {
      // If we're off by more than 500ms, scale everything
      const scaleFactor = (audioDuration - 0.2) / estimatedDuration // Leave 200ms at the end
      
      wordTimestamps.forEach(wt => {
        wt.startTime *= scaleFactor
        wt.endTime *= scaleFactor
      })
    }
  }
  
  return {
    transcript: cleanText,
    words: wordTimestamps,
    duration: audioDuration
  }
}

// Estimate syllable count for better timing accuracy
function estimateSyllables(word: string): number {
  word = word.toLowerCase()
  let count = 0
  let previousWasVowel = false
  
  // Special cases
  if (word.length <= 2) return 1
  if (word.endsWith('le') && word.length > 2) count++
  if (word.endsWith('es') || word.endsWith('ed')) count--
  
  // Count vowel groups
  for (let i = 0; i < word.length; i++) {
    const isVowel = 'aeiouy'.includes(word[i])
    if (isVowel && !previousWasVowel) {
      count++
    }
    previousWasVowel = isVowel
  }
  
  // Adjust for silent e
  if (word.endsWith('e') && count > 1) {
    count--
  }
  
  // Minimum of 1 syllable
  return Math.max(1, count)
}

// Find current word based on audio time
export function getCurrentWordIndex(timestamps: WordTimestamp[], currentTime: number): number {
  // Binary search for efficiency
  let left = 0
  let right = timestamps.length - 1
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const word = timestamps[mid]
    
    if (currentTime >= word.startTime && currentTime < word.endTime) {
      return mid
    } else if (currentTime < word.startTime) {
      right = mid - 1
    } else {
      left = mid + 1
    }
  }
  
  // If not found, return the last word that started before current time
  for (let i = timestamps.length - 1; i >= 0; i--) {
    if (timestamps[i].startTime <= currentTime) {
      return i
    }
  }
  
  return -1
}

// Format timestamp for display
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// Generate timestamp markers for display
export function generateTimestampMarkers(timestamps: WordTimestamp[], interval: number = 5): Array<{time: number, text: string}> {
  const markers: Array<{time: number, text: string}> = []
  
  if (timestamps.length === 0) return markers
  
  // Add start marker
  markers.push({
    time: 0,
    text: timestamps[0].word
  })
  
  // Add markers at intervals
  for (let time = interval; time < timestamps[timestamps.length - 1].endTime; time += interval) {
    const index = getCurrentWordIndex(timestamps, time)
    if (index >= 0) {
      // Get surrounding words for context
      const start = Math.max(0, index - 2)
      const end = Math.min(timestamps.length - 1, index + 2)
      const text = timestamps.slice(start, end + 1).map(w => w.word).join(' ')
      
      markers.push({
        time,
        text
      })
    }
  }
  
  return markers
}