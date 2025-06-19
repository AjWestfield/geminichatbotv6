/**
 * Image generation and management utilities
 * Client-side only utilities - server-side functions moved to server-image-utils.ts
 */

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  revisedPrompt?: string
  timestamp: Date
  quality: 'standard' | 'hd' | 'wavespeed'
  style?: 'vivid' | 'natural'
  size?: string
  model: string
  originalImageId?: string // For edited images, reference to the original
  editStrength?: number // Strength used for editing (0.0-1.0)
  isGenerating?: boolean // Track if image is currently being generated
  generationStartTime?: Date // When generation started
  urlAvailableTime?: Date // When URL became available for reveal animation
  isUploaded?: boolean // Track if this is an uploaded image
  geminiUri?: string // Store Gemini URI for uploaded images
  isMultiImageEdit?: boolean // Track if this is a multi-image edit
  sourceImages?: string[] // Array of source image IDs used for multi-image edits
  inputImages?: string[] // Array of source image URLs used for multi-image edits
  metadata?: any // Additional metadata from the generation process
  isUpscaled?: boolean // Track if this is an upscaled image
  upscaleSettings?: {
    factor: 'None' | '2x' | '4x' | '6x'
    model: 'Standard V2' | 'Low Resolution V2' | 'CGI' | 'High Fidelity V2' | 'Text Refine'
    subjectDetection?: 'None' | 'All' | 'Foreground' | 'Background'
    faceEnhancement?: boolean
    faceEnhancementCreativity?: number
    faceEnhancementStrength?: number
    sourceImageId: string
    outputMegapixels?: number
    cost?: number
  }
}

/**
 * Generate a unique ID for an image with high precision
 */
export function generateImageId(): string {
  // Use high precision timestamp and multiple random components to ensure uniqueness
  const timestamp = Date.now()
  const random1 = Math.random().toString(36).substring(2, 11)
  const random2 = Math.random().toString(36).substring(2, 6)
  const performance = typeof window !== 'undefined' && window.performance
    ? Math.floor(window.performance.now() * 1000).toString(36)
    : Math.random().toString(36).substring(2, 6)
  return `img_${timestamp}_${random1}${random2}${performance}`
}

/**
 * Download an image from URL
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // Clean up
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100)
  } catch (error) {
    console.error('Failed to download image:', error)
    throw new Error('Failed to download image')
  }
}

/**
 * Convert image URL to base64 (for persistence)
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Failed to convert image to base64:', error)
    throw error
  }
}

/**
 * Get quality badge color
 */
export function getQualityBadgeColor(quality: string): string {
  switch (quality) {
    case 'hd':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'standard':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

/**
 * Calculate approximate size of data in bytes
 */
function calculateDataSize(data: any): number {
  return new Blob([JSON.stringify(data)]).size
}

/**
 * Clear old images from storage to make room
 */
function clearOldImages(): void {
  try {
    // Clear all image-related storage
    const keysToRemove = ['generatedImages', 'imageCache']
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.error(`Failed to remove ${key}:`, e)
      }
    })
    console.log('Cleared old image storage')
  } catch (error) {
    console.error('Failed to clear old images:', error)
  }
}

/**
 * Save generated images to localStorage with size management and URL validation
 */
