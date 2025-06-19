"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Download, Trash2, Sparkles, Pencil, Video, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatImageTimestamp, getQualityBadgeColor } from "@/lib/image-utils"
import { toast } from "sonner"

interface ImageFocusModalProps {
  isOpen: boolean
  onClose: () => void
  image: {
    id: string
    url: string
    prompt: string
    quality: 'standard' | 'hd' | 'wavespeed'
    timestamp: Date
    model?: string
    size?: string
    isUpscaled?: boolean
  }
  onEdit?: () => void
  onAnimate?: () => void
  onUpscale?: () => void
  onDelete?: (imageId: string) => void
}

export function ImageFocusModal({
  isOpen,
  onClose,
  image,
  onEdit,
  onAnimate,
  onUpscale,
  onDelete
}: ImageFocusModalProps) {
  const [isZoomed, setIsZoomed] = React.useState(false)

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${image.prompt.slice(0, 50).replace(/[^a-z0-9]/gi, '_')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100)
      toast.success('Image downloaded successfully')
    } catch (error) {
      console.error('Failed to download image:', error)
      toast.error('Failed to download image')
    }
  }

  const handleDelete = async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this image?')) {
      onDelete(image.id)
      onClose()
      toast.success('Image deleted successfully')
    }
  }

  const formatQualityLabel = (quality: string) => {
    switch (quality) {
      case 'hd':
        return 'HD'
      case 'standard':
        return 'Standard'
      case 'wavespeed':
        return 'WaveSpeed AI'
      default:
        return quality
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Dark overlay background */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="relative z-10 w-full max-w-3xl bg-[#2B2B2B] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <h2 className="text-lg font-medium text-white">Generated Image</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Image container */}
        <div className="p-4 sm:p-6">
          <div 
            className={cn(
              "relative bg-black/40 rounded-lg overflow-hidden flex items-center justify-center",
              isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
            )}
            onClick={() => setIsZoomed(!isZoomed)}
          >
            <img
              src={image.url}
              alt={image.prompt}
              className={cn(
                "transition-all duration-200",
                isZoomed 
                  ? "max-w-none max-h-none w-auto h-auto" 
                  : "max-w-full max-h-[50vh] object-contain"
              )}
              style={isZoomed ? { maxHeight: '70vh' } : undefined}
            />
          </div>

          {/* Prompt text */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Prompt</h3>
            <p className="text-sm text-gray-200 leading-relaxed">
              {image.prompt}
            </p>
          </div>

          {/* Metadata */}
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <span className={cn(
              "px-2 py-0.5 rounded border",
              getQualityBadgeColor(image.quality)
            )}>
              quality {formatQualityLabel(image.quality)}
            </span>
            <span>Generated {formatImageTimestamp(image.timestamp)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 p-4 border-t border-[#333333] bg-[#252525]">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onEdit()
              }}
              className="border-[#333333] bg-transparent hover:bg-white/5 text-gray-300 hover:text-white"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          
          {onAnimate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onAnimate()
              }}
              className="border-[#333333] bg-transparent hover:bg-white/5 text-gray-300 hover:text-white"
            >
              <Video className="w-4 h-4 mr-2" />
              Animate
            </Button>
          )}
          
          {onUpscale && !image.isUpscaled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onUpscale()
              }}
              className="border-[#333333] bg-transparent hover:bg-white/5 text-gray-300 hover:text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Upscale
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-[#333333] bg-transparent hover:bg-white/5 text-gray-300 hover:text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="border-red-500/50 bg-transparent hover:bg-red-500/10 text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
