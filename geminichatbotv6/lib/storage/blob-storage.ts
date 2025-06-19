import { put, del, list } from '@vercel/blob'

// Check if blob storage is configured
const isBlobConfigured = () => {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

// Helper to upload image to blob storage
export async function uploadImageToBlob(
  imageUrl: string,
  filename: string
): Promise<string> {
  if (!isBlobConfigured()) {
    console.log('Blob storage not configured - returning original URL')
    return imageUrl
  }

  try {
    console.log('[BLOB] Starting upload for:', filename)
    console.log('[BLOB] URL type:', imageUrl.startsWith('data:') ? 'data URL' : 'external URL')
    
    // If it's already a blob URL, return it
    if (imageUrl.startsWith('https://') && imageUrl.includes('.blob.vercel-storage.com')) {
      console.log('[BLOB] Already a blob URL, returning as-is')
      return imageUrl
    }

    // Handle data URLs
    if (imageUrl.startsWith('data:')) {
      console.log('[BLOB] Processing data URL')
      
      // Extract MIME type from data URL
      const mimeMatch = imageUrl.match(/^data:([^;]+);/)
      const contentType = mimeMatch ? mimeMatch[1] : 'image/png'
      console.log('[BLOB] Detected content type:', contentType)
      
      const base64Data = imageUrl.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      console.log('[BLOB] Buffer size:', buffer.length)
      
      const blob = await put(`images/${filename}`, buffer, {
        access: 'public',
        contentType: contentType,
      })
      
      console.log('[BLOB] Upload successful:', blob.url)
      return blob.url
    }

    // Handle external URLs - download and re-upload
    console.log('[BLOB] Fetching external URL')
    const response = await fetch(imageUrl)
    
    // Check if the response is valid
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    
    const buffer = await response.arrayBuffer()
    console.log('[BLOB] Downloaded buffer size:', buffer.byteLength)
    
    // Validate the response content
    const contentType = response.headers.get('content-type') || ''
    
    // Check for error responses
    if (buffer.byteLength < 100) {
      // Small response, might be an error
      const text = new TextDecoder().decode(buffer)
      console.error('[BLOB] Suspiciously small response:', text)
      
      // Check if it's a JSON error
      if (text.includes('"detail"') || text.includes('"error"')) {
        throw new Error(`Image generation failed: ${text}`)
      }
    }
    
    // Validate content type
    if (!contentType.startsWith('image/')) {
      const text = new TextDecoder().decode(buffer.slice(0, 200))
      console.error('[BLOB] Invalid content type:', contentType)
      console.error('[BLOB] Response preview:', text)
      throw new Error(`Invalid image response: expected image, got ${contentType}`)
    }
    
    const blob = await put(`images/${filename}`, buffer, {
      access: 'public',
      contentType: contentType || 'image/png',
    })
    
    console.log('[BLOB] Upload successful:', blob.url)
    return blob.url
  } catch (error) {
    console.error('[BLOB] Error uploading to blob storage:', error)
    console.error('[BLOB] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Return original URL as fallback
    return imageUrl
  }
}

// Helper to delete image from blob storage
export async function deleteImageFromBlob(url: string): Promise<void> {
  if (!isBlobConfigured()) {
    return
  }

  try {
    if (url.includes('.blob.vercel-storage.com')) {
      await del(url)
    }
  } catch (error) {
    console.error('Error deleting from blob storage:', error)
  }
}

// List all images in blob storage
export async function listImagesInBlob() {
  if (!isBlobConfigured()) {
    return []
  }

  try {
    const { blobs } = await list({
      prefix: 'images/',
    })
    return blobs
  } catch (error) {
    console.error('Error listing blob storage:', error)
    return []
  }
}