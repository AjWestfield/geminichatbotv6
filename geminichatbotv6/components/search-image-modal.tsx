"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ExternalLink, X, Download } from "lucide-react"

interface SearchImageModalProps {
  isOpen: boolean
  onClose: () => void
  image: {
    url?: string
    image_url?: string
    title?: string
    source?: string
    origin_url?: string
    height?: number
    width?: number
  } | null
}

export function SearchImageModal({ isOpen, onClose, image }: SearchImageModalProps) {
  if (!image) return null

  const imageUrl = image.url || image.image_url || ''
  const sourceUrl = image.origin_url || image.source || ''
  const domain = sourceUrl ? new URL(sourceUrl).hostname.replace('www.', '') : ''

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = image.title || 'search-result.jpg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span className="truncate">{image.title || 'Search Result Image'}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {sourceUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(sourceUrl, '_blank')}
                  className="h-8"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Source
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative mt-4">
          <div className="overflow-auto max-h-[calc(90vh-120px)]">
            <img
              src={imageUrl}
              alt={image.title || 'Search result'}
              className="w-full h-auto"
              loading="eager"
            />
          </div>
          
          {sourceUrl && (
            <div className="mt-4 p-3 bg-accent/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                Source: <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {domain}
                </a>
              </p>
              {image.width && image.height && (
                <p className="text-sm text-muted-foreground mt-1">
                  Dimensions: {image.width} × {image.height}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
