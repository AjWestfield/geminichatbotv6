/**
 * Image URL validation and handling utilities for expired Replicate URLs
 */

/**
 * Check if an image URL is accessible
 */
export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch (error) {
    console.error('[validateImageUrl] Error checking URL:', error)
    return false
  }
}

/**
 * Download image and convert to data URL for use with Replicate
 */
export async function downloadImageAsDataUrl(url: string): Promise<string> {
  try {
    console.log('[downloadImageAsDataUrl] Downloading image from:', url)
    
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    
    const blob = await response.blob()
    
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        console.log('[downloadImageAsDataUrl] Converted to data URL, size:', Math.round(result.length / 1024), 'KB')
        resolve(result)
      }
      reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('[downloadImageAsDataUrl] Error:', error)
    throw error
  }
}

/**
 * Handle potentially expired Replicate URLs
 * Returns a valid URL that Replicate can access, or throws an error
 */
export async function ensureImageUrlAccessible(url: string): Promise<string> {
  console.log('[ensureImageUrlAccessible] Checking URL:', url)
  
  // Check if URL is accessible
  const isAccessible = await validateImageUrl(url)
  
  if (isAccessible) {
    console.log('[ensureImageUrlAccessible] URL is accessible')
    return url
  }
  
  console.log('[ensureImageUrlAccessible] URL not accessible, attempting to download and convert')
  
  // If URL is not accessible, try to download it and convert to data URL
  try {
    const dataUrl = await downloadImageAsDataUrl(url)
    return dataUrl
  } catch (error) {
    console.error('[ensureImageUrlAccessible] Direct download failed, trying server-side conversion:', error)
    
    // Try server-side proxy as fallback
    try {
      const response = await fetch('/api/image-proxy/convert-to-data-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url })
      })
      
      if (response.ok) {
        const { dataUrl } = await response.json()
        console.log('[ensureImageUrlAccessible] Server-side conversion successful')
        return dataUrl
      }
    } catch (proxyError) {
      console.error('[ensureImageUrlAccessible] Server-side conversion also failed:', proxyError)
    }
    
    throw new Error('Image URL has expired and could not be recovered. Please try editing a more recent image.')
  }
}

/**
 * Check if URL is a Replicate delivery URL that might expire
 */
export function isReplicateDeliveryUrl(url: string): boolean {
  return url.includes('replicate.delivery')
}

/**
 * Estimate if a Replicate URL might be expired based on its age
 * This is a heuristic and not 100% accurate
 */
export function isLikelyExpiredReplicateUrl(url: string, imageTimestamp?: Date): boolean {
  if (!isReplicateDeliveryUrl(url)) {
    return false
  }
  
  if (!imageTimestamp) {
    return false
  }
  
  const ageInHours = (Date.now() - imageTimestamp.getTime()) / (1000 * 60 * 60)
  return ageInHours > 24 // Replicate URLs expire after 24 hours
}