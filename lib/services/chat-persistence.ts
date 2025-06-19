import { supabase, isPersistenceConfigured, Chat, Message, StoredImage, StoredVideo, ChatSummary } from '@/lib/database/supabase'
import { uploadImageToBlob } from '@/lib/storage/blob-storage'
import { GeneratedImage } from '@/lib/image-utils'
import { GeneratedVideo } from '@/lib/video-generation-types'

// Create a new chat
export async function createChat(title: string, model: string): Promise<Chat | null> {
  if (!isPersistenceConfigured() || !supabase) {
    console.log('Persistence not configured - chat creation skipped')
    return null
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .insert({
        title,
        model,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    // Only log if it's not a connection error (which is expected when not configured)
    if (!error.message?.includes('fetch failed')) {
      console.error('Error creating chat:', error)
    }
    return null
  }
}

// Get all chats (for sidebar)
export async function getChats(limit = 50): Promise<ChatSummary[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error (which is expected when not configured)
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching chats:', error)
    }
    return []
  }
}

// Get a single chat with messages, images, videos, and canvas state
export async function getChat(chatId: string): Promise<{ 
  chat: Chat; 
  messages: Message[]; 
  images?: StoredImage[];
  videos?: StoredVideo[];
  canvasState?: any;
} | null> {
  if (!isPersistenceConfigured() || !supabase) {
    return null
  }

  try {
    // Get chat with canvas_state
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single()

    if (chatError) throw chatError

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (messagesError) throw messagesError

    // Get images
    const { data: images, error: imagesError } = await supabase
      .from('images')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (imagesError) {
      console.warn('Error fetching images:', imagesError)
    }

    // Get videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (videosError) {
      console.warn('Error fetching videos:', videosError)
    }

    return { 
      chat, 
      messages: messages || [], 
      images: images || [],
      videos: videos || [],
      canvasState: (chat as any).canvas_state || {}
    }
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching chat:', error)
    }
    return null
  }
}

// Add a message to a chat
export async function addMessage(
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  attachments?: any[]
): Promise<Message | null> {
  if (!isPersistenceConfigured() || !supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role,
        content,
        attachments: attachments || [],
      })
      .select()
      .single()

    if (error) throw error

    // Update chat's updated_at
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)

    return data
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error adding message:', error)
    }
    return null
  }
}

// Update chat title
export async function updateChatTitle(chatId: string, title: string): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    return false
  }

  try {
    const { error } = await supabase
      .from('chats')
      .update({ title })
      .eq('id', chatId)

    if (error) throw error
    return true
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error updating chat title:', error)
    }
    return false
  }
}

// Update canvas state for a chat
export async function updateCanvasState(chatId: string, canvasState: any): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    return false
  }

  try {
    console.log('[UPDATE CANVAS STATE] Updating for chat:', chatId, canvasState)
    
    const { error } = await supabase
      .from('chats')
      .update({ 
        canvas_state: canvasState,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)

    if (error) throw error
    
    console.log('[UPDATE CANVAS STATE] Successfully updated')
    return true
  } catch (error: any) {
    console.error('[UPDATE CANVAS STATE] Error:', error)
    return false
  }
}

// Get canvas state for a chat
export async function getCanvasState(chatId: string): Promise<any | null> {
  if (!isPersistenceConfigured() || !supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('canvas_state')
      .eq('id', chatId)
      .single()

    if (error) throw error
    
    return data?.canvas_state || {}
  } catch (error: any) {
    console.error('[GET CANVAS STATE] Error:', error)
    return null
  }
}

// Delete a chat
export async function deleteChat(chatId: string): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    return false
  }

  try {
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)

    if (error) throw error
    return true
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error deleting chat:', error)
    }
    return false
  }
}

