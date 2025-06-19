// Track deleted videos to prevent them from being re-loaded from database
const DELETED_VIDEOS_KEY = 'gemini-chat-deleted-videos'

export interface DeletedVideoRecord {
  videoId: string
  deletedAt: Date
}

// Add a video to the deleted list
export function addToDeletedVideos(videoId: string): void {
  try {
    const deletedVideos = getDeletedVideos()
    
    // Check if already in list
    if (deletedVideos.some(v => v.videoId === videoId)) {
      return
    }
    
    deletedVideos.push({
      videoId,
      deletedAt: new Date()
    })
    
    // Keep only last 100 deleted videos
    const recentDeleted = deletedVideos
      .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
      .slice(0, 100)
    
    localStorage.setItem(DELETED_VIDEOS_KEY, JSON.stringify(recentDeleted))
  } catch (error) {
    console.error('Failed to track deleted video:', error)
  }
}

// Get list of deleted video IDs
export function getDeletedVideos(): DeletedVideoRecord[] {
  try {
    const json = localStorage.getItem(DELETED_VIDEOS_KEY)
    if (!json) return []
    
    const records = JSON.parse(json)
    // Convert date strings back to Date objects
    return records.map((r: any) => ({
      ...r,
      deletedAt: new Date(r.deletedAt)
    }))
  } catch (error) {
    console.error('Failed to load deleted videos list:', error)
    return []
  }
}

// Check if a video was deleted
export function isVideoDeleted(videoId: string): boolean {
  const deletedVideos = getDeletedVideos()
  return deletedVideos.some(v => v.videoId === videoId)
}

// Filter out deleted videos from a list
export function filterOutDeletedVideos(videos: any[]): any[] {
  const deletedIds = new Set(getDeletedVideos().map(v => v.videoId))
  return videos.filter(video => !deletedIds.has(video.id))
}

// Clear old deleted video records (older than 7 days)
export function cleanupDeletedVideos(): void {
  try {
    const deletedVideos = getDeletedVideos()
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const recentDeleted = deletedVideos.filter(
      v => new Date(v.deletedAt) > oneWeekAgo
    )
    
    localStorage.setItem(DELETED_VIDEOS_KEY, JSON.stringify(recentDeleted))
  } catch (error) {
    console.error('Failed to cleanup deleted videos:', error)
  }
}