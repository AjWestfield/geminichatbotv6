"use client"

import { useState, useEffect, useMemo, useCallback, useRef, CSSProperties } from "react"
import { Download, Trash2, Search, Filter, Wand2, Video, CheckSquare, Square, Images, Maximize2, Minimize2, Sparkles, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { downloadImage, formatImageTimestamp, getQualityBadgeColor, saveGeneratedImages, loadGeneratedImages, clearImageStorage } from "@/lib/image-utils"
import { ImageEditModal } from "@/components/image-edit-modal"
// Temporarily using enhanced modal for debugging
import { ImageUpscaleModal } from "@/components/image-upscale-modal-enhanced"
import { MultiImageEditModal } from "@/components/multi-image-edit-modal"
import { ImageLoadingCard } from "@/components/image-loading-card"
import { useImageProgressStore } from "@/lib/stores/image-progress-store"

import { getSourceImagesForEdit } from "@/lib/database-operations"
import { toast } from "sonner"

interface StoredImage {
  id: string
  url: string
  prompt: string
  revised_prompt?: string
  quality: string
  style?: string
  size: string
  model: string
  created_at: string
  is_uploaded?: boolean
  original_image_id?: string
  metadata?: any
}

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  revisedPrompt?: string
  timestamp: Date
  quality: 'standard' | 'hd' | 'wavespeed'
  style?: 'vivid' | 'natural'
  size: string
  model: string
  isGenerating?: boolean
  isUploaded?: boolean
  originalImageId?: string
  isUpscaled?: boolean
  upscaleSettings?: {
    factor: string
    model: string
  }
  metadata?: any
  geminiUri?: string
  sourceImages?: string[]
  inputImages?: any[]
  isMultiImageEdit?: boolean
}

interface ImageGalleryProps {
  images: GeneratedImage[]
  onImagesChange?: (images: GeneratedImage[]) => void
  onAnimateImage?: (image: GeneratedImage) => void
  autoOpenEditId?: string | null
  onEditComplete?: (editedImage: GeneratedImage) => void
  imageEditingModel?: string
}