export function saveGeneratedImages(images: GeneratedImage[]): void {
  try {
    // Only save completed images (not generating ones) and skip data URLs
    const completedImages = images.filter(img =>
      !img.isGenerating &&
      img.url &&
      !img.url.startsWith('data:') // Skip data URLs as they're too large for localStorage
    )

    // Mark potentially expired URLs for better error handling
    const imagesWithExpirationInfo = completedImages.map(img => {
      const isReplicateUrl = img.url.includes('replicate.delivery')
      const ageInHours = img.timestamp ? (Date.now() - img.timestamp.getTime()) / (1000 * 60 * 60) : 0
      const isLikelyExpired = isReplicateUrl && ageInHours > 24

      return {
        ...img,
        metadata: {
          ...img.metadata,
          isReplicateUrl,
          ageInHours: Math.round(ageInHours),
          isLikelyExpired,
          lastSaved: new Date().toISOString()
        }
      }
    })

    if (imagesWithExpirationInfo.length === 0) {
      return
    }

    // Start with most recent 30 images
    let imagesToSave = imagesWithExpirationInfo.slice(-30)

    // Convert dates to strings and minimize data
    const prepareForStorage = (imgs: GeneratedImage[]) => imgs.map(img => {
      // Safely handle timestamp conversion
      let timestampStr: string
      try {
        if (img.timestamp && img.timestamp instanceof Date && !isNaN(img.timestamp.getTime())) {
          timestampStr = img.timestamp.toISOString()
        } else {
          // Fallback to current time if timestamp is invalid
          timestampStr = new Date().toISOString()
        }
      } catch {
        timestampStr = new Date().toISOString()
      }

      return {
        id: img.id,
        // Store URL (data URLs are already filtered out above)
        url: img.url.substring(0, 500),
        prompt: img.prompt.substring(0, 200), // Limit prompt length
        timestamp: timestampStr,
        quality: img.quality,
        model: img.model,
        // Save essential fields for edited images
        originalImageId: img.originalImageId,
        isUploaded: img.isUploaded,
        geminiUri: img.geminiUri,
        // Save multi-edit specific fields
        isMultiImageEdit: img.isMultiImageEdit,
        sourceImages: img.sourceImages,
        inputImages: img.inputImages ? img.inputImages.map(url =>
          url.startsWith('data:') ? '[DATA_URL_REMOVED]' : url.substring(0, 200)
        ) : undefined,
      }
    })

    let serialized = prepareForStorage(imagesToSave)
    let dataSize = calculateDataSize(serialized)

    // If data is too large, reduce number of images
    const maxSize = 4 * 1024 * 1024 // 4MB limit (conservative)
    while (dataSize > maxSize && imagesToSave.length > 5) {
      imagesToSave = imagesToSave.slice(-Math.floor(imagesToSave.length * 0.7))
      serialized = prepareForStorage(imagesToSave)
      dataSize = calculateDataSize(serialized)
    }

    try {
      localStorage.setItem('generatedImages', JSON.stringify(serialized))
      console.log(`Saved ${imagesToSave.length} images (${(dataSize / 1024).toFixed(1)}KB)`)
    } catch (quotaError: any) {
      console.warn('localStorage quota exceeded, clearing old data...')

      // Clear old data and try again with only 10 most recent
      clearOldImages()

      const minimalImages = imagesWithExpirationInfo.slice(-10)
      const minimalSerialized = prepareForStorage(minimalImages)

      try {
        localStorage.setItem('generatedImages', JSON.stringify(minimalSerialized))
        console.log(`Saved ${minimalImages.length} most recent images after clearing storage`)
      } catch (finalError) {
        console.error('Failed to save even minimal images:', finalError)
        // Don't throw - just log the error so the app continues working
      }
    }
  } catch (error) {
    console.error('Failed to save images:', error)
    // Don't throw - gracefully handle the error
  }
}

/**
 * Load generated images from localStorage
 */
