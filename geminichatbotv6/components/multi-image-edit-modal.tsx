"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EnhancedTextarea } from "@/components/ui/enhanced-textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Wand2, Images } from "lucide-react"
import { toast } from "sonner"
import { generateImageId } from "@/lib/image-utils"
import { useImageProgressStore } from "@/lib/stores/image-progress-store"
import type { GeneratedImage } from "@/lib/image-utils"

interface MultiImageEditModalProps {
  isOpen: boolean
  onClose: () => void
  images: string[] // Array of image URLs
  onEditComplete: (editedImage: GeneratedImage) => void
}

export function MultiImageEditModal({
  isOpen,
  onClose,
  images,
  onEditComplete
}: MultiImageEditModalProps) {
  const [editPrompt, setEditPrompt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addImageGeneration, updateStage, completeImageGeneration, failImageGeneration } = useImageProgressStore()

  // Helper function to convert blob URL to data URL
  const convertBlobToDataUrl = async (blobUrl: string): Promise<string> => {
    try {
      const response = await fetch(blobUrl)
      const blob = await response.blob()

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('[MultiImageEditModal] Failed to convert blob URL:', error)
      throw new Error(`Failed to convert blob URL to data URL: ${error}`)
    }
  }

  const handleEdit = async () => {
    if (!images || images.length < 2 || !editPrompt.trim()) return

    // Additional safety check for maximum images
    if (images.length > 10) {
      toast.error("Too many images selected", {
        description: "Maximum 10 images allowed for multi-image editing. Please deselect some images.",
        duration: 5000
      })
      return
    }

    console.log('[MultiImageEditModal] handleEdit called with:', {
      imageCount: images.length,
      prompt: editPrompt,
      images: images.map((url, index) => ({
        index: index + 1,
        preview: url.substring(0, 50) + '...',
        type: url.startsWith('data:') ? 'data URL' : url.startsWith('blob:') ? 'blob URL' : 'external URL'
      }))
    })

    setIsSubmitting(true)
    setError(null)

    // Generate unique ID for the new image
    const editedImageId = `multi-edited-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Add to progress store
    addImageGeneration(editedImageId, editPrompt, {
      quality: "hd",
      style: "vivid",
      size: "1024x1024",
      model: "flux-kontext-max-multi"
    })

    try {
      updateStage(editedImageId, 'processing', 'Preparing images...')

      // Convert any blob URLs to data URLs before sending to API
      const processedImages: string[] = []

      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i]
        console.log(`[MultiImageEditModal] Processing image ${i + 1}:`, imageUrl.substring(0, 50) + '...')

        if (imageUrl.startsWith('blob:')) {
          console.log(`[MultiImageEditModal] Converting blob URL to data URL for image ${i + 1}`)
          updateStage(editedImageId, 'processing', `Converting image ${i + 1} to data URL...`)
          const dataUrl = await convertBlobToDataUrl(imageUrl)
          processedImages.push(dataUrl)
          console.log(`[MultiImageEditModal] Successfully converted image ${i + 1} to data URL`)
        } else {
          // Already a data URL or HTTP URL - use as-is
          processedImages.push(imageUrl)
          console.log(`[MultiImageEditModal] Image ${i + 1} is already in compatible format`)
        }
      }

      updateStage(editedImageId, 'processing', 'Combining multiple images...')

      console.log('[DEBUG] Final processedImages before API call:', {
        count: processedImages.length,
        types: processedImages.map(url => url.startsWith('data:') ? 'data URL' : 'other'),
        previews: processedImages.map((url, i) => `${i+1}: ${url.substring(0, 50)}...`),
        sizes: processedImages.map(url => `${(url.length / 1024).toFixed(2)}KB`)
      })

      const requestBody = {
        images: processedImages,
        prompt: editPrompt,
        guidanceScale: 3.5,
        safetyTolerance: "2"
      }

      console.log('[MultiImageEditModal] Sending API request with:', {
        imageCount: processedImages.length,
        prompt: editPrompt,
        imageTypes: processedImages.map(url => {
          if (url.startsWith('data:')) return 'data URL'
          if (url.startsWith('blob:')) return 'blob URL'
          if (url.startsWith('http')) return 'HTTP URL'
          return 'unknown'
        })
      })

      const response = await fetch("/api/edit-multi-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to edit multiple images")
      }

      console.log('[MultiImageEditModal] API response:', data)

      // Enhanced response logging
      if (data.metadata) {
        console.log('[MultiImageEditModal] API metadata:', {
          processedImages: data.metadata.input?.images?.length || 'unknown',
          usedPrompt: data.metadata.input?.prompt || 'unknown',
          model: data.metadata.model,
          fullMetadata: data.metadata
        })
      }

      if (!data.success || !data.images || data.images.length === 0) {
        throw new Error("No edited image returned from API")
      }

      updateStage(editedImageId, 'finalizing', 'Processing final image...')

      // Create the edited image object
      const editedImage: GeneratedImage = {
        id: editedImageId,
        prompt: editPrompt,
        url: data.images[0].url,
        timestamp: new Date(),
        quality: 'hd',
        model: 'flux-kontext-max-multi',
        style: 'vivid',
        size: '1024x1024',
        isGenerating: false,
        isMultiImageEdit: true,
        inputImages: images,
        metadata: data.metadata
      }

      console.log('[MultiImageEditModal] Created edited image:', {
        id: editedImage.id,
        url: editedImage.url?.substring(0, 50) + '...',
        model: editedImage.model
      })

      // Complete the generation
      completeImageGeneration(editedImageId, editedImage)
      onEditComplete(editedImage)

      // Show success message
      toast.success("Multi-image edit completed!", {
        description: `Combined ${images.length} images using Flux Kontext Max Multi`,
        duration: 3000
      })

      // Close modal and reset form
      onClose()
      setEditPrompt("")

    } catch (error: any) {
      console.error("Multi-image edit error:", error)
      setError(error.message)

      failImageGeneration(
        editedImageId,
        error.message || "Failed to edit multiple images"
      )

      toast.error("Multi-image edit failed", {
        description: error.message || "An error occurred while editing the images",
        duration: 5000
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
      setEditPrompt("")
      setError(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl bg-[#2B2B2B] border-[#333333]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Images className="w-5 h-5" />
            Multi-Image Edit with Flux Kontext Max Multi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Preview Grid */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">
              Selected Images ({images.length}/10 max)
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-2 bg-[#1A1A1A] rounded-lg">
              {images.map((imageUrl, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-[#333333]">
                  <img
                    src={imageUrl}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      console.error(`[MultiImageEditModal] Image ${index + 1} failed to load:`, imageUrl)
                      const target = e.currentTarget
                      target.style.display = 'none'

                      // Show error indicator
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.broken-image-indicator')) {
                        const errorDiv = document.createElement('div')
                        errorDiv.className = 'broken-image-indicator w-full h-full bg-red-900/20 flex items-center justify-center border border-red-500/30'
                        errorDiv.innerHTML = `
                          <div class="text-center">
                            <div class="text-red-400 text-xs">⚠️</div>
                            <div class="text-red-400 text-xs">Failed</div>
                          </div>
                        `
                        parent.appendChild(errorDiv)
                      }
                    }}
                  />
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Prompt */}
          <div className="space-y-2">
            <Label htmlFor="edit-prompt" className="text-white text-sm font-medium">
              Edit Instructions
            </Label>

            {/* Prompt tip for 3+ images */}
            {images.length >= 3 && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 text-xs text-yellow-400">
                <p className="font-medium mb-1">💡 Tip for {images.length} images:</p>
                <p>Be specific about ALL items you want combined. For example:</p>
                <p className="mt-1 italic">
                  {images.length === 3
                    ? "\"A woman wearing the yellow dress and red heels at the oscars\""
                    : `"Combine all ${images.length} elements: [describe each item]"`
                  }
                </p>
              </div>
            )}

            <EnhancedTextarea
              id="edit-prompt"
              placeholder={
                images.length === 3
                  ? "Be specific about ALL 3 items (e.g., 'A woman wearing the dress and shoes')"
                  : "Describe how you want to combine or edit these images... (e.g., 'Combine these images into a collage', 'Blend the subjects together', 'Create a scene with all elements')"
              }
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              context="multi-image"
              disabled={isSubmitting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#333333]">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="bg-transparent border-[#333333] text-white hover:bg-[#333333]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSubmitting || !editPrompt.trim() || images.length < 2}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Editing...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Edit Images
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-400 bg-[#1A1A1A] p-3 rounded-lg">
            <p className="font-medium mb-1">Multi-Image Editing with Flux Kontext Max Multi:</p>
            <ul className="space-y-1 ml-2">
              <li>• Combines {images.length} images using advanced AI (2-10 images supported)</li>
              <li>• Creates seamless compositions and blends</li>
              <li>• Supports style transfer and object manipulation</li>
              <li>• Processing time: ~30-60 seconds</li>
            </ul>
            {images.length > 2 && (
              <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded text-yellow-400/80 text-xs">
                <strong>⚠️ Known Issue:</strong> You've selected {images.length} images. Some users report that only 2 images are processed even when 3+ are selected.
                <br />
                <strong>Tip:</strong> Be very specific in your prompt about ALL items (e.g., "wearing the dress AND the shoes").
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
