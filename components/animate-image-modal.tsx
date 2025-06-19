"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EnhancedTextarea } from "@/components/ui/enhanced-textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info, Loader2, Image as ImageIcon, Sparkles, Wand2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { detectImageAspectRatio, getAspectRatioDetectionReason } from "@/lib/image-utils"

interface AnimateImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  imageName?: string
  onAnimate: (params: {
    prompt: string
    duration: 5 | 10
    aspectRatio: "16:9" | "9:16" | "1:1"
    negativePrompt?: string
    model?: 'standard' | 'pro'
  }) => void
  defaultModel?: 'standard' | 'pro'
  defaultDuration?: 5 | 10
  defaultAspectRatio?: "16:9" | "9:16" | "1:1"
  isGenerating?: boolean
  enableAutoDetection?: boolean
}

export function AnimateImageModal({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  onAnimate,
  defaultModel = 'standard',
  defaultDuration = 5,
  defaultAspectRatio = '16:9',
  isGenerating = false,
  enableAutoDetection = true
}: AnimateImageModalProps) {
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState<5 | 10>(defaultDuration)
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">(defaultAspectRatio)
  const [negativePrompt, setNegativePrompt] = useState("")
  const [model, setModel] = useState<'standard' | 'pro'>(defaultModel)

  // Auto-detection state
  const [isDetectingRatio, setIsDetectingRatio] = useState(false)
  const [detectedRatio, setDetectedRatio] = useState<"16:9" | "9:16" | "1:1" | null>(null)
  const [detectionReason, setDetectionReason] = useState<string>("")
  const [isAutoDetected, setIsAutoDetected] = useState(false)

  // Auto-detect aspect ratio when modal opens or image changes
  useEffect(() => {
    if (isOpen && imageUrl && imageUrl.trim() !== '' && enableAutoDetection) {
      detectAspectRatio()
    }
  }, [isOpen, imageUrl, enableAutoDetection])

  const detectAspectRatio = async () => {
    try {
      setIsDetectingRatio(true)
      console.log('Auto-detecting aspect ratio for image:', imageUrl)

      const detected = await detectImageAspectRatio(imageUrl)
      const reason = await getAspectRatioDetectionReason(imageUrl, detected)

      setDetectedRatio(detected)
      setDetectionReason(reason)
      setAspectRatio(detected)
      setIsAutoDetected(true)

      console.log('Auto-detection complete:', { detected, reason })
    } catch (error) {
      console.error('Failed to auto-detect aspect ratio:', error)
      // Fallback to default
      setDetectedRatio(defaultAspectRatio)
      setDetectionReason(`Using default aspect ratio (${defaultAspectRatio})`)
      setIsAutoDetected(false)
    } finally {
      setIsDetectingRatio(false)
    }
  }

  // Handle manual aspect ratio change
  const handleAspectRatioChange = (newRatio: "16:9" | "9:16" | "1:1") => {
    setAspectRatio(newRatio)
    setIsAutoDetected(false) // User manually overrode auto-detection
  }

  const handleSubmit = () => {
    if (!prompt.trim()) return

    onAnimate({
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      negativePrompt: negativePrompt.trim() || undefined,
      model
    })

    // Reset form
    setPrompt("")
    setNegativePrompt("")
  }

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPrompt("")
      setNegativePrompt("")
      setDuration(defaultDuration)
      setAspectRatio(defaultAspectRatio)
      setModel(defaultModel)
      setDetectedRatio(null)
      setDetectionReason("")
      setIsAutoDetected(false)
    }
  }, [isOpen, defaultDuration, defaultAspectRatio, defaultModel])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#2B2B2B] border-[#3A3A3A] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            Animate Image
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a video animation from your image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Source Image Preview */}
          <div className="relative">
            {imageUrl && imageUrl.trim() !== '' ? (
              <img
                src={imageUrl}
                alt={imageName || "Source image"}
                className="w-full h-48 object-contain rounded-lg bg-gray-900/50 border border-[#3A3A3A]"
                onError={(e) => {
                  console.error('[AnimateImageModal] Failed to load image:', imageUrl)
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2UgTG9hZCBFcnJvcjwvdGV4dD4KPC9zdmc+'
                }}
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center rounded-lg bg-gray-900/50 border border-[#3A3A3A]">
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No image URL provided</p>
                </div>
              </div>
            )}
            {imageName && (
              <div className="mt-2 text-sm text-gray-400 text-center">{imageName}</div>
            )}
          </div>

          {/* Auto-Detection Status */}
          {(isDetectingRatio || detectedRatio) && (
            <div className="mb-4">
              {isDetectingRatio ? (
                <div className="flex items-center gap-2 text-sm text-purple-400 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing image dimensions...</span>
                </div>
              ) : isAutoDetected && (
                <div className="flex items-center gap-2 text-sm text-purple-300 bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Smart Detection:</span>
                  <span>{detectionReason}</span>
                </div>
              )}
            </div>
          )}

          {/* Animation Prompt */}
          <div>
            <Label htmlFor="animation-prompt" className="mb-2 block">
              Animation Instructions
            </Label>
            <EnhancedTextarea
              id="animation-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how you want to animate this image (e.g., 'gentle breeze moving the trees', 'slow camera zoom in', 'birds flying across the sky')..."
              context="video"
              disabled={isGenerating}
            />
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Model Selection */}
            <div>
              <Label htmlFor="model" className="mb-2 block">Model Quality</Label>
              <Select
                value={model}
                onValueChange={(v) => setModel(v as 'standard' | 'pro')}
                disabled={isGenerating}
              >
                <SelectTrigger id="model" className="bg-[#1E1E1E] border-[#3A3A3A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2B2B2B] border-[#3A3A3A]">
                  <SelectItem value="standard">Standard (720p)</SelectItem>
                  <SelectItem value="pro">Pro (1080p)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div>
              <Label htmlFor="duration" className="mb-2 block">Duration</Label>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(Number(v) as 5 | 10)}
                disabled={isGenerating}
              >
                <SelectTrigger id="duration" className="bg-[#1E1E1E] border-[#3A3A3A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2B2B2B] border-[#3A3A3A]">
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio with Enhanced Auto-Detection Display */}
            <div>
              <Label htmlFor="aspect-ratio" className="mb-2 block">
                Aspect Ratio
              </Label>
              <Select
                value={aspectRatio}
                onValueChange={handleAspectRatioChange}
                disabled={isGenerating || isDetectingRatio}
              >
                <SelectTrigger
                  id="aspect-ratio"
                  className={`bg-[#1E1E1E] border-[#3A3A3A] ${isAutoDetected ? 'border-purple-500/50 ring-1 ring-purple-500/20' : ''}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2B2B2B] border-[#3A3A3A]">
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Negative Prompt */}
          <div>
            <Label htmlFor="negative-prompt" className="mb-2 block">
              Negative Prompt <span className="text-xs text-gray-400">(Optional)</span>
            </Label>
            <EnhancedTextarea
              id="negative-prompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Things to avoid in the animation (e.g., blurry, distorted, low quality, flickering)..."
              context="video"
              disabled={isGenerating}
            />
          </div>

          {/* Info Alert */}
          <Alert className="bg-blue-500/10 border-blue-500/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Video generation takes 2-8 minutes. {model === 'pro' ? 'Pro model offers higher quality (1080p).' : 'Standard model is faster and more cost-effective (720p).'}
              {isAutoDetected && ' The aspect ratio was optimized for your image.'}
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isGenerating}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isGenerating || isDetectingRatio}
              className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Animation
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
