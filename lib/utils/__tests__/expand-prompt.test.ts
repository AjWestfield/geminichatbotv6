// /lib/utils/__tests__/expand-prompt.test.ts
import { describe, it, expect } from 'vitest'

interface ExpandedPrompts {
  image_prompt: string
  kling_prompt: string
  voice_script: string
  sfx_brief: string
}

// Sanitizer function to validate expanded prompts
export function sanitizeExpandedPrompts(input: any): ExpandedPrompts {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input: must be an object')
  }

  const requiredFields = ['image_prompt', 'kling_prompt', 'voice_script', 'sfx_brief']
  for (const field of requiredFields) {
    if (!input[field] || typeof input[field] !== 'string') {
      throw new Error(`Missing or invalid field: ${field}`)
    }
  }

  // Validate voice script format
  const voicePattern = /\[voice:\w+\]/
  if (!voicePattern.test(input.voice_script)) {
    throw new Error('voice_script must contain a voice tag like [voice:emma]')
  }

  // Ensure prompts are not too short
  if (input.image_prompt.length < 10) {
    throw new Error('image_prompt is too short')
  }
  if (input.kling_prompt.length < 10) {
    throw new Error('kling_prompt is too short')
  }
  if (input.sfx_brief.length < 5) {
    throw new Error('sfx_brief is too short')
  }

  return {
    image_prompt: input.image_prompt.trim(),
    kling_prompt: input.kling_prompt.trim(),
    voice_script: input.voice_script.trim(),
    sfx_brief: input.sfx_brief.trim()
  }
}

describe('Expand Prompt Sanitizer', () => {
  it('should validate a correct expanded prompt object', () => {
    const validInput = {
      image_prompt: 'A beautiful sunset over mountains',
      kling_prompt: 'Camera slowly pans across mountain landscape at sunset',
      voice_script: '[voice:emma]Welcome to our journey[/voice]',
      sfx_brief: 'Gentle wind, birds chirping'
    }

    const result = sanitizeExpandedPrompts(validInput)
    expect(result).toEqual(validInput)
  })

  it('should throw error for missing fields', () => {
    const invalidInput = {
      image_prompt: 'A beautiful sunset',
      kling_prompt: 'Camera pans',
      // missing voice_script and sfx_brief
    }

    expect(() => sanitizeExpandedPrompts(invalidInput)).toThrow('Missing or invalid field: voice_script')
  })

  it('should throw error for invalid voice script format', () => {
    const invalidInput = {
      image_prompt: 'A beautiful sunset over mountains',
      kling_prompt: 'Camera slowly pans across mountain landscape',
      voice_script: 'Welcome to our journey', // missing voice tag
      sfx_brief: 'Gentle wind'
    }

    expect(() => sanitizeExpandedPrompts(invalidInput)).toThrow('voice_script must contain a voice tag')
  })

  it('should throw error for too short prompts', () => {
    const invalidInput = {
      image_prompt: 'Sunset', // too short
      kling_prompt: 'Camera slowly pans across mountain landscape',
      voice_script: '[voice:emma]Welcome[/voice]',
      sfx_brief: 'Wind'
    }

    expect(() => sanitizeExpandedPrompts(invalidInput)).toThrow('image_prompt is too short')
  })

  it('should trim whitespace from all fields', () => {
    const input = {
      image_prompt: '  A beautiful sunset over mountains  ',
      kling_prompt: '  Camera slowly pans across mountain landscape  ',
      voice_script: '  [voice:emma]Welcome to our journey[/voice]  ',
      sfx_brief: '  Gentle wind, birds chirping  '
    }

    const result = sanitizeExpandedPrompts(input)
    expect(result.image_prompt).toBe('A beautiful sunset over mountains')
    expect(result.kling_prompt).toBe('Camera slowly pans across mountain landscape')
    expect(result.voice_script).toBe('[voice:emma]Welcome to our journey[/voice]')
    expect(result.sfx_brief).toBe('Gentle wind, birds chirping')
  })

  it('should handle multiple voice tags', () => {
    const input = {
      image_prompt: 'Two people having a conversation',
      kling_prompt: 'Camera switches between two speakers',
      voice_script: '[voice:emma]Hello there![/voice] [voice:john]Hi, how are you?[/voice]',
      sfx_brief: 'Indoor ambience'
    }

    const result = sanitizeExpandedPrompts(input)
    expect(result.voice_script).toContain('[voice:emma]')
    expect(result.voice_script).toContain('[voice:john]')
  })

  it('should throw error for non-object input', () => {
    expect(() => sanitizeExpandedPrompts(null)).toThrow('Invalid input: must be an object')
    expect(() => sanitizeExpandedPrompts('string')).toThrow('Invalid input: must be an object')
    expect(() => sanitizeExpandedPrompts(123)).toThrow('Invalid input: must be an object')
  })

  it('should throw error for non-string field values', () => {
    const invalidInput = {
      image_prompt: 'A beautiful sunset',
      kling_prompt: 123, // number instead of string
      voice_script: '[voice:emma]Hello[/voice]',
      sfx_brief: 'Wind'
    }

    expect(() => sanitizeExpandedPrompts(invalidInput)).toThrow('Missing or invalid field: kling_prompt')
  })
})