// Save image to database and blob storage
export async function saveImage(
  image: GeneratedImage,
  chatId?: string,
  messageId?: string
): Promise<StoredImage | null> {
  if (!isPersistenceConfigured() || !supabase) {
    console.log('[SAVE IMAGE] Persistence not configured')
    return null
  }
  
  console.log('[SAVE IMAGE] Starting save for image:', {
    id: image.id,
    model: image.model,
    isUploaded: image.isUploaded,
    prompt: image.prompt,
    urlType: image.url.startsWith('data:') ? 'data URL' : 'external URL',
    chatId: chatId
  })
  
  try {
    // Upload to blob storage first
    const extension = image.isUploaded ? 'png' : 'png' // Keep as PNG for uploaded images
    const filename = `${image.id}-${Date.now()}.${extension}`
    console.log('[SAVE IMAGE] Uploading to blob storage with filename:', filename)
    console.log('[SAVE IMAGE] Image type:', image.isUploaded ? 'uploaded' : 'generated')
    const blobUrl = await uploadImageToBlob(image.url, filename)
    console.log('[SAVE IMAGE] Blob storage upload result:', blobUrl)

    // Save to database
    const insertData: any = {
      chat_id: chatId,
      message_id: messageId,
      url: blobUrl,
      prompt: image.prompt,
      revised_prompt: image.revisedPrompt,
      quality: image.quality,
      style: image.style,
      size: image.size,
      model: image.model,
      is_uploaded: image.isUploaded || false,
      metadata: {
        localId: image.id,
        timestamp: image.timestamp,
        geminiUri: image.geminiUri, // Preserve Gemini URI for uploaded images
        originalImageId: image.originalImageId, // Store in metadata as backup
        isMultiImageEdit: image.isMultiImageEdit, // Preserve multi-edit flag
        sourceImages: image.sourceImages, // Array of source image IDs
        inputImages: image.inputImages, // Array of source image URLs
      },
    }
    
    // Only include original_image_id if it's a valid UUID or the column accepts TEXT
    // This is a temporary workaround for the UUID type issue
    if (image.originalImageId) {
      // Check if it looks like a UUID (basic check)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(image.originalImageId)
      if (isUUID) {
        insertData.original_image_id = image.originalImageId
      } else {
        // For local IDs, skip the field but store in metadata
        console.log('[SAVE IMAGE] Skipping original_image_id field for local ID:', image.originalImageId)
      }
    }
    
    console.log('[SAVE IMAGE] Inserting to database:', insertData)
    
    const { data, error } = await supabase
      .from('images')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[SAVE IMAGE] Database insert error:', error)
      throw error
    }
    
    console.log('[SAVE IMAGE] Successfully saved to database:', data)
    
    // Handle multi-image source relationships
    if (image.isMultiImageEdit && image.sourceImages && image.sourceImages.length > 0) {
      console.log('[SAVE IMAGE] Saving source image relationships for multi-image edit')
      
      // Process source images - handle both IDs and direct image data
      const sourceImagePromises = image.sourceImages.map(async (sourceIdOrImage, index) => {
        let sourceImageDbId: string | null = null
        
        // Check if this is already a database ID
        const existingImage = await getImageByLocalId(sourceIdOrImage)
        
        if (existingImage) {
          sourceImageDbId = existingImage.id
          console.log(`[SAVE IMAGE] Found existing source image in database: ${sourceIdOrImage}`)
        } else if (image.inputImages && image.inputImages[index]) {
          // Try to save the source image from inputImages URLs
          console.log(`[SAVE IMAGE] Source image ${sourceIdOrImage} not in database, attempting to save from URL`)
          
          const sourceUrl = image.inputImages[index]
          if (sourceUrl && typeof sourceUrl === 'string') {
            // Create a temporary GeneratedImage object for the source
            const tempSourceImage: GeneratedImage = {
              id: sourceIdOrImage,
              url: sourceUrl,
              prompt: `Source image ${index + 1} for multi-edit`,
              timestamp: new Date(),
              quality: 'hd',
              model: 'unknown',
              size: '1024x1024',
              isGenerating: false,
              isUploaded: true
            }
            
            // Save the source image
            const savedSource = await saveImage(tempSourceImage, chatId)
            if (savedSource) {
              sourceImageDbId = savedSource.id
              console.log(`[SAVE IMAGE] Successfully saved source image ${sourceIdOrImage} to database`)
            }
          }
        }
        
        if (!sourceImageDbId) {
          console.log(`[SAVE IMAGE] Could not save or find source image ${sourceIdOrImage}, skipping relationship`)
          return null
        }
        
        return {
          edited_image_id: data.id,
          source_image_id: sourceImageDbId,
          source_order: index
        }
      })
      
      const sourceRelations = (await Promise.all(sourceImagePromises)).filter(Boolean)
      
      if (sourceRelations.length > 0) {
        const { error: relationError } = await supabase
          .from('image_source_relations')
          .insert(sourceRelations)
        
        if (relationError) {
          console.error('[SAVE IMAGE] Error saving source image relationships:', relationError)
          // Don't fail the main save operation if relationships fail
        } else {
          console.log(`[SAVE IMAGE] Successfully saved ${sourceRelations.length} source image relationships`)
        }
      }
    }
    
    return data
  } catch (error: any) {
    // Log all errors for debugging
    console.error('[SAVE IMAGE] Error saving image:', error)
    console.error('[SAVE IMAGE] Error details:', {
      message: error.message || 'Unknown error',
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return null
  }
}

// Get images for a chat
export async function getChatImages(chatId: string): Promise<StoredImage[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching chat images:', error)
    }
    return []
  }
}