export function ImageGallery({ images: propImages, onImagesChange, onAnimateImage, autoOpenEditId, onEditComplete, imageEditingModel }: ImageGalleryProps) {
  const [images, setImages] = useState<GeneratedImage[]>(Array.isArray(propImages) ? propImages : [])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null)
  const [upscalingImage, setUpscalingImage] = useState<GeneratedImage | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [qualityFilter, setQualityFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(false)
  const [comparisonMode, setComparisonMode] = useState<'split' | 'slider'>('split')
  const [sliderPosition, setSliderPosition] = useState(50)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const [showMultiEditModal, setShowMultiEditModal] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sourceImagesFromDb, setSourceImagesFromDb] = useState<Map<string, GeneratedImage[]>>(new Map())
  const [isAnimating, setIsAnimating] = useState(false)

  // Ref for the slider container to update CSS custom properties
  const sliderContainerRef = useRef<HTMLDivElement>(null)

  // Update CSS custom properties when slider position changes
  useEffect(() => {
    if (sliderContainerRef.current) {
      sliderContainerRef.current.style.setProperty('--slider-position', `${sliderPosition}%`)
      sliderContainerRef.current.style.setProperty('--clip-right', `${100 - sliderPosition}%`)
    }
  }, [sliderPosition])

  // Get progress store data
  const { getAllGeneratingImages, removeProgress, calculateProgress } = useImageProgressStore()
  const generatingImages = getAllGeneratingImages()

  // Handler functions
  const handleDownload = async (image: GeneratedImage, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await downloadImage(image.url, image.prompt)
      toast.success('Image downloaded successfully')
    } catch (error) {
      console.error('Error downloading image:', error)
      toast.error('Failed to download image')
    }
  }

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('Prompt copied to clipboard')
    } catch (error) {
      console.error('Error copying prompt:', error)
      toast.error('Failed to copy prompt')
    }
  }

  const handleDelete = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const updatedImages = images.filter(img => img.id !== imageId)
      setImages(updatedImages)
      onImagesChange?.(updatedImages)
      toast.success('Image deleted successfully')
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
    }
  }

  const findOriginalImage = (originalImageId: string): GeneratedImage | null => {
    return images.find(img => img.id === originalImageId) || null
  }

  // Selection mode functions
  const toggleImageSelection = (imageId: string) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  const clearSelection = () => {
    setSelectedImageIds(new Set())
    setSelectionMode(false)
  }

  const openMultiEditWithSelection = () => {
    if (selectedImageIds.size >= 2) {
      setShowMultiEditModal(true)
    }
  }

  // Smooth animation handler for opening modal
  const handleImageClick = (image: GeneratedImage) => {
    setIsAnimating(true)
    setSelectedImage(image)
    // Allow animation to start
    setTimeout(() => setIsAnimating(false), 50)
  }

  // Handle fullscreen toggle with smooth transition
  const toggleFullscreen = useCallback(() => {
    if (!isFullScreen) {
      // Entering fullscreen
      document.body.classList.add('modal-fullscreen-active')
      setIsFullScreen(true)
    } else {
      // Exiting fullscreen
      setIsFullScreen(false)
      setTimeout(() => {
        document.body.classList.remove('modal-fullscreen-active')
      }, 400)
    }
  }, [isFullScreen])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('modal-fullscreen-active')
    }
  }, [])

  // Sync with prop changes
  useEffect(() => {
    const safeImages = Array.isArray(propImages) ? propImages : []
    console.log('[IMAGE_GALLERY] Prop images changed:', safeImages.length)
    setImages(safeImages)
  }, [propImages])

  // Keyboard shortcuts for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return

      // F for fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setIsFullScreen(!isFullScreen)
      }
      // E for edit
      else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        setSelectedImage(null)
        setEditingImage(selectedImage)
      }
      // D for download
      else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        handleDownload(selectedImage, { stopPropagation: () => {} } as React.MouseEvent)
      }
      // C for copy prompt
      else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        handleCopyPrompt(selectedImage.prompt)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, isFullScreen, handleDownload, handleCopyPrompt, setEditingImage])

  // Auto-open edit modal if specified
  useEffect(() => {
    if (autoOpenEditId && images.length > 0) {
      const imageToEdit = images.find(img => img.id === autoOpenEditId)
      if (imageToEdit) {
        console.log('[ImageGallery] Auto-opening edit modal for image:', autoOpenEditId)
        setEditingImage(imageToEdit)
      }
    }
  }, [autoOpenEditId, images])

  // Filter images based on search and quality
  const filteredImages = images
    .filter((image, index, array) => {
      // Deduplicate by ID (keep only the first occurrence)
      return array.findIndex(img => img.id === image.id) === index
    })
    .filter(image => {
      // Show images that are generating or have valid URLs
      if (!image.isGenerating && (!image.url || image.url.trim() === '')) {
        return false
      }

      const matchesSearch = searchQuery === "" ||
        image.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.revisedPrompt?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesQuality = qualityFilter === "all" || image.quality === qualityFilter

      return matchesSearch && matchesQuality
    })



  if (images.length === 0 && generatingImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 rounded-full bg-[#2B2B2B] flex items-center justify-center mb-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="No images">
            <title>No images</title>
            <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 8L12 3L7 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 3V15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Images Generated Yet</h3>
        <p className="text-[#B0B0B0] max-w-sm">
          Start generating images by typing prompts like "Generate an image of..." in the chat.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-testid="image-gallery">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-[#333333] space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#2B2B2B] border-[#333333] text-white placeholder:text-gray-500"
            />
          </div>
          <Select value={qualityFilter} onValueChange={setQualityFilter}>
            <SelectTrigger className="w-[140px] bg-[#2B2B2B] border-[#333333] text-white">
              <Filter className="w-4 h-4 mr-1.5" />
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent className="bg-[#2B2B2B] border-[#333333]">
              <SelectItem value="all">All Quality</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={selectionMode ? "default" : "outline"}
            onClick={() => {
              setSelectionMode(!selectionMode)
              if (!selectionMode) {
                setSelectedImageIds(new Set())
              }
            }}
            className={cn(
              "border-[#333333]",
              selectionMode ? "bg-purple-600 hover:bg-purple-700 border-purple-600" : "hover:bg-[#2B2B2B]"
            )}
          >
            {selectionMode ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
            Select
          </Button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">
              {filteredImages.length + generatingImages.length} {filteredImages.length + generatingImages.length === 1 ? 'image' : 'images'}
              {generatingImages.length > 0 && ` (${generatingImages.length} generating)`}
            </span>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <span className="text-purple-400">
                  {selectedImageIds.size} selected
                </span>
                {selectedImageIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-purple-400 hover:text-purple-300 underline text-xs"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}
          </div>
          {selectionMode && selectedImageIds.size >= 2 && (
            <Button
              size="sm"
              onClick={openMultiEditWithSelection}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Images className="w-4 h-4 mr-2" />
              Multi Edit ({selectedImageIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Image Grid */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Show generating images first */}
          {generatingImages.map((progress) => (
            <ImageLoadingCard
              key={progress.imageId}
              imageId={progress.imageId}
              onCancel={(id) => {
                removeProgress(id)
              }}
            />
          ))}

          {/* Then show completed images */}
          {filteredImages.map((image) => {
            // Skip if this image is currently generating
            if (generatingImages.some(g => g.imageId === image.id)) {
              return null
            }

            const isSelected = selectedImageIds.has(image.id)

            return (
              <div
                key={image.id}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden bg-[#1A1A1A] hover:ring-2 transition-all w-full",
                  selectionMode && isSelected
                    ? "ring-2 ring-purple-500 hover:ring-purple-400"
                    : "hover:ring-white/20"
                )}
              >
                {/* Clickable overlay */}
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full bg-transparent cursor-pointer z-10"
                  onClick={() => {
                    if (selectionMode) {
                      toggleImageSelection(image.id)
                    } else {
                      handleImageClick(image)
                    }
                  }}
                  aria-label={selectionMode ? `Toggle selection: ${image.prompt}` : `View image: ${image.prompt}`}
                  disabled={image.isGenerating}
                />

                {/* Selection checkbox overlay */}
                {selectionMode && (
                  <div className="absolute top-2 left-2 z-20 pointer-events-none">
                    <div className={cn(
                      "w-6 h-6 rounded border-2 flex items-center justify-center",
                      isSelected
                        ? "bg-purple-600 border-purple-600"
                        : "bg-black/50 border-white/50"
                    )}>
                      {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                )}

                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      console.error('[ImageGallery] Image failed to load:', {
                        url: image.url,
                        id: image.id,
                        timestamp: image.timestamp,
                        isReplicateUrl: image.url?.includes('replicate.delivery') || false
                      })
                      const target = e.currentTarget

                      // Prevent multiple error handlers from running
                      if (target.dataset.errorHandled) return
                      target.dataset.errorHandled = 'true'

                      // Replace with enhanced broken image placeholder
                      target.style.display = 'none'

                      // Show enhanced broken image indicator
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('.broken-image-indicator')) {
                        const isReplicateUrl = image.url?.includes('replicate.delivery') || false
                        const brokenDiv = document.createElement('div')
                        brokenDiv.className = 'broken-image-indicator w-full h-full bg-[#1A1A1A] flex items-center justify-center border-2 border-dashed border-red-500/30'
                        brokenDiv.innerHTML = `
                          <div class="text-center p-4">
                            <div class="text-red-400 mb-2">⚠️</div>
                            <p class="text-xs text-red-400 font-medium">Image unavailable</p>
                            <p class="text-xs text-gray-500 mt-1">
                              ${isReplicateUrl ? 'Replicate URL expired (24h limit)' : 'URL may have expired'}
                            </p>
                            <p class="text-xs text-gray-400 mt-2">Try regenerating the image</p>
                          </div>
                        `
                        parent.appendChild(brokenDiv)
                      }
                    }}
                    onLoad={() => {
                      console.log('[ImageGallery] Image loaded successfully:', image.id)
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                    <div className="text-center p-4">
                      <p className="text-xs text-gray-400 mt-2">
                        {image.isGenerating ? 'Generating...' : 'Loading...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-2 right-2 flex gap-2 pointer-events-auto z-20">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-black/50 hover:bg-black/70"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingImage(image)
                      }}
                      disabled={image.isGenerating || !image.url}
                      title="Edit image"
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-black/50 hover:bg-black/70"
                      onClick={(e) => handleDownload(image, e)}
                      disabled={image.isGenerating || !image.url}
                      title="Download image"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 bg-black/50 hover:bg-black/70"
                      onClick={(e) => handleDelete(image.id, e)}
                      disabled={image.isGenerating}
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {!image.isUpscaled && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 bg-black/50 hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUpscalingImage(image)
                        }}
                        disabled={image.isGenerating || !image.url}
                        title="Upscale image"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                    )}
                    {onAnimateImage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-8 h-8 bg-black/50 hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAnimateImage(image)
                        }}
                        disabled={image.isGenerating || !image.url}
                        title="Animate image"
                      >
                        <Video className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Image info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium line-clamp-2 mb-1">
                      {image.prompt}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-xs border", getQualityBadgeColor(image.quality))}
                      >
                        {image.quality}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {formatImageTimestamp(image.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Selected Image Modal */}
      {selectedImage && (
        <Dialog
          open={!!selectedImage}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedImage(null)
              setIsFullScreen(false)
              setIsAnimating(false)
              document.body.classList.remove('modal-fullscreen-active')
            }
          }}>
            <DialogContent
              className={cn(
                "bg-[#1A1A1A] border-[#333333] p-0 flex flex-col overflow-hidden",
                isFullScreen
                  ? "!fixed !inset-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0 !translate-x-0 !translate-y-0 !left-0 !top-0 !z-[9999] compact-modal-transition fullscreen-modal [&>button]:hidden"
                  : "sm:max-w-4xl h-[85vh] max-h-[85vh] max-w-[95vw] rounded-lg compact-modal-transition",
                // Smooth animation on mount
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              )}
              onPointerDownOutside={(e) => {
                if (isFullScreen) e.preventDefault()
              }}>
            {/* Compact header */}
            <DialogHeader className={cn(
              "flex-shrink-0 border-b border-[#333333] px-3 pr-12 py-2 h-12 relative"
            )}>
              <DialogTitle className="flex items-center justify-between h-full">
                <span className="text-sm font-medium text-gray-300">
                  {selectedImage.originalImageId && findOriginalImage(selectedImage.originalImageId)
                    ? "Image Comparison"
                    : "Generated Image"}
                </span>
                {/* Only fullscreen toggle in header - positioned to avoid close button */}
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={toggleFullscreen}
                    className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
                    title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
                  >
                    {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* Main content area - compact layout */}
            <div className={cn(
              "flex-1 flex flex-col min-h-0 overflow-hidden",
              isFullScreen ? "h-[calc(100vh-3rem)]" : ""
            )}>
              {selectedImage.originalImageId && findOriginalImage(selectedImage.originalImageId) ? (
                // Comparison view
                <>
                  {/* Comparison controls - minimal space */}
                  <div className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 border-b border-[#333333]">
                    <Button
                      size="sm"
                      variant={comparisonMode === 'split' ? 'default' : 'outline'}
                      onClick={() => setComparisonMode('split')}
                      className="h-7 text-xs px-3"
                    >
                      Split Screen
                    </Button>
                    <Button
                      size="sm"
                      variant={comparisonMode === 'slider' ? 'default' : 'outline'}
                      onClick={() => setComparisonMode('slider')}
                      className="h-7 text-xs px-3"
                    >
                      Slider
                    </Button>
                  </div>

                  {/* Image container - takes remaining space */}
                  <div className="flex-1 min-h-0 p-2">
                    <div className="relative h-full bg-[#0A0A0A] rounded-lg overflow-hidden">{comparisonMode === 'split' ? (
                      <div className="flex h-full gap-1">
                        <div className="flex-1 relative">
                          <img
                            src={findOriginalImage(selectedImage.originalImageId)!.url}
                            alt="Original"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.error('[ImageGallery Modal] Original image failed to load:', {
                                url: findOriginalImage(selectedImage.originalImageId)!.url,
                                context: 'modal-comparison-original'
                              })
                              const target = e.currentTarget
                              if (target.dataset.errorHandled) return
                              target.dataset.errorHandled = 'true'
                              target.style.display = 'none'

                              const parent = target.parentElement
                              if (parent && !parent.querySelector('.comparison-error-indicator')) {
                                const errorDiv = document.createElement('div')
                                errorDiv.className = 'comparison-error-indicator w-full h-full flex items-center justify-center bg-[#1A1A1A] border border-red-500/30'
                                errorDiv.innerHTML = `
                                  <div class="text-center p-4">
                                    <div class="text-red-400 mb-2">⚠️</div>
                                    <p class="text-xs text-red-400">Original unavailable</p>
                                  </div>
                                `
                                parent.appendChild(errorDiv)
                              }
                            }}
                          />
                          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                            Original
                          </div>
                        </div>
                        <div className="flex-1 relative">
                          <img
                            src={selectedImage.url}
                            alt="Edited"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              console.error('[ImageGallery Modal] Edited image failed to load:', {
                                url: selectedImage.url,
                                id: selectedImage.id,
                                context: 'modal-comparison-edited'
                              })
                              const target = e.currentTarget
                              if (target.dataset.errorHandled) return
                              target.dataset.errorHandled = 'true'
                              target.style.display = 'none'

                              const parent = target.parentElement
                              if (parent && !parent.querySelector('.comparison-error-indicator')) {
                                const errorDiv = document.createElement('div')
                                errorDiv.className = 'comparison-error-indicator w-full h-full flex items-center justify-center bg-[#1A1A1A] border border-red-500/30'
                                errorDiv.innerHTML = `
                                  <div class="text-center p-4">
                                    <div class="text-red-400 mb-2">⚠️</div>
                                    <p class="text-xs text-red-400">Edited unavailable</p>
                                  </div>
                                `
                                parent.appendChild(errorDiv)
                              }
                            }}
                          />
                          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                            Edited
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        ref={sliderContainerRef}
                        className="relative h-full select-none image-comparison-slider cursor-pointer"
                        onClick={(e) => {
                          // Allow clicking anywhere to move the slider
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
                          setSliderPosition(percentage)
                        }}
                      >
                        <img
                          src={findOriginalImage(selectedImage.originalImageId)!.url}
                          alt="Original"
                          className="w-full h-full object-contain pointer-events-none"
                          draggable={false}
                          onError={(e) => {
                            console.error('[ImageGallery Modal] Slider original image failed to load:', {
                              url: findOriginalImage(selectedImage.originalImageId)!.url,
                              context: 'modal-slider-original'
                            })
                            const target = e.currentTarget
                            if (target.dataset.errorHandled) return
                            target.dataset.errorHandled = 'true'
                            target.style.display = 'none'
                          }}
                        />
                        <div className="absolute inset-0 pointer-events-none">
                          <img
                            src={selectedImage.url}
                            alt="Edited"
                            className="w-full h-full object-contain image-comparison-clipped"
                            draggable={false}
                            onError={(e) => {
                              console.error('[ImageGallery Modal] Slider edited image failed to load:', {
                                url: selectedImage.url,
                                id: selectedImage.id,
                                context: 'modal-slider-edited'
                              })
                              const target = e.currentTarget
                              if (target.dataset.errorHandled) return
                              target.dataset.errorHandled = 'true'
                              target.style.display = 'none'
                            }}
                          />
                        </div>
                        {/* Improved slider handle */}
                        <div
                          className="absolute top-0 bottom-0 w-16 -ml-8 cursor-ew-resize z-20 group image-comparison-handle"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation() // Prevent triggering parent onClick
                            const container = e.currentTarget.parentElement!
                            const rect = container.getBoundingClientRect()
                            container.classList.add('slider-dragging')

                            const handleMouseMove = (e: MouseEvent) => {
                              e.preventDefault()
                              const x = e.clientX - rect.left
                              const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
                              setSliderPosition(percentage)
                            }
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove)
                              document.removeEventListener('mouseup', handleMouseUp)
                              container.classList.remove('slider-dragging')
                              document.body.style.cursor = ''
                              document.body.style.userSelect = ''
                            }
                            document.body.style.cursor = 'ew-resize'
                            document.body.style.userSelect = 'none'
                            document.addEventListener('mousemove', handleMouseMove)
                            document.addEventListener('mouseup', handleMouseUp)
                          }}
                        >
                          {/* Vertical line with gradient */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 via-white to-white/20" />

                          {/* Center handle */}
                          <div className="slider-handle absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl flex items-center justify-center border-2 border-white/20">
                            {/* Left arrow */}
                            <div className="absolute -left-1 w-5 h-5 flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                            {/* Center divider */}
                            <div className="w-px h-6 bg-gray-300"></div>
                            {/* Right arrow */}
                            <div className="absolute -right-1 w-5 h-5 flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none">
                                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          </div>

                          {/* Top and bottom indicators */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-4 w-0.5 h-2 bg-white/50 rounded-full" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-0.5 h-2 bg-white/50 rounded-full" />
                        </div>
                        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none">
                          Original
                        </div>
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm pointer-events-none">
                          Edited
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </>
              ) : (
                // Single image view
                <div className="flex-1 min-h-0 p-2">
                  <div className="h-full bg-[#0A0A0A] rounded-lg flex items-center justify-center p-2">
                    <img
                      src={selectedImage.url}
                      alt={selectedImage.prompt}
                      className={cn(
                        "max-w-full max-h-full object-contain",
                        isFullScreen ? "max-h-[calc(100vh-12rem)]" : "max-h-[calc(85vh-14rem)]"
                      )}
                      onError={(e) => {
                        console.error('[ImageGallery Modal] Image failed to load:', {
                          url: selectedImage.url,
                          id: selectedImage.id,
                          context: 'modal-single-view'
                        })
                        const target = e.currentTarget
                        if (target.dataset.errorHandled) return
                        target.dataset.errorHandled = 'true'

                        // Replace with error message
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent && !parent.querySelector('.modal-error-indicator')) {
                          const errorDiv = document.createElement('div')
                          errorDiv.className = 'modal-error-indicator flex items-center justify-center text-center p-8'
                          errorDiv.innerHTML = `
                            <div>
                              <div class="text-red-400 text-4xl mb-4">⚠️</div>
                              <p class="text-red-400 font-medium mb-2">Image unavailable</p>
                              <p class="text-gray-500 text-sm">The image URL may have expired</p>
                            </div>
                          `
                          parent.appendChild(errorDiv)
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Bottom section with prompt and actions - compact */}
              <div className="flex-shrink-0 border-t border-[#333333] p-3 bg-[#1A1A1A] max-h-[40%] overflow-y-auto modal-bottom-section">
                {/* Prompt information - enhanced visibility */}
                <div className="mb-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopyPrompt(selectedImage.prompt)}
                          className="h-5 w-5 text-gray-400 hover:text-white hover:bg-white/10 flex-shrink-0 mt-0.5"
                          title="Copy prompt"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <h3
                          className="text-sm font-medium text-white leading-relaxed line-clamp-3 break-words cursor-help hover:text-gray-200 transition-colors flex-1"
                          title={selectedImage.prompt}
                        >
                          {selectedImage.prompt}
                        </h3>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-xs px-2 py-0.5 border flex-shrink-0 mt-0.5", getQualityBadgeColor(selectedImage.quality))}
                    >
                      {selectedImage.quality}
                    </Badge>
                  </div>
                  {selectedImage.revisedPrompt && (
                    <div className="text-xs text-gray-400">
                      <span className="font-medium">Revised:</span>
                      <p
                        className="mt-0.5 leading-relaxed line-clamp-2 break-words cursor-help hover:text-gray-300 transition-colors"
                        title={selectedImage.revisedPrompt}
                      >
                        {selectedImage.revisedPrompt}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatImageTimestamp(selectedImage.timestamp)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedImage.size} • {selectedImage.model}
                    </span>
                  </div>
                </div>

                {/* Action buttons - compact */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(selectedImage, { stopPropagation: () => {} } as React.MouseEvent)}
                    className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B]"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedImage(null)
                      setEditingImage(selectedImage)
                    }}
                    className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B]"
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  {/* Upscale button */}
                  {!selectedImage.isUpscaled && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedImage(null)
                        setUpscalingImage(selectedImage)
                      }}
                      className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B]"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Upscale
                    </Button>
                  )}
                  {/* Animate button */}
                  {onAnimateImage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedImage(null)
                        onAnimateImage(selectedImage)
                      }}
                      className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B]"
                    >
                      <Video className="w-3 h-3 mr-1" />
                      Animate
                    </Button>
                  )}
                  {/* Delete button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      handleDelete(selectedImage.id, e)
                      setSelectedImage(null)
                    }}
                    className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B] hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                  {isFullScreen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleFullscreen}
                      className="h-7 text-xs px-2.5 border-[#333333] hover:bg-[#2B2B2B]"
                    >
                      <Minimize2 className="w-3 h-3 mr-1" />
                      Exit Fullscreen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Edit Modal */}
      {editingImage && (
        <ImageEditModal
          image={editingImage}
          isOpen={!!editingImage}
          onClose={() => setEditingImage(null)}
          onEditComplete={(editedImage) => {
            const updatedImages = [...images, editedImage]
            setImages(updatedImages)
            onImagesChange?.(updatedImages)
            setEditingImage(null)
            onEditComplete?.(editedImage)
          }}
          editingModel={imageEditingModel}
        />
      )}

      {/* Image Upscale Modal */}
      {upscalingImage && (
        <ImageUpscaleModal
          image={upscalingImage}
          isOpen={!!upscalingImage}
          onClose={() => setUpscalingImage(null)}
          onUpscaleComplete={(upscaledImage) => {
            const updatedImages = [...images, upscaledImage]
            setImages(updatedImages)
            onImagesChange?.(updatedImages)
            setUpscalingImage(null)
          }}
        />
      )}

      {/* Multi Image Edit Modal */}
      {showMultiEditModal && (
        <MultiImageEditModal
          images={Array.from(selectedImageIds).map(id => images.find(img => img.id === id)?.url).filter(Boolean) as string[]}
          isOpen={showMultiEditModal}
          onClose={() => {
            setShowMultiEditModal(false)
            setSelectedImageIds(new Set())
            setSelectionMode(false)
          }}
          onEditComplete={(editedImage) => {
            const updatedImages = [...images, editedImage]
            setImages(updatedImages)
            onImagesChange?.(updatedImages)
            setShowMultiEditModal(false)
            setSelectedImageIds(new Set())
            setSelectionMode(false)
          }}
        />
      )}
    </div>
  )
}