export function loadGeneratedImages(): GeneratedImage[] {
  try {
    const stored = localStorage.getItem('generatedImages')
    if (!stored) return []

    // Parse and convert date strings back to Date objects
    const parsed = JSON.parse(stored)
    return parsed
      .map((img: any) => {
        // Safely handle timestamp conversion
        let timestamp: Date
        try {
          if (img.timestamp) {
            timestamp = new Date(img.timestamp)
            // Verify the date is valid
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date()
            }
          } else {
            timestamp = new Date()
          }
        } catch {
          timestamp = new Date()
        }

        // Safely handle generationStartTime
        let generationStartTime: Date | undefined
        try {
          if (img.generationStartTime) {
            generationStartTime = new Date(img.generationStartTime)
            if (isNaN(generationStartTime.getTime())) {
              generationStartTime = undefined
            }
          }
        } catch {
          generationStartTime = undefined
        }

        return {
          id: img.id || generateImageId(),
          url: img.url || '',
          prompt: img.prompt || '',
          revisedPrompt: img.revisedPrompt,
          timestamp,
          quality: img.quality || 'standard',
          style: img.style,
          size: img.size,
          model: img.model || 'unknown',
          originalImageId: img.originalImageId,
          editStrength: img.editStrength,
          generationStartTime,
          isGenerating: false, // Loaded images are never generating
          // Restore multi-edit fields
          isMultiImageEdit: img.isMultiImageEdit,
          sourceImages: img.sourceImages,
          inputImages: img.inputImages,
          isUploaded: img.isUploaded,
          geminiUri: img.geminiUri
        }
      })
  } catch (error) {
    console.error('Failed to load images:', error)
    // Clear corrupted data
    try {
      localStorage.removeItem('generatedImages')
    } catch (e) {
      console.error('Failed to clear corrupted storage:', e)
    }
    return []
  }
}

/**
 * Detect if a message is requesting image generation
 */
export function isImageGenerationRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase()

  // First check if this is an analysis request - these should NOT trigger image generation
  const analysisPatterns = [
    /analyze\s+(the\s+)?upload/i,
    /provide\s+a\s+detailed\s+analysis/i,
    /reverse\s+engineering\s+analysis/i,
    /analyze\s+the\s+visual\s+content/i,
    /^please\s+provide\s+a\s+detailed\s+analysis/i,
    /images\s+\(\d+\):\s+analyze/i,
    /videos\s+\(\d+\):\s+analyze/i
  ]

  // If it's an analysis request, definitely not image generation
  if (analysisPatterns.some(pattern => pattern.test(message))) {
    return false
  }

  // Check for common image generation patterns
  const patterns = [
    /generate\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /create\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /make\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /draw\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /design\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /show\s+me\s+(a|an|the)?\s*\w*\s*(image|picture|illustration|artwork|art|photo|drawing)/i,
    /(image|picture|illustration|artwork|photo|drawing)\s+of\s+(?!the\s+uploaded)/i, // Exclude "image of the uploaded"
    /visualize/i,
    /generate:|create:|draw:|make:/i
  ]

  // Check if any pattern matches
  return patterns.some(pattern => pattern.test(lowerMessage))
}

/**
 * Extract image generation prompt from message
 */
export function extractImagePrompt(message: string): string {
  // Remove common prefixes using regex
  const patterns = [
    /^(generate|create|make|draw|design|show\s+me)\s+(a|an|the)?\s*/i,
    /^(image|picture|illustration|artwork|photo|drawing)\s+of\s*/i,
    /^visualize\s*/i,
  ]

  let prompt = message
  for (const pattern of patterns) {
    prompt = prompt.replace(pattern, '')
  }

  // Remove trailing "image", "picture", etc. if they appear at the start
  prompt = prompt.replace(/^(image|picture|illustration|artwork|photo|drawing)\s*/i, '')

  // Clean up any remaining artifacts
  prompt = prompt.replace(/\s+/g, ' ').trim()

  // If the prompt is empty or too short, use the original message
  if (prompt.length < 3) {
    prompt = message.replace(/^(generate|create|make|draw)\s+(a|an|the)?\s*/i, '').trim()
  }

  return prompt
}

/**
 * Format timestamp for display
 */
export function formatImageTimestamp(date: Date | undefined | null): string {
  // Handle undefined/null dates
  if (!date) {
    return 'Unknown time'
  }

  // Ensure we have a valid Date object
  let validDate: Date
  if (date instanceof Date) {
    validDate = date
  } else {
    // Try to parse as string/number
    validDate = new Date(date)
  }

  // Check if the date is valid
  if (isNaN(validDate.getTime())) {
    return 'Invalid time'
  }

  const now = new Date()
  const diff = now.getTime() - validDate.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  }
  return 'Just now'
}

