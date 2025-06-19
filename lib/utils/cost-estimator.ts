// /lib/utils/cost-estimator.ts

export interface ServiceCost {
  service: string
  operation: string
  units: number
  unitCost: number
  totalCost: number
  currency: 'USD'
}

export interface PipelineCost {
  services: ServiceCost[]
  totalCost: number
  currency: 'USD'
}

// Pricing data (as of 2024)
const PRICING = {
  gemini: {
    'gemini-2.0-flash-exp': {
      input: 0.00015 / 1000, // per token
      output: 0.0006 / 1000  // per token
    }
  },
  openai: {
    'dall-e-3': {
      '1024x1024': {
        standard: 0.04,
        hd: 0.08
      }
    },
    'gpt-image-1': {
      '1024x1024': {
        low: 0.03,
        medium: 0.05,
        high: 0.07
      }
    },
    'gpt-4': {
      input: 0.03 / 1000,
      output: 0.06 / 1000
    }
  },
  kling: {
    standard: {
      5: 0.30,  // 5 second video
      10: 0.60  // 10 second video
    },
    pro: {
      5: 0.50,
      10: 1.00
    }
  },
  playht: {
    'PlayHT2.0': 0.00003, // per character
    'PlayHT3.0-mini': 0.00005 // per character
  },
  wav2lip: {
    base: 0.10 // per video
  },
  mmaudio: {
    base: 0.15 // per audio generation
  }
}

export class CostEstimator {
  private costs: ServiceCost[] = []

  addGeminiCost(model: string, inputTokens: number, outputTokens: number) {
    const pricing = PRICING.gemini[model as keyof typeof PRICING.gemini]
    if (!pricing) return

    const inputCost = inputTokens * pricing.input
    const outputCost = outputTokens * pricing.output
    const totalCost = inputCost + outputCost

    this.costs.push({
      service: 'Gemini',
      operation: `${model} (${inputTokens} in, ${outputTokens} out)`,
      units: inputTokens + outputTokens,
      unitCost: (pricing.input + pricing.output) / 2,
      totalCost,
      currency: 'USD'
    })
  }

  addImageGenerationCost(model: string, size: string, quality: string) {
    if (model === 'dall-e-3') {
      const pricing = PRICING.openai['dall-e-3'][size as keyof typeof PRICING.openai['dall-e-3']]
      if (!pricing) return

      const cost = pricing[quality as keyof typeof pricing] || pricing.standard

      this.costs.push({
        service: 'OpenAI',
        operation: `DALL-E 3 ${size} ${quality}`,
        units: 1,
        unitCost: cost,
        totalCost: cost,
        currency: 'USD'
      })
    } else if (model === 'gpt-image-1') {
      const pricing = PRICING.openai['gpt-image-1'][size as keyof typeof PRICING.openai['gpt-image-1']]
      if (!pricing) return

      const cost = pricing[quality as keyof typeof pricing] || pricing.high

      this.costs.push({
        service: 'OpenAI',
        operation: `GPT-Image-1 ${size} ${quality}`,
        units: 1,
        unitCost: cost,
        totalCost: cost,
        currency: 'USD'
      })
    }
  }

  addKlingVideoCost(model: 'standard' | 'pro', duration: 5 | 10) {
    const cost = PRICING.kling[model][duration]

    this.costs.push({
      service: 'Kling',
      operation: `${model} ${duration}s video`,
      units: 1,
      unitCost: cost,
      totalCost: cost,
      currency: 'USD'
    })
  }

  addPlayHTCost(engine: string, characterCount: number) {
    const unitCost = PRICING.playht[engine as keyof typeof PRICING.playht] || PRICING.playht['PlayHT2.0']
    const totalCost = characterCount * unitCost

    this.costs.push({
      service: 'PlayHT',
      operation: `${engine} TTS (${characterCount} chars)`,
      units: characterCount,
      unitCost,
      totalCost,
      currency: 'USD'
    })
  }

  addWav2LipCost() {
    this.costs.push({
      service: 'Wav2Lip',
      operation: 'Lip sync',
      units: 1,
      unitCost: PRICING.wav2lip.base,
      totalCost: PRICING.wav2lip.base,
      currency: 'USD'
    })
  }

  addMMAudioCost() {
    this.costs.push({
      service: 'MMAudio',
      operation: 'Sound effects',
      units: 1,
      unitCost: PRICING.mmaudio.base,
      totalCost: PRICING.mmaudio.base,
      currency: 'USD'
    })
  }

  getTotalCost(): PipelineCost {
    const totalCost = this.costs.reduce((sum, cost) => sum + cost.totalCost, 0)

    return {
      services: this.costs,
      totalCost,
      currency: 'USD'
    }
  }

  reset() {
    this.costs = []
  }

  // Estimate costs for prompt expansion pipeline
  static estimatePromptExpansionPipeline(options: {
    hasImage?: boolean
    voiceEngine?: string
    klingModel?: 'standard' | 'pro'
    duration?: 5 | 10
  } = {}): PipelineCost {
    const estimator = new CostEstimator()

    // Gemini prompt expansion (estimated 500 input, 200 output tokens)
    estimator.addGeminiCost('gemini-2.0-flash-exp', 500, 200)

    // Image generation if needed
    if (!options.hasImage) {
      estimator.addImageGenerationCost('gpt-image-1', '1024x1024', 'high')
    }

    // Kling video
    estimator.addKlingVideoCost(
      options.klingModel || 'pro',
      options.duration || 10
    )

    // PlayHT TTS (estimated 150 characters)
    estimator.addPlayHTCost(
      options.voiceEngine || 'PlayHT3.0-mini',
      150
    )

    // Wav2Lip
    estimator.addWav2LipCost()

    // MMAudio
    estimator.addMMAudioCost()

    return estimator.getTotalCost()
  }
}