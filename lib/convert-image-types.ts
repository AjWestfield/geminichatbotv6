import { GeneratedImage } from '@/lib/image-utils'
import { StoredImage } from '@/lib/database/supabase'

/**
 * Convert database image to GeneratedImage format
 * This ensures all required fields are properly mapped
 */
export function convertStoredImageToGenerated(dbImage: StoredImage): GeneratedImage {
  return {
    // Required fields
    // Use localId from metadata if available (for proper matching with localStorage)
    id: dbImage.metadata?.localId || dbImage.id,
    url: dbImage.url,
    prompt: dbImage.prompt,
    timestamp: new Date(dbImage.created_at),
    quality: (dbImage.quality as 'standard' | 'hd' | 'wavespeed') || 'standard',
    model: dbImage.model || 'unknown',
    
    // Optional fields
    revisedPrompt: dbImage.revised_prompt,
    style: dbImage.style as 'vivid' | 'natural' | undefined,
    size: dbImage.size || '1024x1024',
    originalImageId: dbImage.original_image_id,
    isUploaded: dbImage.is_uploaded || false,
    
    // UI state fields (not from DB)
    isGenerating: false,
    
    // Metadata
    geminiUri: dbImage.metadata?.geminiUri,
    editStrength: dbImage.metadata?.editStrength,
    
    // Multi-edit fields from metadata
    isMultiImageEdit: dbImage.metadata?.isMultiImageEdit,
    sourceImages: dbImage.metadata?.sourceImages,
    inputImages: dbImage.metadata?.inputImages,
    
    // Times (if available in metadata)
    generationStartTime: dbImage.metadata?.generationStartTime 
      ? new Date(dbImage.metadata.generationStartTime) 
      : undefined,
    urlAvailableTime: dbImage.metadata?.urlAvailableTime 
      ? new Date(dbImage.metadata.urlAvailableTime) 
      : undefined
  }
}

/**
 * Fix for page.tsx loadPersistedImages function
 * Replace the dbImages mapping with this:
 */
export const fixedImageLoadingCode = `
// Inside loadPersistedImages function, after loading dbImages:
const formattedDbImages = dbImages.map(convertStoredImageToGenerated);

// Then use formattedDbImages instead of dbImages for the rest of the function
if (isPersistenceEnabled && formattedDbImages.length > 0) {
  // Create a set of database image IDs for quick lookup
  const dbImageIds = new Set(formattedDbImages.map((img: GeneratedImage) => img.id))
  
  // Only include localStorage images that are NOT in the database
  const unsavedLocalImages = localImages.filter((localImg: GeneratedImage) =>
    !dbImageIds.has(localImg.id)
  )
  
  // Combine database images with unsaved local images
  finalImages = [...formattedDbImages, ...unsavedLocalImages]
  
  // Clean up localStorage - remove images that exist in database
  const imagesToKeep = localImages.filter((img: GeneratedImage) =>
    !dbImageIds.has(img.id)
  )
  
  if (imagesToKeep.length !== localImages.length) {
    console.log('[PAGE] Cleaning up localStorage, removing', localImages.length - imagesToKeep.length, 'images that exist in database')
    saveGeneratedImages(imagesToKeep)
  }
  
  // Mark all database images as saved
  formattedDbImages.forEach((img: GeneratedImage) => {
    savedImageIdsRef.current.add(img.id)
  })
}
`

console.log('Add this function to lib/image-utils.ts or use it directly in page.tsx');
console.log('This ensures proper type conversion from database StoredImage to GeneratedImage');