/**
 * Clear all image storage
 */
export function clearImageStorage(): void {
  try {
    localStorage.removeItem('generatedImages')
    console.log('Image storage cleared')
  } catch (error) {
    console.error('Failed to clear image storage:', error)
  }
}

/**
 * Get storage info
 */
export function getStorageInfo(): { used: number; images: number } {
  try {
    const stored = localStorage.getItem('generatedImages') || '[]'
    const size = new Blob([stored]).size
    const images = JSON.parse(stored).length
    return { used: size, images }
  } catch {
    return { used: 0, images: 0 }
  }
}



/**
 * Detects the aspect ratio of an image and maps it to the closest supported video aspect ratio
 * @param imageUrl The URL of the image to analyze
 * @returns Promise<VideoAspectRatio> The closest matching video aspect ratio
 */
export async function detectImageAspectRatio(imageUrl: string): Promise<"16:9" | "9:16" | "1:1"> {
  return new Promise((resolve, reject) => {
    // For Gemini URIs (HEIC and other formats), default to 16:9
    if (imageUrl.includes('generativelanguage.googleapis.com')) {
      console.log('Detected Gemini URI (likely HEIC), defaulting to 16:9')
      resolve("16:9")
      return
    }

    const img = new Image()

    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      const ratio = width / height

      console.log(`Image dimensions: ${width}x${height}, ratio: ${ratio}`)

      // Define aspect ratio thresholds
      const LANDSCAPE_THRESHOLD = 1.5  // 16:9 ≈ 1.78
      const SQUARE_THRESHOLD_LOW = 0.8
      const SQUARE_THRESHOLD_HIGH = 1.2
      const PORTRAIT_THRESHOLD = 0.7   // 9:16 ≈ 0.56

      let detectedRatio: "16:9" | "9:16" | "1:1"

      if (ratio >= LANDSCAPE_THRESHOLD) {
        // Wide/landscape image -> 16:9
        detectedRatio = "16:9"
      } else if (ratio >= SQUARE_THRESHOLD_LOW && ratio <= SQUARE_THRESHOLD_HIGH) {
        // Square-ish image -> 1:1
        detectedRatio = "1:1"
      } else if (ratio <= PORTRAIT_THRESHOLD) {
        // Tall/portrait image -> 9:16
        detectedRatio = "9:16"
      } else {
        // Default fallback for ambiguous ratios
        detectedRatio = ratio > 1 ? "16:9" : "9:16"
      }

      console.log(`Auto-detected aspect ratio: ${detectedRatio} for image ratio ${ratio}`)
      resolve(detectedRatio)
    }

    img.onerror = () => {
      console.warn('Failed to load image for aspect ratio detection, defaulting to 16:9')
      // Default to 16:9 instead of rejecting
      resolve("16:9")
    }

    // Handle CORS issues
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
  })
}

/**
 * Gets a human-readable description of why an aspect ratio was auto-selected
 * @param imageUrl The source image URL
 * @param detectedRatio The detected aspect ratio
 * @returns Promise<string> Description of the detection logic
 */
export async function getAspectRatioDetectionReason(
  imageUrl: string,
  detectedRatio: "16:9" | "9:16" | "1:1"
): Promise<string> {
  try {
    // For Gemini URIs, return a special message
    if (imageUrl.includes('generativelanguage.googleapis.com')) {
      return `HEIC/HEIF image → ${detectedRatio} (default for Apple formats)`
    }

    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => {
        console.warn('Image failed to load in getAspectRatioDetectionReason, using fallback')
        resolve(null) // Resolve instead of reject
      }
      img.crossOrigin = 'anonymous'
      img.src = imageUrl
    })

    const width = img.naturalWidth
    const height = img.naturalHeight

    // If image didn't load, return fallback message
    if (width === 0 || height === 0) {
      return `Auto-detected → ${detectedRatio} (unable to load image)`
    }

    const ratio = width / height

    switch (detectedRatio) {
      case "16:9":
        return `Landscape image (${width}×${height}, ratio ${ratio.toFixed(2)}) → 16:9 widescreen`
      case "9:16":
        return `Portrait image (${width}×${height}, ratio ${ratio.toFixed(2)}) → 9:16 vertical`
      case "1:1":
        return `Square image (${width}×${height}, ratio ${ratio.toFixed(2)}) → 1:1 square`
      default:
        return `Auto-detected → ${detectedRatio}`
    }
  } catch (error) {
    return `Auto-detected → ${detectedRatio} (fallback)`
  }
}

