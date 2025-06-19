"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EnhancedTextarea } from "@/components/ui/enhanced-textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Wand2, Info } from "lucide-react"
import type { GeneratedImage } from "@/lib/image-utils"
import { detectImageAspectRatio } from "@/lib/image-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useImageProgressStore } from "@/lib/stores/image-progress-store"

interface ImageEditModalProps {
  isOpen: boolean
  onClose: () => void
  image: GeneratedImage | null
  onEditComplete: (editedImage: GeneratedImage) => void
  editingModel?: string
}

export function ImageEditModal({ isOpen, onClose, image, onEditComplete, editingModel }: ImageEditModalProps) {
  const [editPrompt, setEditPrompt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedSize, setDetectedSize] = useState<"1024x1024" | "1536x1024" | "1024x1536">("1024x1024")
  const [effectiveEditingModel, setEffectiveEditingModel] = useState<string>('flux-kontext-pro')

  const { addImageGeneration, updateStage, completeImageGeneration, failImageGeneration } = useImageProgressStore()

  // Determine the effective editing model with fallback
  useEffect(() => {
    if (isOpen) {
      // Priority: prop > localStorage > default
      const model = editingModel || localStorage.getItem('imageEditingModel') || 'flux-kontext-pro'
      setEffectiveEditingModel(model)
      
      console.log('[ImageEditModal] Determining editing model:', {
        prop: editingModel,
        localStorage: localStorage.getItem('imageEditingModel'),
        effective: model
      })
    }
  }, [isOpen, editingModel])

  // Listen for settings changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'imageEditingModel' && e.newValue) {
        setEffectiveEditingModel(e.newValue)
        console.log('[ImageEditModal] Settings changed, updating model to:', e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Detect aspect ratio when image changes
  useEffect(() => {
    const detectSize = async () => {
      if (!image?.url) return

      try {
        const aspectRatio = await detectImageAspectRatio(image.url)
        // Convert video aspect ratio to image size
        let size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024"

        if (aspectRatio === "16:9") {
          size = "1536x1024" // Landscape
        } else if (aspectRatio === "9:16") {
          size = "1024x1536" // Portrait
        } else {
          size = "1024x1024" // Square
        }

        setDetectedSize(size)
        console.log('[ImageEditModal] Detected aspect ratio:', aspectRatio, 'Using size:', size)
      } catch (error) {
        console.error('[ImageEditModal] Error detecting aspect ratio:', error)
        // Use original size if available
        if (image.size === "1536x1024" || image.size === "1024x1536") {
          setDetectedSize(image.size as any)
        }
      }
    }

    detectSize()
  }, [image])

  const handleEdit = async () => {
    if (!image || !editPrompt.trim()) return

    console.log('[ImageEditModal] handleEdit called with image:', {
      id: image.id,
      isUploaded: image.isUploaded,
      quality: image.quality,
      model: image.model,
      size: image.size,
      hasDataUrl: image.url?.startsWith('data:'),
      urlLength: image.url?.length
    })

    setIsSubmitting(true)
    setError(null)

    // Generate unique ID for the new image
    const editedImageId = `edited-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log('[ImageEditModal] Starting edit process for image:', {
      id: image.id,
      isUploaded: image.isUploaded,
      model: effectiveEditingModel,
      prompt: editPrompt.substring(0, 50)
    })

    // Add to progress store
    addImageGeneration(editedImageId, editPrompt, {
      originalImageId: image.id,
      originalImageUrl: image.url,
      quality: image.quality || "standard",
      style: image.style || "vivid",
      size: detectedSize,
      model: effectiveEditingModel, // Use effective model for progress tracking
    })

    // Close modal and reset
    onClose()
    setEditPrompt("")
    setIsSubmitting(false)

    // Start the actual generation in the background
    performImageEdit(editedImageId, image, editPrompt, detectedSize, effectiveEditingModel, onEditComplete)
  }

  // Separate function to handle the actual API call
  const performImageEdit = async (
    editedImageId: string,
    originalImage: GeneratedImage,
    prompt: string,
    size: "1024x1024" | "1536x1024" | "1024x1536",
    model: string,
    onComplete: (editedImage: GeneratedImage) => void
  ) => {
    try {
      // Update to processing stage
      updateStage(editedImageId, 'processing')

      // Check if the image URL is accessible
      let imageUrl = originalImage.url

      // Check if this is a Replicate URL that might have expired
      // Replicate URLs expire after 24 hours
      if (imageUrl.includes('replicate.delivery')) {
        console.log('[ImageEditModal] Detected Replicate URL, will check if expired')
      }

      // If it's a data URL or blob URL, it should work as-is
      // For other URLs, validate they're still accessible
      if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:') && !imageUrl.includes('blob.vercel-storage.com')) {
        try {
          const testResponse = await fetch(imageUrl, { method: 'HEAD' })
          if (!testResponse.ok) {
            throw new Error('Image URL no longer accessible')
          }
        } catch (error) {
          console.error('[ImageEditModal] Image URL test failed:', error)
          console.log('[ImageEditModal] URL test failed, but the API will try to recover using database lookup or conversion')
          // Don't fail immediately - let the API try to recover the image
        }
      }

      // All images (uploaded and generated) now use the same edit API
      console.log('[ImageEditModal] Using edit API for image:', {
        isUploaded: originalImage.isUploaded,
        model: model,
        imageUrlType: imageUrl.startsWith('data:') ? 'data-url' :
                     imageUrl.includes('blob.vercel-storage.com') ? 'vercel-blob' :
                     imageUrl.includes('replicate.delivery') ? 'replicate' : 'other'
      })

      const requestBody = {
        imageUrl: imageUrl,
        imageId: originalImage.id, // Pass the local image ID for database lookup
        prompt: prompt,
        quality: originalImage.quality || "standard",
        style: originalImage.style || "vivid",
        size: size,
        model: model || 'flux-kontext-pro', // Ensure we always send a valid model
      }

      console.log('[ImageEditModal] Sending edit request for', originalImage.isUploaded ? 'uploaded' : 'generated', 'image')
      console.log('[ImageEditModal] Using model:', requestBody.model)

      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to edit image")
      }

      // Update to finalizing stage
      updateStage(editedImageId, 'finalizing')

      // Create edited image object - handle different response formats
      const editedImage: GeneratedImage = {
        id: editedImageId,
        url: data.images?.[0]?.url || data.url, // Handle both formats
        prompt: prompt,
        revisedPrompt: data.images?.[0]?.revisedPrompt || data.revisedPrompt || prompt,
        timestamp: new Date(),
        quality: data.metadata?.quality || originalImage.quality || "standard",
        style: data.metadata?.style || originalImage.style || "vivid",
        size: size, // Use the detected size
        model: data.metadata?.model || data.model || model,
        originalImageId: originalImage.id,
        isGenerating: false, // Explicitly mark as not generating since it's complete
      }

      // Complete the generation
      completeImageGeneration(editedImageId, editedImage)
      onComplete(editedImage)
    } catch (error) {
      console.error("Edit error:", error)
      failImageGeneration(
        editedImageId,
        error instanceof Error ? error.message : "Failed to edit image"
      )
    }
  }

  if (!image) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#2B2B2B] border-[#333333]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Editing image with {
              effectiveEditingModel === 'gpt-image-1' ? 'GPT-Image-1' :
              effectiveEditingModel === 'flux-kontext-pro' ? 'Flux Kontext Pro' :
              effectiveEditingModel === 'flux-kontext-max' ? 'Flux Kontext Max' :
              effectiveEditingModel // Fallback to raw model name
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Original Image Preview */}
          <div className="relative rounded-lg overflow-hidden bg-black">
            <img
              src={image.url}
              alt="Original content to be edited"
              className="w-full h-auto max-h-[40vh] object-contain"
            />
          </div>

          {/* Edit Prompt */}
          <div className="space-y-2">
            <Label htmlFor="edit-prompt" className="text-white">
              Describe how you want to edit this image
            </Label>
            <EnhancedTextarea
              id="edit-prompt"
              placeholder="e.g., 'Transform into a sunset scene', 'Add a rainbow in the sky', 'Change to winter with snow'"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              model={effectiveEditingModel}
              context="image-edit"
              disabled={isSubmitting}
            />
          </div>

          {/* Model Info */}
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {effectiveEditingModel === 'gpt-image-1'
                ? "GPT-Image-1 uses GPT-4o's native multimodal capabilities to understand your instructions and transform images with advanced context awareness. It excels at style changes, scene modifications, and creative transformations while maintaining the core composition of your original image."
                : effectiveEditingModel === 'flux-kontext-max'
                ? "Flux Kontext Max provides maximum performance for image editing with improved typography generation. It excels at detailed transformations and text rendering while maintaining high fidelity to your editing instructions."
                : effectiveEditingModel === 'flux-kontext-pro'
                ? "Flux Kontext Pro offers excellent prompt following and consistent results for image editing. It provides reliable transformations with good balance between quality and generation speed."
                : `${effectiveEditingModel} will be used to edit this image. The model will interpret your instructions to transform the image while maintaining its core composition.`
              }
            </AlertDescription>
          </Alert>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500 font-medium mb-1">
                {error.includes("Content not allowed") ? "Content Policy Violation" :
                 error.includes("Image URL expired") ? "Image URL Expired" :
                 "Edit Failed"}
              </p>
              <p className="text-sm text-red-400">{error}</p>
              {error.includes("Content not allowed") && (
                <div className="mt-2 text-xs text-gray-400">
                  <p className="font-medium mb-1">Suggestions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Try using more generic descriptions (e.g., "superhero" instead of character names)</li>
                    <li>Avoid references to copyrighted characters or brands</li>
                    <li>Use different wording for your edit request</li>
                    <li>Try editing a different image</li>
                  </ul>
                </div>
              )}
              {error.includes("Image URL expired") && (
                <div className="mt-2 text-xs text-gray-400">
                  <p className="font-medium mb-1">Solutions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload the image file directly to the chat and edit it</li>
                    <li>Generate a new image to edit</li>
                    <li>Try editing more recent images (within 24 hours)</li>
                    <li>Save important images locally before they expire</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 <strong>Tip:</strong> Replicate-generated images expire after 24 hours for security reasons.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editPrompt.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Start Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
