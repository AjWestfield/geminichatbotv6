import { create } from 'zustand'

export type VideoStage =
  | 'initializing'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'

export interface VideoProgress {
  videoId: string
  prompt: string
  progress: number
  stage: VideoStage
  stageMessage: string
  status: 'generating' | 'completed' | 'failed'
  elapsedTime: number
  estimatedRemainingTime: number
  estimatedTotalTime: number
  error?: string
  createdAt: Date
  completedAt?: Date
  lastUpdated: Date
  predictionId?: string
  replicateStatus?: string
}

export interface VideoGenerationState {
  [videoId: string]: VideoProgress
}

interface VideoProgressStore {
  progress: VideoGenerationState
  updateProgress: (videoId: string, progress: Partial<VideoProgress>) => void
  removeProgress: (videoId: string) => void
  getProgress: (videoId: string) => VideoProgress | undefined
  addVideo: (videoId: string, prompt: string, duration?: number, predictionId?: string) => void
  completeVideo: (videoId: string) => void
  failVideo: (videoId: string, error: string) => void
  updateStage: (videoId: string, stage: VideoStage, message?: string) => void
  calculateProgress: (videoId: string) => void
  getAllGeneratingVideos: () => VideoProgress[]
}

// Progress calculation helpers
const getEstimatedTotalTime = (duration: number = 5): number => {
  // Kling v1.6 typical generation times:
  // 5s video: 2-5 minutes (average 3.5 minutes = 210 seconds)
  // 10s video: 4-8 minutes (average 6 minutes = 360 seconds)
  return duration === 10 ? 360 : 210
}

const getStageMessage = (stage: VideoStage, replicateStatus?: string, progress?: number): string => {
  switch (stage) {
    case 'initializing':
      return 'Initializing Kling v1.6 model...'
    case 'processing':
      if (replicateStatus === 'starting') return 'Starting video generation...'
      if (replicateStatus === 'processing') {
        // Add more dynamic messages based on progress
        if (progress && progress < 30) return 'Analyzing prompt and preparing frames...'
        if (progress && progress < 50) return 'Generating initial video frames...'
        if (progress && progress < 70) return 'Processing motion and transitions...'
        if (progress && progress < 85) return 'Enhancing video quality...'
        return 'Finalizing video generation...'
      }
      return 'Processing your video...'
    case 'finalizing':
      return 'Finalizing video and creating download link...'
    case 'completed':
      return 'Video generation complete!'
    case 'failed':
      return 'Generation failed'
    default:
      return 'Processing...'
  }
}

const calculateProgressFromElapsed = (elapsedTime: number, estimatedTotal: number, stage: VideoStage, apiProgress?: number): number => {
  const stageRanges = {
    initializing: { min: 0, max: 15 },    // Increased range for initialization
    processing: { min: 15, max: 90 },     // Main processing stage
    finalizing: { min: 90, max: 100 },    // Final processing
    completed: { min: 100, max: 100 },
    failed: { min: 0, max: 0 }
  }

  const range = stageRanges[stage]

  if (stage === 'completed') return 100
  if (stage === 'failed') return 0

  // If we have API progress data, use it within the stage range
  if (apiProgress !== undefined && apiProgress > 0) {
    return Math.min(Math.max(range.min, apiProgress), range.max)
  }

  // Enhanced time-based estimation with logarithmic progression
  // This provides faster initial progress and slower later progress
  const timeProgress = Math.min(elapsedTime / estimatedTotal, 1)
  
  // Use logarithmic curve for more realistic progress
  // This gives faster progress at start and slower near completion
  const logProgress = Math.log(1 + timeProgress * 9) / Math.log(10) // log base 10
  
  const calculatedProgress = range.min + (logProgress * (range.max - range.min))

  // Add some randomness for more realistic feel (±1%)
  const variance = (Math.random() - 0.5) * 2
  const finalProgress = calculatedProgress + variance

  // Ensure progress doesn't exceed stage maximum and always moves forward
  return Math.floor(Math.max(range.min, Math.min(finalProgress, range.max)))
}

export const useVideoProgressStore = create<VideoProgressStore>((set, get) => ({
  progress: {},

  updateProgress: (videoId: string, updates: Partial<VideoProgress>) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [videoId]: {
          ...state.progress[videoId],
          ...updates,
          videoId,
          lastUpdated: new Date()
        }
      }
    }))
  },

  removeProgress: (videoId: string) => {
    set((state) => {
      const { [videoId]: _, ...rest } = state.progress
      return { progress: rest }
    })
  },

  getProgress: (videoId: string) => {
    return get().progress[videoId]
  },

  addVideo: (videoId: string, prompt: string, duration: number = 5, predictionId?: string) => {
    const estimatedTotal = getEstimatedTotalTime(duration)

    set((state) => ({
      progress: {
        ...state.progress,
        [videoId]: {
          videoId,
          prompt,
          progress: 0,
          stage: 'initializing',
          stageMessage: getStageMessage('initializing'),
          status: 'generating',
          elapsedTime: 0,
          estimatedRemainingTime: estimatedTotal,
          estimatedTotalTime: estimatedTotal,
          createdAt: new Date(),
          lastUpdated: new Date(),
          predictionId,
          replicateStatus: 'starting'
        }
      }
    }))
  },

  completeVideo: (videoId: string) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [videoId]: {
          ...state.progress[videoId],
          progress: 100,
          status: 'completed',
          stage: 'completed',
          stageMessage: getStageMessage('completed'),
          estimatedRemainingTime: 0,
          completedAt: new Date(),
          lastUpdated: new Date()
        }
      }
    }))
  },

  failVideo: (videoId: string, error: string) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [videoId]: {
          ...state.progress[videoId],
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

  updateStage: (videoId: string, stage: VideoStage, message?: string) => {
    const currentProgress = get().progress[videoId]
    if (!currentProgress) return

    const stageMessage = message || getStageMessage(stage, currentProgress.replicateStatus, currentProgress.progress)

    set((state) => ({
      progress: {
        ...state.progress,
        [videoId]: {
          ...state.progress[videoId],
          stage,
          stageMessage,
          lastUpdated: new Date()
        }
      }
    }))
  },

  calculateProgress: (videoId: string) => {
    const current = get().progress[videoId]
    if (!current || current.status !== 'generating') return

    const now = new Date()
    const elapsedTime = Math.floor((now.getTime() - current.createdAt.getTime()) / 1000)

    // Use API progress if available, otherwise calculate from elapsed time
    const progress = calculateProgressFromElapsed(
      elapsedTime,
      current.estimatedTotalTime,
      current.stage,
      current.progress // Use existing progress as baseline
    )

    const remainingTime = Math.max(0, current.estimatedTotalTime - elapsedTime)

    // Only update if progress has actually changed or time has advanced significantly
    const progressChanged = Math.abs((current.progress || 0) - progress) >= 1
    const timeChanged = Math.abs(current.elapsedTime - elapsedTime) >= 2

    if (progressChanged || timeChanged) {
      // Update stage message with new progress
      const stageMessage = getStageMessage(current.stage, current.replicateStatus, progress)
      
      set((state) => ({
        progress: {
          ...state.progress,
          [videoId]: {
            ...state.progress[videoId],
            elapsedTime,
            progress: Math.min(progress, current.stage === 'completed' ? 100 : 99), // Never show 100% unless completed
            estimatedRemainingTime: remainingTime,
            stageMessage,
            lastUpdated: now
          }
        }
      }))
    }
  },

  getAllGeneratingVideos: () => {
    const state = get()
    return Object.values(state.progress).filter(video => video.status === 'generating')
  }
}))