/**
 * Detect aspect ratio from a File object (for uploaded images)
 * Returns aspect ratio info and appropriate sizes for image editing and video generation
 */
export async function getImageAspectRatio(file: File): Promise<{
  width: number
  height: number
  aspectRatio: number
  orientation: 'landscape' | 'portrait' | 'square'
  imageSize: '1024x1024' | '1536x1024' | '1024x1536'
  videoAspectRatio: '16:9' | '9:16' | '1:1'
}> {
  return new Promise((resolve, reject) => {
    // Handle HEIC/HEIF files specially since browsers can't display them natively
    if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      console.log('Detected HEIC/HEIF file, using default landscape dimensions')
      // Most iPhone photos are landscape 4:3 or 16:9
      // Default to landscape orientation for HEIC files
      resolve({
        width: 4032,  // Common iPhone photo width
        height: 3024, // Common iPhone photo height
        aspectRatio: 4/3,
        orientation: 'landscape',
        imageSize: '1536x1024',
        videoAspectRatio: '16:9'
      })
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const width = img.width
      const height = img.height
      const aspectRatio = width / height

      // Determine orientation and appropriate sizes
      let orientation: 'landscape' | 'portrait' | 'square'
      let imageSize: '1024x1024' | '1536x1024' | '1024x1536'
      let videoAspectRatio: '16:9' | '9:16' | '1:1'

      if (Math.abs(aspectRatio - 1) < 0.1) {
        // Square (within 10% of 1:1)
        orientation = 'square'
        imageSize = '1024x1024'
        videoAspectRatio = '1:1'
      } else if (aspectRatio > 1) {
        // Landscape
        orientation = 'landscape'
        imageSize = '1536x1024' // OpenAI-compatible landscape size
        videoAspectRatio = '16:9'
      } else {
        // Portrait
        orientation = 'portrait'
        imageSize = '1024x1536' // OpenAI-compatible portrait size
        videoAspectRatio = '9:16'
      }

      URL.revokeObjectURL(url)
      resolve({ width, height, aspectRatio, orientation, imageSize, videoAspectRatio })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Instead of rejecting, return default values
      console.warn('Failed to load image for aspect ratio detection, using defaults')
      resolve({
        width: 1024,
        height: 1024,
        aspectRatio: 1,
        orientation: 'square',
        imageSize: '1024x1024',
        videoAspectRatio: '1:1'
      })
    }

    img.src = url
  })
}


/**
 * Validates image generation parameters for portrait sizes
 */
export function validatePortraitGeneration(params: {
  size: string;
  model: string;
  aspectRatio?: string;
}): { isValid: boolean; error?: string } {
  const { size, model, aspectRatio } = params;

  // Check portrait size support
  if (size === '1024x1536') {
    if (model !== 'flux-kontext-pro' && model !== 'flux-kontext-max' && model !== 'gpt-image-1') {
      return {
        isValid: false,
        error: `Model '${model}' does not support portrait size 1024x1536`
      };
    }

    if (aspectRatio && aspectRatio !== '9:16') {
      return {
        isValid: false,
        error: `Invalid aspect ratio '${aspectRatio}' for portrait size 1024x1536`
      };
    }
  }

  return { isValid: true };
}
