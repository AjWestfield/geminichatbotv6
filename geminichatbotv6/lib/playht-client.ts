import axios from 'axios'

export interface PlayHTVoiceOptions {
  text: string
  voice: string
  voiceEngine?: 'PlayHT2.0' | 'PlayHT3.0-mini'
  emotion?: string
  speed?: number
  temperature?: number
  voiceGuidance?: number
  textGuidance?: number
  outputFormat?: 'mp3' | 'wav' | 'flac' | 'mulaw'
  sampleRate?: number
  bitrate?: number
  seed?: number
}

export interface PlayHTStreamOptions extends PlayHTVoiceOptions {
  onChunk?: (chunk: Buffer) => void
  onProgress?: (progress: number) => void
}

export interface PlayHTCloneVoiceOptions {
  voiceName: string
  sampleFiles: string[] // URLs or base64 encoded audio
  description?: string
}

export class PlayHTClient {
  private apiKey: string
  private userId: string
  private baseUrl = 'https://api.play.ht/api/v2'
  
  constructor(apiKey: string, userId: string) {
    if (!apiKey || !userId) {
      throw new Error('PlayHT API key and User ID are required')
    }
    this.apiKey = apiKey
    this.userId = userId
  }
  
  /**
   * Generate speech from text
   */
  async generateSpeech(options: PlayHTVoiceOptions): Promise<{
    url: string
    duration: number
    id: string
  }> {
    try {
      console.log('[PlayHT] Generating speech with options:', {
        ...options,
        text: options.text.substring(0, 50) + '...'
      })
      
      const response = await axios.post(
        `${this.baseUrl}/tts`,
        {
          text: options.text,
          voice: options.voice,
          voice_engine: options.voiceEngine || 'PlayHT2.0',
          emotion: options.emotion,
          speed: options.speed || 1,
          temperature: options.temperature,
          voice_guidance: options.voiceGuidance || 2,
          text_guidance: options.textGuidance || 1,
          output_format: options.outputFormat || 'mp3',
          sample_rate: options.sampleRate || 24000,
          bitrate: options.bitrate || 128,
          seed: options.seed
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-User-ID': this.userId,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )
      
      console.log('[PlayHT] Speech generation response:', response.data)
      
      // PlayHT returns an ID that we need to poll for status
      const jobId = response.data.id
      
      // Poll for completion
      const result = await this.pollForCompletion(jobId)
      
      return {
        url: result.audio_url,
        duration: result.duration || 0,
        id: jobId
      }
    } catch (error) {
      console.error('[PlayHT] Speech generation error:', error)
      if (axios.isAxiosError(error)) {
        throw new Error(`PlayHT API error: ${error.response?.data?.error || error.message}`)
      }
      throw error
    }
  }
  
  /**
   * Stream speech generation
   */
  async streamSpeech(options: PlayHTStreamOptions): Promise<void> {
    try {
      console.log('[PlayHT] Starting speech stream...')
      
      const response = await axios.post(
        `${this.baseUrl}/tts/stream`,
        {
          text: options.text,
          voice: options.voice,
          voice_engine: options.voiceEngine || 'PlayHT2.0',
          emotion: options.emotion,
          speed: options.speed || 1,
          temperature: options.temperature,
          voice_guidance: options.voiceGuidance || 2,
          text_guidance: options.textGuidance || 1,
          output_format: options.outputFormat || 'mp3',
          sample_rate: options.sampleRate || 24000,
          bitrate: options.bitrate || 128
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-User-ID': this.userId,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'stream'
        }
      )
      
      let totalBytes = 0
      const contentLength = parseInt(response.headers['content-length'] || '0')
      
      response.data.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
        
        if (options.onChunk) {
          options.onChunk(chunk)
        }
        
        if (options.onProgress && contentLength > 0) {
          const progress = Math.floor((totalBytes / contentLength) * 100)
          options.onProgress(progress)
        }
      })
      
      return new Promise((resolve, reject) => {
        response.data.on('end', () => {
          console.log('[PlayHT] Stream completed')
          resolve()
        })
        
        response.data.on('error', (error: Error) => {
          console.error('[PlayHT] Stream error:', error)
          reject(error)
        })
      })
    } catch (error) {
      console.error('[PlayHT] Stream error:', error)
      throw error
    }
  }
  
  /**
   * Clone a voice from audio samples
   */
  async cloneVoice(options: PlayHTCloneVoiceOptions): Promise<{
    voiceId: string
    status: string
  }> {
    try {
      console.log('[PlayHT] Cloning voice:', options.voiceName)
      
      const response = await axios.post(
        `${this.baseUrl}/cloned-voices`,
        {
          voice_name: options.voiceName,
          sample_files: options.sampleFiles,
          description: options.description
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-User-ID': this.userId,
            'Content-Type': 'application/json'
          }
        }
      )
      
      console.log('[PlayHT] Voice clone response:', response.data)
      
      return {
        voiceId: response.data.id,
        status: response.data.status
      }
    } catch (error) {
      console.error('[PlayHT] Voice clone error:', error)
      throw error
    }
  }
  
  /**
   * Get list of available voices
   */
  async getVoices(options?: {
    voiceEngine?: string
    language?: string
    gender?: string
  }): Promise<Array<{
    id: string
    name: string
    language: string
    gender: string
    voiceEngine: string
    isCloned: boolean
  }>> {
    try {
      const params = new URLSearchParams()
      if (options?.voiceEngine) params.append('voice_engine', options.voiceEngine)
      if (options?.language) params.append('language', options.language)
      if (options?.gender) params.append('gender', options.gender)
      
      const response = await axios.get(
        `${this.baseUrl}/voices?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-User-ID': this.userId
          }
        }
      )
      
      return response.data.voices.map((voice: any) => ({
        id: voice.id,
        name: voice.name,
        language: voice.language,
        gender: voice.gender,
        voiceEngine: voice.voice_engine,
        isCloned: voice.is_cloned || false
      }))
    } catch (error) {
      console.error('[PlayHT] Get voices error:', error)
      throw error
    }
  }
  
  /**
   * Poll for job completion
   */
  private async pollForCompletion(jobId: string, maxAttempts = 60): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/tts/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'X-User-ID': this.userId
            }
          }
        )
        
        if (response.data.status === 'complete') {
          return response.data
        } else if (response.data.status === 'failed') {
          throw new Error(`Speech generation failed: ${response.data.error}`)
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error('Timeout waiting for speech generation')
        }
      }
    }
    
    throw new Error('Maximum polling attempts reached')
  }
}