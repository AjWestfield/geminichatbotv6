import { supabase, isPersistenceConfigured } from '@/lib/database/supabase'
import { uploadImageToBlob, deleteImageFromBlob } from '@/lib/storage/blob-storage'

export interface FileReference {
  id: string
  file_url: string
  file_type: 'image' | 'video' | 'audio' | 'document'
  file_size?: number
  content_type?: string
  original_name?: string
  chat_id?: string
  message_id?: string
  user_id?: string
  reference_count: number
  last_accessed_at: Date
  storage_location?: 'blob' | 'gemini' | 'external'
  metadata?: any
  created_at: Date
  updated_at: Date
}

export interface UserStorageQuota {
  id: string
  user_id?: string
  storage_used: number
  storage_limit: number
  file_count: number
  file_count_limit: number
  last_cleanup_at?: Date
  metadata?: any
  created_at: Date
  updated_at: Date
}

// Track file usage
export async function trackFileUsage(
  fileUrl: string,
  fileType: 'image' | 'video' | 'audio' | 'document',
  options?: {
    chatId?: string
    messageId?: string
    userId?: string
    fileSize?: number
    contentType?: string
    originalName?: string
    storageLocation?: 'blob' | 'gemini' | 'external'
  }
): Promise<string | null> {
  if (!isPersistenceConfigured() || !supabase) {
    console.log('[FILE MANAGER] Persistence not configured')
    return null
  }

  try {
    console.log('[FILE MANAGER] Tracking file usage:', { fileUrl, fileType, ...options })

    // Call the database function to track file usage
    const { data, error } = await supabase.rpc('track_file_usage', {
      p_file_url: fileUrl,
      p_file_type: fileType,
      p_chat_id: options?.chatId || null,
      p_message_id: options?.messageId || null,
      p_user_id: options?.userId || null,
      p_file_size: options?.fileSize || null,
      p_content_type: options?.contentType || null,
      p_original_name: options?.originalName || null
    })

    if (error) throw error
    
    console.log('[FILE MANAGER] File tracked successfully:', data)
    return data
  } catch (error: any) {
    console.error('[FILE MANAGER] Error tracking file usage:', error)
    return null
  }
}

// Get files for a specific chat
export async function getFilesForChat(chatId: string): Promise<FileReference[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('file_references')
      .select('*')
      .eq('chat_id', chatId)
      .order('last_accessed_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error: any) {
    console.error('[FILE MANAGER] Error fetching chat files:', error)
    return []
  }
}

// Get user storage usage
export async function getUserStorageUsage(userId?: string): Promise<UserStorageQuota | null> {
  if (!isPersistenceConfigured() || !supabase || !userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('user_storage_quotas')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
      throw error
    }

    // If no quota exists, return default values
    if (!data) {
      return {
        id: '',
        user_id: userId,
        storage_used: 0,
        storage_limit: 1073741824, // 1GB
        file_count: 0,
        file_count_limit: 1000,
        created_at: new Date(),
        updated_at: new Date()
      }
    }

    return data
  } catch (error: any) {
    console.error('[FILE MANAGER] Error fetching user storage usage:', error)
    return null
  }
}

