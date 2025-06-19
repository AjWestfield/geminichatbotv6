// /app/api/gemini/expand/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'edge'

interface ExpandedPrompts {
  image_prompt: string
  kling_prompt: string
  voice_script: string
  sfx_brief: string
}

const SYSTEM_PROMPT = `You are a creative AI director that expands user prompts into detailed specifications for video production.

Given a user's creative prompt, you must generate a JSON object with exactly these fields:
- image_prompt: A detailed prompt for generating a still image (if no image is provided)
- kling_prompt: A cinematic prompt for Kling video generation focusing on motion and camera work
- voice_script: A script with voice tags like [voice:emma]Hello world[/voice]. Available voices: emma, john, sarah, david
- sfx_brief: A brief description of sound effects and ambient audio

Guidelines:
1. Make each prompt specific and detailed
2. Ensure voice_script uses proper voice tags
3. Keep sfx_brief focused on environmental sounds
4. Maintain consistency across all prompts
5. Output ONLY valid JSON, no markdown or explanations`

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    })

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `User prompt: ${prompt}` }
    ])

    const response = await result.response
    const text = response.text()
    
    let expandedPrompts: ExpandedPrompts
    try {
      expandedPrompts = JSON.parse(text)
      
      // Validate required fields
      const requiredFields: (keyof ExpandedPrompts)[] = ['image_prompt', 'kling_prompt', 'voice_script', 'sfx_brief']
      for (const field of requiredFields) {
        if (!expandedPrompts[field] || typeof expandedPrompts[field] !== 'string') {
          throw new Error(`Missing or invalid field: ${field}`)
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text)
      
      // Retry once with more explicit instructions
      const retryResult = await model.generateContent([
        { text: SYSTEM_PROMPT + '\n\nIMPORTANT: Return ONLY a valid JSON object with no markdown formatting.' },
        { text: `User prompt: ${prompt}` }
      ])
      
      const retryText = await retryResult.response.text()
      try {
        expandedPrompts = JSON.parse(retryText)
      } catch (retryError) {
        return NextResponse.json(
          { error: 'Failed to generate valid JSON from Gemini', details: retryText },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(expandedPrompts)
  } catch (error) {
    console.error('Gemini expand error:', error)
    return NextResponse.json(
      { error: 'Failed to expand prompt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}