import { create } from 'zustand'
import type { GeneratedImage } from '@/lib/image-utils'

export type ImageGenerationStage =
  | 'initializing'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'

export interface ImageGenerationProgress {
  imageId: string
  prompt: string
  originalImageId?: string // For edited images
  originalImageUrl?: string
  progress: number
  stage: ImageGenerationStage
  stageMessage: string
  status: 'generating' | 'completed' | 'failed'
  elapsedTime: number
  estimatedRemainingTime: number
  estimatedTotalTime: number
  error?: string
  createdAt: Date
  completedAt?: Date
  lastUpdated: Date
  quality?: string
  style?: string
  size?: string
  model?: string
  generatedImage?: GeneratedImage // The final result
}

export interface ImageGenerationState {
  [imageId: string]: ImageGenerationProgress
}

interface ImageProgressStore {
  progress: ImageGenerationState
  updateProgress: (imageId: string, progress: Partial<ImageGenerationProgress>) => void
  removeProgress: (imageId: string) => void
  getProgress: (imageId: string) => ImageGenerationProgress | undefined
  addImageGeneration: (
    imageId: string,
    prompt: string,
    options?: {
      originalImageId?: string
      originalImageUrl?: string
      quality?: string
      style?: string
      size?: string
      model?: string
    }
  ) => void
  completeImageGeneration: (imageId: string, generatedImage: GeneratedImage) => void
  failImageGeneration: (imageId: string, error: string) => void
  updateStage: (imageId: string, stage: ImageGenerationStage, message?: string) => void
  calculateProgress: (imageId: string) => void
  getAllGeneratingImages: () => ImageGenerationProgress[]
}

// Progress calculation helpers
const getEstimatedTotalTime = (quality: string = 'standard', isEdit: boolean = false): number => {
  // GPT-Image-1 HD: 15-30 seconds
  // GPT-Image-1 Standard: 10-20 seconds
  // WaveSpeed Flux: 5-15 seconds
  // Edit operations typically take longer
  const baseTime = quality === 'hd' ? 22 : 12
  return isEdit ? baseTime * 1.5 : baseTime
}

const getStageMessage = (stage: ImageGenerationStage, model?: string, progress?: number, isEdit: boolean = false): string => {
  const modelName = model?.includes('gpt-image-1') ? 'GPT-Image-1' :
                   model === 'flux-kontext-pro' ? 'Flux Kontext Pro' :
                   model === 'flux-kontext-max' ? 'Flux Kontext Max' :
                   model === 'flux-dev-ultra-fast' ? 'WaveSpeed AI' : 
                   'AI model'
  
  switch (stage) {
    case 'initializing':
      return isEdit ? `Initializing ${modelName} for image editing...` : `Initializing ${modelName}...`
    case 'processing':
      if (progress && progress < 30) return isEdit ? 'Analyzing original image...' : 'Analyzing prompt...'
      if (progress && progress < 50) return isEdit ? 'Applying edits to image...' : 'Generating initial concepts...'
      if (progress && progress < 70) return isEdit ? 'Refining edited regions...' : 'Rendering image details...'
      if (progress && progress < 85) return 'Enhancing image quality...'
      return 'Finalizing generation...'
    case 'finalizing':
      return 'Processing final image...'
    case 'completed':
      return isEdit ? 'Image edit complete!' : 'Image generation complete!'
    case 'failed':
      return 'Generation failed'
    default:
      return 'Processing...'
  }
}

const calculateProgressFromElapsed = (elapsedTime: number, estimatedTotal: number, stage: ImageGenerationStage): number => {
  const stageRanges = {
    initializing: { min: 0, max: 20 },
    processing: { min: 20, max: 85 },
    finalizing: { min: 85, max: 100 },
    completed: { min: 100, max: 100 },
    failed: { min: 0, max: 0 }
  }

  const range = stageRanges[stage]

  if (stage === 'completed') return 100
  if (stage === 'failed') return 0

  // Enhanced time-based estimation with smooth progression
  const timeProgress = Math.min(elapsedTime / estimatedTotal, 1)
  
  // Use a smoother curve for more realistic progress
  const smoothProgress = timeProgress * timeProgress * (3 - 2 * timeProgress) // Smoothstep function
  
  const calculatedProgress = range.min + (smoothProgress * (range.max - range.min))

  // Add small variance for realistic feel
  const variance = (Math.random() - 0.5) * 1
  const finalProgress = calculatedProgress + variance

  return Math.floor(Math.max(range.min, Math.min(finalProgress, range.max)))
}

