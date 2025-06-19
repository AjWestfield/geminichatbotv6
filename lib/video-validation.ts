import { GeneratedVideo } from "./video-generation-types"

/**
 * Check if a video has a valid permanent URL
 */
export function hasValidPermanentUrl(video: GeneratedVideo): boolean {
  if (!video.url) return false
  
  // Blob URLs are temporary and expire
  if (video.url.startsWith('blob:')) return false
  
  // Data URLs are embedded but very large
  if (video.url.startsWith('data:')) return false
  
  // Must be http(s) URL
  try {
    const url = new URL(video.url)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Filter videos to only include those with valid URLs or non-completed status
 */
export function filterValidVideos(videos: GeneratedVideo[]): GeneratedVideo[] {
  return videos.filter(video => {
    // Keep videos that are still generating or failed
    if (video.status !== 'completed') return true
    
    // Only keep completed videos with valid permanent URLs
    return hasValidPermanentUrl(video)
  })
}

/**
 * Validate and clean video data before saving
 */
export function prepareVideoForStorage(video: GeneratedVideo): GeneratedVideo | null {
  // Don't save videos without IDs
  if (!video.id) {
    console.warn('[VideoValidation] Skipping video without ID')
    return null
  }
  
  // Don't save completed videos without valid URLs
  if (video.status === 'completed' && !hasValidPermanentUrl(video)) {
    console.warn(`[VideoValidation] Skipping completed video ${video.id} with invalid URL:`, video.url)
    return null
  }
  
  // Return clean video data
  return {
    id: video.id,
    prompt: video.prompt || '',
    url: video.url || '',
    duration: video.duration || 5,
    aspectRatio: video.aspectRatio || '16:9',
    model: video.model || 'standard',
    status: video.status,
    sourceImage: video.sourceImage,
    thumbnailUrl: video.thumbnailUrl,
    createdAt: video.createdAt || new Date(),
    completedAt: video.completedAt,
    error: video.error,
    predictionId: video.predictionId,
    finalElapsedTime: video.finalElapsedTime
  }
}

/**
 * Log video validation issues for debugging
 */
export function logVideoValidation(videos: GeneratedVideo[]): void {
  const issues: Array<{ video: GeneratedVideo; problems: string[] }> = []
  
  videos.forEach(video => {
    const problems: string[] = []
    
    if (!video.id) problems.push('Missing ID')
    if (!video.status) problems.push('Missing status')
    
    if (video.status === 'completed') {
      if (!video.url) {
        problems.push('Completed but no URL')
      } else if (video.url.startsWith('blob:')) {
        problems.push('Has temporary blob URL')
      } else if (!hasValidPermanentUrl(video)) {
        problems.push('Invalid URL format')
      }
    }
    
    if (problems.length > 0) {
      issues.push({ video, problems })
    }
  })
  
  if (issues.length > 0) {
    console.group('⚠️ Video Validation Issues')
    issues.forEach(({ video, problems }) => {
      console.warn(`Video ${video.id}:`, problems.join(', '))
    })
    console.groupEnd()
  }
}
