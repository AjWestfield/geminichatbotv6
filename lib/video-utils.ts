// Video utility functions to prevent duplicates and ensure data integrity

import { GeneratedVideo } from './video-generation-types'

/**
 * Deduplicate videos array by ID, keeping the most recent version of each video
 */
export function deduplicateVideos(videos: GeneratedVideo[]): GeneratedVideo[] {
  const videoMap = new Map<string, GeneratedVideo>()

  // Iterate in reverse to keep the latest version of each video
  for (let i = videos.length - 1; i >= 0; i--) {
    const video = videos[i]
    if (video && video.id && !videoMap.has(video.id)) {
      videoMap.set(video.id, video)
    }
  }

  // Convert back to array in original order
  return Array.from(videoMap.values()).reverse()
}

/**
 * Merge new videos with existing ones, preventing duplicates
 */
export function mergeVideos(existingVideos: GeneratedVideo[], newVideos: GeneratedVideo[]): GeneratedVideo[] {
  const videoMap = new Map<string, GeneratedVideo>()

  // Add existing videos first
  existingVideos.forEach(video => {
    if (video && video.id) {
      videoMap.set(video.id, video)
    }
  })

  // Add or update with new videos
  newVideos.forEach(video => {
    if (video && video.id) {
      videoMap.set(video.id, video)
    }
  })

  return Array.from(videoMap.values())
}

/**
 * Update a specific video in the array
 */
export function updateVideo(videos: GeneratedVideo[], videoId: string, updates: Partial<GeneratedVideo>): GeneratedVideo[] {
  return videos.map(video =>
    video.id === videoId ? { ...video, ...updates } : video
  )
}

/**
 * Remove a video from the array
 */
export function removeVideo(videos: GeneratedVideo[], videoId: string): GeneratedVideo[] {
  return videos.filter(video => video.id !== videoId)
}

/**
 * Generate a thumbnail for a video (placeholder implementation)
 */
export function generateVideoThumbnail(videoUrl: string): Promise<string> {
  // This is a placeholder implementation
  // In a real implementation, you would extract a frame from the video
  return Promise.resolve('')
}

/**
 * Get video duration (placeholder implementation)
 */
export function getVideoDuration(videoUrl: string): Promise<number> {
  // This is a placeholder implementation
  // In a real implementation, you would analyze the video file
  return Promise.resolve(0)
}

/**
 * Format video duration in human-readable format
 */
export function formatVideoDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  if (minutes < 60) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}
// Utility to check if a URL is valid and accessible
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;

  // Blob URLs are only valid in the current session
  if (url.startsWith('blob:')) {
    return false;
  }

  // Check if it's a valid HTTP(S) URL
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

// Check if a video can be displayed
export function canDisplayVideo(video: GeneratedVideo): boolean {
  if (video.status !== 'completed') return true; // Non-completed videos don't need valid URLs
  return isValidVideoUrl(video.url);
}

// Get display message for invalid video
export function getInvalidVideoMessage(video: GeneratedVideo): string {
  // Handle null/undefined video objects
  if (!video) {
    return 'Video data is missing or corrupted.';
  }

  // Handle missing URL
  if (!video.url) {
    return 'Video URL is missing. The video may still be processing.';
  }

  // Handle different URL types
  try {
    if (video.url.startsWith('blob:')) {
      return 'Video URL expired. This video was generated in a previous session and needs to be regenerated.';
    }
    if (video.url.startsWith('data:')) {
      return 'Video is stored as data URL which is not supported for playback.';
    }
    return 'Invalid video URL format';
  } catch (error) {
    console.error('[VideoUtils] Error processing video URL:', error, video);
    return 'Error processing video data.';
  }
}