export const useImageProgressStore = create<ImageProgressStore>((set, get) => ({
  progress: {},

  updateProgress: (imageId: string, updates: Partial<ImageGenerationProgress>) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [imageId]: {
          ...state.progress[imageId],
          ...updates,
          imageId,
          lastUpdated: new Date()
        }
      }
    }))
  },

  removeProgress: (imageId: string) => {
    set((state) => {
      const { [imageId]: _, ...rest } = state.progress
      return { progress: rest }
    })
  },

  getProgress: (imageId: string) => {
    return get().progress[imageId]
  },

  addImageGeneration: (imageId: string, prompt: string, options = {}) => {
    const estimatedTotal = getEstimatedTotalTime(options.quality, !!options.originalImageId)
    const isEdit = !!options.originalImageId

    set((state) => ({
      progress: {
        ...state.progress,
        [imageId]: {
          imageId,
          prompt,
          originalImageId: options.originalImageId,
          originalImageUrl: options.originalImageUrl,
          progress: 0,
          stage: 'initializing',
          stageMessage: getStageMessage('initializing', options.model, 0, isEdit),
          status: 'generating',
          elapsedTime: 0,
          estimatedRemainingTime: estimatedTotal,
          estimatedTotalTime: estimatedTotal,
          createdAt: new Date(),
          lastUpdated: new Date(),
          quality: options.quality,
          style: options.style,
          size: options.size,
          model: options.model
        }
      }
    }))
  },

  completeImageGeneration: (imageId: string, generatedImage: GeneratedImage) => {
    const current = get().progress[imageId]
    if (!current) return

    set((state) => ({
      progress: {
        ...state.progress,
        [imageId]: {
          ...state.progress[imageId],
          progress: 100,
          status: 'completed',
          stage: 'completed',
          stageMessage: getStageMessage('completed', current.model, 100, !!current.originalImageId),
          estimatedRemainingTime: 0,
          completedAt: new Date(),
          lastUpdated: new Date(),
          generatedImage
        }
      }
    }))
  },

  failImageGeneration: (imageId: string, error: string) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [imageId]: {
          ...state.progress[imageId],
          status: 'failed',
          stage: 'failed',
          stageMessage: getStageMessage('failed'),
          error,
          completedAt: new Date(),
          lastUpdated: new Date()
        }
      }
    }))
  },

  updateStage: (imageId: string, stage: ImageGenerationStage, message?: string) => {
    const currentProgress = get().progress[imageId]
    if (!currentProgress) return

    const isEdit = !!currentProgress.originalImageId
    const stageMessage = message || getStageMessage(stage, currentProgress.model, currentProgress.progress, isEdit)

    set((state) => ({
      progress: {
        ...state.progress,
        [imageId]: {
          ...state.progress[imageId],
          stage,
          stageMessage,
          lastUpdated: new Date()
        }
      }
    }))
  },

  calculateProgress: (imageId: string) => {
    const current = get().progress[imageId]
    if (!current || current.status !== 'generating') return

    const now = new Date()
    const elapsedTime = Math.floor((now.getTime() - current.createdAt.getTime()) / 1000)

    const progress = calculateProgressFromElapsed(
      elapsedTime,
      current.estimatedTotalTime,
      current.stage
    )

    const remainingTime = Math.max(0, current.estimatedTotalTime - elapsedTime)

    // Only update if progress has changed or time has advanced
    const progressChanged = Math.abs((current.progress || 0) - progress) >= 1
    const timeChanged = Math.abs(current.elapsedTime - elapsedTime) >= 1

    if (progressChanged || timeChanged) {
      const isEdit = !!current.originalImageId
      const stageMessage = getStageMessage(current.stage, current.model, progress, isEdit)
      
      set((state) => ({
        progress: {
          ...state.progress,
          [imageId]: {
            ...state.progress[imageId],
            elapsedTime,
            progress: Math.min(progress, current.stage === 'completed' ? 100 : 99),
            estimatedRemainingTime: remainingTime,
            stageMessage,
            lastUpdated: now
          }
        }
      }))
    }
  },

  getAllGeneratingImages: () => {
    const state = get()
    return Object.values(state.progress).filter(img => img.status === 'generating')
  }
}))