// Get all images (for gallery)
export async function getAllImages(limit = 100): Promise<StoredImage[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching all images:', error)
    }
    return []
  }
}

// Get a single image by its local ID (from metadata)
export async function getImageByLocalId(localId: string): Promise<StoredImage | null> {
  if (!isPersistenceConfigured() || !supabase) {
    return null
  }

  try {
    console.log('[GET IMAGE BY LOCAL ID] Searching for:', localId)
    
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('metadata->>localId', localId)
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('[GET IMAGE BY LOCAL ID] Image not found')
        return null
      }
      throw error
    }
    
    console.log('[GET IMAGE BY LOCAL ID] Found image:', data?.id)
    return data
  } catch (error: any) {
    console.error('[GET IMAGE BY LOCAL ID] Error:', error)
    return null
  }
}

// Delete an image
export async function deleteImage(imageId: string): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    console.log('[DELETE IMAGE] Persistence not configured')
    return false
  }

  try {
    console.log('[DELETE IMAGE] Attempting to delete image:', imageId)
    
    // Check if the imageId is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId)
    
    let image: any = null
    let fetchError: any = null
    
    if (isUUID) {
      // Try to find by UUID
      const result = await supabase
        .from('images')
        .select('id, url')
        .eq('id', imageId)
        .single()
      
      image = result.data
      fetchError = result.error
    } else {
      // Skip UUID search and force metadata search for non-UUID IDs
      fetchError = { code: 'PGRST116' } // Simulate not found error
    }

    // If not found by UUID, try to find by local ID in metadata
    if (fetchError && fetchError.code === 'PGRST116') {
      console.log('[DELETE IMAGE] Not found by UUID, trying by local ID in metadata')
      const { data: images, error: searchError } = await supabase
        .from('images')
        .select('id, url, metadata')
        .eq('metadata->>localId', imageId)
        .limit(1)
      
      if (searchError) throw searchError
      
      if (images && images.length > 0) {
        image = images[0]
        console.log('[DELETE IMAGE] Found image by local ID, database ID:', image.id)
      } else {
        throw new Error('Image not found')
      }
    } else if (fetchError) {
      throw fetchError
    }

    if (!image) {
      console.error('[DELETE IMAGE] Image not found:', imageId)
      return false
    }

    // Delete from database using the actual database ID
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', image.id)

    if (error) throw error

    console.log('[DELETE IMAGE] Successfully deleted from database:', image.id)

    // Delete from blob storage (fire and forget)
    if (image.url) {
      import('@/lib/storage/blob-storage').then(({ deleteImageFromBlob }) => {
        deleteImageFromBlob(image.url).catch(err => 
          console.error('[DELETE IMAGE] Failed to delete from blob storage:', err)
        )
      })
    }

    return true
  } catch (error: any) {
    console.error('[DELETE IMAGE] Error deleting image:', error)
    return false
  }
}