// Update file access time
export async function updateFileAccessTime(fileUrl: string): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    return false
  }

  try {
    const { error } = await supabase
      .from('file_references')
      .update({ 
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('file_url', fileUrl)

    if (error) throw error
    return true
  } catch (error: any) {
    console.error('[FILE MANAGER] Error updating file access time:', error)
    return false
  }
}

// Cleanup orphaned files
export async function cleanupOrphanedFiles(dryRun = true): Promise<{
  orphanedFiles: FileReference[]
  deletedCount: number
  freedSpace: number
}> {
  if (!isPersistenceConfigured() || !supabase) {
    return { orphanedFiles: [], deletedCount: 0, freedSpace: 0 }
  }

  try {
    console.log('[FILE MANAGER] Starting orphaned file cleanup (dryRun:', dryRun, ')')

    // Find files with no references (reference_count = 0)
    const { data: orphanedFiles, error } = await supabase
      .from('file_references')
      .select('*')
      .eq('reference_count', 0)
      .order('last_accessed_at', { ascending: true })

    if (error) throw error

    const result = {
      orphanedFiles: orphanedFiles || [],
      deletedCount: 0,
      freedSpace: 0
    }

    if (!dryRun && orphanedFiles && orphanedFiles.length > 0) {
      console.log('[FILE MANAGER] Found', orphanedFiles.length, 'orphaned files to delete')

      for (const file of orphanedFiles) {
        try {
          // Delete from blob storage if it's stored there
          if (file.storage_location === 'blob' && file.file_url) {
            await deleteImageFromBlob(file.file_url)
          }

          // Delete from database
          const { error: deleteError } = await supabase
            .from('file_references')
            .delete()
            .eq('id', file.id)

          if (!deleteError) {
            result.deletedCount++
            result.freedSpace += file.file_size || 0
          }
        } catch (err) {
          console.error('[FILE MANAGER] Error deleting orphaned file:', file.id, err)
        }
      }

      console.log('[FILE MANAGER] Deleted', result.deletedCount, 'files, freed', result.freedSpace, 'bytes')
    }

    return result
  } catch (error: any) {
    console.error('[FILE MANAGER] Error cleaning up orphaned files:', error)
    return { orphanedFiles: [], deletedCount: 0, freedSpace: 0 }
  }
}

// Clean up old files based on retention policy
export async function cleanupOldFiles(daysToKeep: number, dryRun = true): Promise<{
  oldFiles: FileReference[]
  deletedCount: number
  freedSpace: number
}> {
  if (!isPersistenceConfigured() || !supabase) {
    return { oldFiles: [], deletedCount: 0, freedSpace: 0 }
  }

  try {
    console.log('[FILE MANAGER] Starting old file cleanup (daysToKeep:', daysToKeep, ', dryRun:', dryRun, ')')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Find files not accessed in the specified period
    const { data: oldFiles, error } = await supabase
      .from('file_references')
      .select('*')
      .lt('last_accessed_at', cutoffDate.toISOString())
      .order('last_accessed_at', { ascending: true })

    if (error) throw error

    const result = {
      oldFiles: oldFiles || [],
      deletedCount: 0,
      freedSpace: 0
    }

    if (!dryRun && oldFiles && oldFiles.length > 0) {
      console.log('[FILE MANAGER] Found', oldFiles.length, 'old files to delete')

      for (const file of oldFiles) {
        try {
          // Delete from blob storage if it's stored there
          if (file.storage_location === 'blob' && file.file_url) {
            await deleteImageFromBlob(file.file_url)
          }

          // Delete from database
          const { error: deleteError } = await supabase
            .from('file_references')
            .delete()
            .eq('id', file.id)

          if (!deleteError) {
            result.deletedCount++
            result.freedSpace += file.file_size || 0

            // Update user quota if user_id exists
            if (file.user_id && file.file_size) {
              await supabase
                .from('user_storage_quotas')
                .update({
                  storage_used: supabase.raw('storage_used - ?', [file.file_size]),
                  file_count: supabase.raw('file_count - 1'),
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', file.user_id)
            }
          }
        } catch (err) {
          console.error('[FILE MANAGER] Error deleting old file:', file.id, err)
        }
      }

      console.log('[FILE MANAGER] Deleted', result.deletedCount, 'files, freed', result.freedSpace, 'bytes')
    }

    return result
  } catch (error: any) {
    console.error('[FILE MANAGER] Error cleaning up old files:', error)
    return { oldFiles: [], deletedCount: 0, freedSpace: 0 }
  }
}

// Check if user can upload a file
export async function canUserUploadFile(
  userId?: string,
  fileSize?: number
): Promise<{ allowed: boolean; reason?: string; quota?: UserStorageQuota }> {
  if (!isPersistenceConfigured() || !userId) {
    return { allowed: true } // Allow if no persistence or user tracking
  }

  try {
    const quota = await getUserStorageUsage(userId)
    if (!quota) {
      return { allowed: true }
    }

    // Check file count limit
    if (quota.file_count >= quota.file_count_limit) {
      return {
        allowed: false,
        reason: `File count limit reached (${quota.file_count}/${quota.file_count_limit})`,
        quota
      }
    }

    // Check storage limit if file size is provided
    if (fileSize && (quota.storage_used + fileSize) > quota.storage_limit) {
      const usedGB = (quota.storage_used / 1073741824).toFixed(2)
      const limitGB = (quota.storage_limit / 1073741824).toFixed(2)
      return {
        allowed: false,
        reason: `Storage limit would be exceeded (${usedGB}GB/${limitGB}GB)`,
        quota
      }
    }

    return { allowed: true, quota }
  } catch (error: any) {
    console.error('[FILE MANAGER] Error checking upload permission:', error)
    return { allowed: true } // Allow on error to not block user
  }
}

// Get storage statistics
export async function getStorageStatistics(): Promise<{
  totalFiles: number
  totalStorage: number
  filesByType: Record<string, number>
  storageByType: Record<string, number>
  averageFileSize: number
  oldestFile?: FileReference
  largestFile?: FileReference
} | null> {
  if (!isPersistenceConfigured() || !supabase) {
    return null
  }

  try {
    // Get all file references
    const { data: files, error } = await supabase
      .from('file_references')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!files || files.length === 0) {
      return {
        totalFiles: 0,
        totalStorage: 0,
        filesByType: {},
        storageByType: {},
        averageFileSize: 0
      }
    }

    // Calculate statistics
    let totalStorage = 0
    const filesByType: Record<string, number> = {}
    const storageByType: Record<string, number> = {}

    files.forEach(file => {
      // Count files by type
      filesByType[file.file_type] = (filesByType[file.file_type] || 0) + 1

      // Sum storage by type
      if (file.file_size) {
        totalStorage += file.file_size
        storageByType[file.file_type] = (storageByType[file.file_type] || 0) + file.file_size
      }
    })

    // Find oldest and largest files
    const oldestFile = files[0]
    const largestFile = files.reduce((largest, file) => 
      (file.file_size || 0) > (largest.file_size || 0) ? file : largest
    , files[0])

    return {
      totalFiles: files.length,
      totalStorage,
      filesByType,
      storageByType,
      averageFileSize: totalStorage / files.length,
      oldestFile,
      largestFile
    }
  } catch (error: any) {
    console.error('[FILE MANAGER] Error getting storage statistics:', error)
    return null
  }
}