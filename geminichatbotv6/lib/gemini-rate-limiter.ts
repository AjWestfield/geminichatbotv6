// Rate limiter for Gemini API calls to prevent quota exceeded errors
export class GeminiRateLimiter {
  private queue: Array<{
    fn: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
    estimatedTokens: number
  }> = []
  
  private processing = false
  private tokensUsed = 0
  private resetTime = Date.now() + 60000 // 1 minute window
  private readonly maxTokensPerMinute: number
  private readonly bufferPercentage = 0.9 // Use only 90% of quota to be safe

  constructor(maxTokensPerMinute = 250000) {
    this.maxTokensPerMinute = maxTokensPerMinute * this.bufferPercentage
  }

  async execute<T>(
    fn: () => Promise<T>, 
    estimatedTokens: number = 1000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        estimatedTokens
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true

    while (this.queue.length > 0) {
      const task = this.queue[0]
      
      // Reset counter if minute has passed
      if (Date.now() > this.resetTime) {
        console.log('[RateLimiter] Resetting token counter')
        this.tokensUsed = 0
        this.resetTime = Date.now() + 60000
      }

      // Check if we can process this request
      if (this.tokensUsed + task.estimatedTokens > this.maxTokensPerMinute) {
        // Need to wait until reset
        const waitTime = this.resetTime - Date.now()
        console.log(`[RateLimiter] Approaching quota limit. Waiting ${Math.ceil(waitTime/1000)}s...`)
        
        await new Promise(resolve => setTimeout(resolve, waitTime))
        
        // Reset after waiting
        this.tokensUsed = 0
        this.resetTime = Date.now() + 60000
      }

      // Remove from queue and process
      this.queue.shift()
      this.tokensUsed += task.estimatedTokens

      try {
        console.log(`[RateLimiter] Processing request. Tokens used: ${this.tokensUsed}/${this.maxTokensPerMinute}`)
        const result = await task.fn()
        task.resolve(result)
      } catch (error: any) {
        // Handle rate limit errors with retry
        if (error.status === 429) {
          console.log('[RateLimiter] Hit 429 rate limit, adding back to queue')
          // Add back to front of queue with increased token estimate
          this.queue.unshift({
            ...task,
            estimatedTokens: task.estimatedTokens * 1.5
          })
          
          // Force wait for reset
          const waitTime = Math.max(30000, this.resetTime - Date.now())
          await new Promise(resolve => setTimeout(resolve, waitTime))
          this.tokensUsed = 0
          this.resetTime = Date.now() + 60000
        } else {
          task.reject(error)
        }
      }
    }

    this.processing = false
  }

  // Estimate tokens based on content
  static estimateTokens(content: string, hasImages = false): number {
    // Rough estimation: ~4 chars per token for text
    let tokens = Math.ceil(content.length / 4)
    
    // Add tokens for images (Gemini uses ~250-500 tokens per image)
    if (hasImages) {
      tokens += 500
    }
    
    // Add buffer for response tokens (assume response is similar length)
    tokens *= 2
    
    return Math.min(tokens, 50000) // Cap at reasonable maximum
  }
}

// Singleton instance for the app
let rateLimiterInstance: GeminiRateLimiter | null = null

export function getGeminiRateLimiter(maxTokensPerMinute?: number): GeminiRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new GeminiRateLimiter(maxTokensPerMinute)
  }
  return rateLimiterInstance
}

// Helper function to wrap Gemini API calls
export async function callGeminiWithRateLimit<T>(
  fn: () => Promise<T>,
  content: string,
  hasImages = false
): Promise<T> {
  const rateLimiter = getGeminiRateLimiter()
  const estimatedTokens = GeminiRateLimiter.estimateTokens(content, hasImages)
  
  return rateLimiter.execute(fn, estimatedTokens)
}