// Search chats (searches both titles and message content)
export async function searchChats(query: string): Promise<ChatSummary[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    // Try to use the enhanced search function if available
    const { data: enhancedResults, error: enhancedError } = await supabase
      .rpc('search_chats_with_content', { search_query: query })
      
    if (!enhancedError && enhancedResults) {
      // Convert to ChatSummary format
      return enhancedResults.map((result: any) => ({
        id: result.id,
        title: result.title,
        model: result.model,
        created_at: result.created_at,
        updated_at: result.updated_at,
        user_id: result.user_id,
        message_count: result.message_count,
        image_count: result.image_count,
        video_count: result.video_count,
        last_message_at: result.last_message_at
      }))
    }
    
    // Fallback to simple title search if function doesn't exist
    console.log('Enhanced search not available, using title search only')
    const { data, error } = await supabase
      .from('chat_summaries')
      .select('*')
      .or(`title.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error searching chats:', error)
    }
    return []
  }
}

// Save video to database
export async function saveVideo(
  video: GeneratedVideo,
  chatId?: string,
  messageId?: string
): Promise<StoredVideo | null> {
  if (!isPersistenceConfigured() || !supabase) {
    console.log('[SAVE VIDEO] Persistence not configured')
    return null
  }
  
  console.log('[SAVE VIDEO] Starting save for video:', {
    id: video.id,
    model: video.model,
    status: video.status,
    prompt: video.prompt,
    duration: video.duration,
    chatId: chatId
  })
  
  try {
    // Calculate final elapsed time if completed
    let finalElapsedTime: number | undefined
    if (video.status === 'completed' && video.createdAt && video.completedAt) {
      // Ensure dates are Date objects
      const createdAt = video.createdAt instanceof Date ? video.createdAt : new Date(video.createdAt)
      const completedAt = video.completedAt instanceof Date ? video.completedAt : new Date(video.completedAt)
      finalElapsedTime = Math.floor((completedAt.getTime() - createdAt.getTime()) / 1000)
    }

    // Save to database
    const insertData = {
      chat_id: chatId,
      message_id: messageId,
      url: video.url,
      thumbnail_url: video.thumbnailUrl,
      prompt: video.prompt,
      duration: video.duration,
      aspect_ratio: video.aspectRatio,
      model: video.model,
      source_image_url: video.sourceImage,
      status: video.status,
      final_elapsed_time: finalElapsedTime || video.finalElapsedTime,
      error_message: video.error,
      completed_at: video.completedAt ? 
        (video.completedAt instanceof Date ? video.completedAt.toISOString() : new Date(video.completedAt).toISOString()) : 
        undefined,
      metadata: {
        localId: video.id,
        timestamp: video.createdAt,
      },
    }
    
    console.log('[SAVE VIDEO] Inserting to database:', insertData)
    
    const { data, error } = await supabase
      .from('videos')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[SAVE VIDEO] Database insert error:', error)
      throw error
    }
    
    console.log('[SAVE VIDEO] Successfully saved to database:', data)
    return data
  } catch (error: any) {
    // Log all errors for debugging
    console.error('[SAVE VIDEO] Error saving video:', error)
    console.error('[SAVE VIDEO] Error details:', {
      message: error.message || 'Unknown error',
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    return null
  }
}

// Get videos for a chat
export async function getChatVideos(chatId: string): Promise<StoredVideo[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching chat videos:', error)
    }
    return []
  }
}

// Get all videos (for gallery)
export async function getAllVideos(limit = 100): Promise<StoredVideo[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error fetching all videos:', error)
    }
    return []
  }
}

// Delete a video
export async function deleteVideo(videoId: string): Promise<boolean> {
  if (!isPersistenceConfigured() || !supabase) {
    return false
  }

  try {
    // Get video URL first for cleanup
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('url')
      .eq('id', videoId)
      .single()

    if (fetchError) throw fetchError

    // Delete from database
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId)

    if (error) throw error

    // Note: Videos are typically hosted on external services (like Replicate)
    // so we don't need to delete from blob storage like we do with images

    return true
  } catch (error: any) {
    // Only log if it's not a connection error
    if (!error.message?.includes('fetch failed')) {
      console.error('Error deleting video:', error)
    }
    return false
  }
}

// Get source images for a multi-image edit
export async function getSourceImagesForEdit(editedImageId: string): Promise<StoredImage[]> {
  if (!isPersistenceConfigured() || !supabase) {
    return []
  }

  try {
    console.log('[GET SOURCE IMAGES] Fetching source images for:', editedImageId)
    
    // First get the database ID if we're given a local ID
    let dbImageId = editedImageId
    
    // Check if it's a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editedImageId)
    if (!isUUID) {
      // Try to find by local ID
      const editedImage = await getImageByLocalId(editedImageId)
      if (!editedImage) {
        console.log('[GET SOURCE IMAGES] Edited image not found by local ID')
        return []
      }
      dbImageId = editedImage.id
    }
    
    // Use the RPC function to get source images
    const { data, error } = await supabase
      .rpc('get_source_images', { edited_id: dbImageId })
    
    if (error) {
      console.error('[GET SOURCE IMAGES] Error fetching source images:', error)
      return []
    }
    
    console.log(`[GET SOURCE IMAGES] Found ${data?.length || 0} source images`)
    
    // Convert the RPC result to StoredImage format
    if (!data || data.length === 0) return []
    
    // Fetch full image data for each source
    const sourceImageIds = data.map((d: any) => d.image_id)
    const { data: fullImages, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .in('id', sourceImageIds)
    
    if (fetchError) {
      console.error('[GET SOURCE IMAGES] Error fetching full image data:', fetchError)
      return []
    }
    
    // Sort by source_order
    const orderedImages = data.map((sourceData: any) => {
      const fullImage = fullImages.find((img: any) => img.id === sourceData.image_id)
      return fullImage
    }).filter(Boolean)
    
    return orderedImages
  } catch (error: any) {
    console.error('[GET SOURCE IMAGES] Error:', error)
    return []
  }
}