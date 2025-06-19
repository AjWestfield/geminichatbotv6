"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Maximize2, Sparkles, AlertCircle, DollarSign, Image as ImageIcon, RefreshCw, Bug, ExternalLink, Key } from "lucide-react"
import { GeneratedImage, generateImageId } from "@/lib/image-utils"
import { useImageProgressStore } from "@/lib/stores/image-progress-store"
import { toast } from "sonner"
import { validateImageUrl, isReplicateDeliveryUrl, isLikelyExpiredReplicateUrl } from "@/lib/image-url-validator"

interface ImageUpscaleModalProps {
  image: GeneratedImage | null
  isOpen: boolean
  onClose: () => void
  onUpscaleComplete: (upscaledImage: GeneratedImage) => void
}

const modelDescriptions = {
  'Standard V2': 'Best for general photos and images',
  'Low Resolution V2': 'Optimized for low-quality source images',
  'CGI': 'Ideal for digital art and rendered images',
  'High Fidelity V2': 'Preserves fine details and textures',
  'Text Refine': 'Enhances text clarity in documents'
}

// Cost calculation based on output megapixels
const calculateCost = (width: number, height: number, factor: string): { mp: number; units: number; cost: number } => {
  const multiplier = factor === '2x' ? 4 : factor === '4x' ? 16 : factor === '6x' ? 36 : 1
  const outputMP = (width * height * multiplier) / 1_000_000

  // Cost tiers from Topaz Labs documentation
  if (outputMP <= 24) return { mp: outputMP, units: 1, cost: 0.05 }
  if (outputMP <= 48) return { mp: outputMP, units: 2, cost: 0.10 }
  if (outputMP <= 60) return { mp: outputMP, units: 3, cost: 0.15 }
  if (outputMP <= 96) return { mp: outputMP, units: 4, cost: 0.20 }
  if (outputMP <= 132) return { mp: outputMP, units: 5, cost: 0.24 }
  if (outputMP <= 168) return { mp: outputMP, units: 6, cost: 0.29 }
  if (outputMP <= 336) return { mp: outputMP, units: 11, cost: 0.53 }
  if (outputMP <= 512) return { mp: outputMP, units: 17, cost: 0.82 }

  // For very large images, estimate based on linear scaling
  const units = Math.ceil(outputMP / 30)
  return { mp: outputMP, units, cost: units * 0.048 }
}

export function ImageUpscaleModal({
  image,
  isOpen,
  onClose,
  onUpscaleComplete
}: ImageUpscaleModalProps) {
  const [enhanceModel, setEnhanceModel] = useState<string>('Standard V2')
  const [upscaleFactor, setUpscaleFactor] = useState<string>('2x')
  const [outputFormat, setOutputFormat] = useState<string>('jpg')
  const [subjectDetection, setSubjectDetection] = useState<string>('None')
  const [faceEnhancement, setFaceEnhancement] = useState(false)
  const [faceCreativity, setFaceCreativity] = useState([0])
  const [faceStrength, setFaceStrength] = useState([0.8])
  const [isUpscaling, setIsUpscaling] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [urlValidationStatus, setUrlValidationStatus] = useState<'unknown' | 'valid' | 'expired' | 'checking'>('unknown')
  const [showUrlWarning, setShowUrlWarning] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'missing' | 'unknown'>('unknown')
  const [lastError, setLastError] = useState<{ title: string; message: string } | null>(null)

  const { addImageGeneration, updateProgress, removeProgress, updateStage } = useImageProgressStore()

  // Debug logging helper
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[ImageUpscaleModal] ${message}`)
  }

  // Check API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      setApiKeyStatus('checking')
      try {
        const response = await fetch('/api/upscale-image')
        const data = await response.json()
        if (data.available) {
          setApiKeyStatus('valid')
          addDebugLog('✅ Replicate API key is configured')
        } else {
          setApiKeyStatus('missing')
          addDebugLog('❌ Replicate API key is missing')
        }
      } catch (error) {
        setApiKeyStatus('unknown')
        addDebugLog('⚠️ Could not verify API key status')
      }
    }
    
    if (isOpen) {
      checkApiKey()
    }
  }, [isOpen])

  // Load image dimensions and validate URL when modal opens
  useEffect(() => {
    if (image && isOpen) {
      // Reset states
      setUrlValidationStatus('unknown')
      setShowUrlWarning(false)
      setLastError(null)
      setDebugLogs([])
      addDebugLog('Modal opened for image: ' + image.id)

      // Check if URL might be expired based on heuristics
      const isLikelyExpired = isLikelyExpiredReplicateUrl(image.url, image.timestamp)
      if (isLikelyExpired) {
        setShowUrlWarning(true)
        setUrlValidationStatus('expired')
        addDebugLog('⚠️ Image URL is likely expired (>24 hours old)')
      }

      const img = new Image()
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
        addDebugLog(`✅ Image loaded: ${img.width}x${img.height}`)

        // If image loads successfully, URL is valid
        if (urlValidationStatus !== 'expired') {
          setUrlValidationStatus('valid')
        }

        // Auto-detect optimal settings based on image
        if (img.width < 512 || img.height < 512) {
          setEnhanceModel('Low Resolution V2')
          setUpscaleFactor('4x')
          addDebugLog('📐 Detected low resolution image, using optimized settings')
        } else if (image.prompt?.toLowerCase().includes('text') || image.prompt?.toLowerCase().includes('document')) {
          setEnhanceModel('Text Refine')
          addDebugLog('📝 Detected text content, using Text Refine model')
        } else if (image.prompt?.toLowerCase().includes('render') || image.prompt?.toLowerCase().includes('3d') || image.model.includes('flux')) {
          setEnhanceModel('CGI')
          addDebugLog('🎨 Detected CGI/3D content, using CGI model')
        }

        // Auto-enable face enhancement if likely contains faces
        const faceKeywords = ['person', 'portrait', 'face', 'selfie', 'people', 'man', 'woman', 'child']
        const hasFaces = faceKeywords.some(kw => image.prompt?.toLowerCase().includes(kw))
        if (hasFaces) {
          setFaceEnhancement(true)
          addDebugLog('👤 Detected faces in prompt, enabling face enhancement')
        }
      }

      img.onerror = () => {
        // If image fails to load, URL is likely expired
        setUrlValidationStatus('expired')
        setShowUrlWarning(true)
        addDebugLog('❌ Image failed to load - URL likely expired')
      }

      img.src = image.url
    }
  }, [image, isOpen, urlValidationStatus])

  // Calculate cost estimate
  const costEstimate = useMemo(() => {
    if (!imageDimensions) return null
    return calculateCost(imageDimensions.width, imageDimensions.height, upscaleFactor)
  }, [imageDimensions, upscaleFactor])

  // Calculate output dimensions
  const outputDimensions = useMemo(() => {
    if (!imageDimensions) return null
    const multiplier = upscaleFactor === '2x' ? 2 : upscaleFactor === '4x' ? 4 : upscaleFactor === '6x' ? 6 : 1
    return {
      width: imageDimensions.width * multiplier,
      height: imageDimensions.height * multiplier
    }
  }, [imageDimensions, upscaleFactor])

  const handleUpscale = async () => {
    if (!image) return

    if (apiKeyStatus === 'missing') {
      setLastError({
        title: 'API Key Missing',
        message: 'Replicate API key is not configured. Please add REPLICATE_API_KEY to your .env.local file.'
      })
      return
    }

    setIsUpscaling(true)
    setLastError(null)
    const progressId = generateImageId()
    addDebugLog('Starting upscale process with ID: ' + progressId)

    // Add to progress store
    addImageGeneration(progressId, `Upscaling: ${image.prompt}`, {
      originalImageId: image.id,
      originalImageUrl: image.url,
      quality: image.quality,
      model: 'topazlabs/image-upscale'
    })

    try {
      // Pre-validate URL if it looks suspicious
      if (urlValidationStatus === 'expired' || isReplicateDeliveryUrl(image.url)) {
        updateStage(progressId, 'processing', 'Validating image URL...')
        updateProgress(progressId, {
          progress: 10
        })
        addDebugLog('🔍 Validating potentially expired URL...')

        setUrlValidationStatus('checking')
        const isValid = await validateImageUrl(image.url)

        if (!isValid) {
          setUrlValidationStatus('expired')
          addDebugLog('❌ URL validation failed - image expired')
          throw new Error('Image URL has expired. The image is no longer accessible for upscaling.')
        } else {
          setUrlValidationStatus('valid')
          setShowUrlWarning(false)
          addDebugLog('✅ URL validation successful')
        }
      }

      // Update progress
      updateStage(progressId, 'processing', `Applying ${enhanceModel} enhancement...`)
      updateProgress(progressId, {
        progress: 20
      })
      addDebugLog(`🎨 Applying ${enhanceModel} with ${upscaleFactor} upscaling`)

      const requestBody = {
        imageUrl: image.url,
        imageId: image.id,
        enhanceModel,
        upscaleFactor,
        outputFormat,
        subjectDetection,
        faceEnhancement,
        faceEnhancementCreativity: faceCreativity[0],
        faceEnhancementStrength: faceStrength[0],
        imageWidth: imageDimensions?.width,
        imageHeight: imageDimensions?.height
      }

      addDebugLog('📤 Sending request to API: ' + JSON.stringify(requestBody, null, 2))

      const response = await fetch('/api/upscale-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      addDebugLog('📥 API Response: ' + JSON.stringify(data, null, 2))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upscale image')
      }

      // Update progress
      updateStage(progressId, 'finalizing', 'Finalizing upscaled image...')
      updateProgress(progressId, {
        progress: 80
      })
      addDebugLog('🏁 Finalizing upscaled image')

      // Create the upscaled image object
      const upscaledImage: GeneratedImage = {
        id: progressId,
        url: data.imageUrl,
        prompt: image.prompt,
        revisedPrompt: `Upscaled ${upscaleFactor}: ${image.prompt}`,
        timestamp: new Date(),
        quality: image.quality,
        style: image.style,
        size: outputDimensions ? `${outputDimensions.width}x${outputDimensions.height}` : image.size,
        model: 'topazlabs/image-upscale',
        originalImageId: image.id,
        isUpscaled: true,
        upscaleSettings: {
          factor: upscaleFactor as any,
          model: enhanceModel as any,
          subjectDetection: subjectDetection as any,
          faceEnhancement,
          faceEnhancementCreativity: faceCreativity[0],
          faceEnhancementStrength: faceStrength[0],
          sourceImageId: image.id,
          outputMegapixels: costEstimate?.mp,
          cost: costEstimate?.cost
        },
        metadata: data.metadata
      }

      // Complete the progress
      updateProgress(progressId, {
        status: 'completed',
        progress: 100,
        stage: 'completed',
        generatedImage: upscaledImage
      })

      addDebugLog('✅ Upscale completed successfully!')
      onUpscaleComplete(upscaledImage)
      toast.success(`Image upscaled ${upscaleFactor} successfully!`)
      onClose()
    } catch (error: any) {
      console.error('Upscaling error:', error)
      addDebugLog('❌ Error: ' + error.message)

      updateProgress(progressId, {
        status: 'failed',
        stage: 'failed',
        error: error.message
      })

      // Enhanced error handling with specific messages
      let errorTitle = 'Upscaling Failed'
      let errorMessage = error.message || 'Failed to upscale image'

      if (error.message?.includes('URL expired') || error.message?.includes('expired')) {
        errorTitle = 'Image URL Expired'
        errorMessage = 'This image URL is no longer accessible. Try saving the image and uploading it again.'
        setUrlValidationStatus('expired')
        setShowUrlWarning(true)
      } else if (error.message?.includes('rate_limit')) {
        errorTitle = 'Rate Limit Exceeded'
        errorMessage = 'Too many requests. Please wait a moment and try again.'
      } else if (error.message?.includes('404') && error.message?.includes('replicate')) {
        errorTitle = 'Replicate Image Not Found'
        errorMessage = 'The image URL has expired. Replicate images are only available for 24 hours.'
        setUrlValidationStatus('expired')
        setShowUrlWarning(true)
      } else if (error.message?.includes('API key')) {
        errorTitle = 'API Key Issue'
        errorMessage = 'There\'s a problem with the Replicate API key. Check your configuration.'
        setApiKeyStatus('missing')
      }

      setLastError({ title: errorTitle, message: errorMessage })
      
      toast.error(errorTitle, {
        description: errorMessage,
        duration: 5000
      })

      // Remove progress after delay
      setTimeout(() => {
        removeProgress(progressId)
      }, 3000)
    } finally {
      setIsUpscaling(false)
    }
  }

  if (!image) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Maximize2 className="w-5 h-5" />
              Upscale Image
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDebugMode(!debugMode)}
              className="h-8 w-8"
              title={debugMode ? "Hide debug info" : "Show debug info"}
            >
              <Bug className={debugMode ? "w-4 h-4 text-purple-500" : "w-4 h-4"} />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Enhance and upscale your image using professional AI technology
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* API Key Warning */}
          {apiKeyStatus === 'missing' && (
            <Alert className="border-red-500/50 bg-red-500/10">
              <Key className="h-4 w-4 text-red-500" />
              <AlertTitle className="text-red-700 dark:text-red-300">API Key Missing</AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-400">
                <p className="mb-2">
                  Replicate API key is not configured. The upscale feature requires a valid API key.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://replicate.com/account/api-tokens', '_blank')}
                    className="text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Get API Key
                  </Button>
                  <span className="text-xs">Add to .env.local: REPLICATE_API_KEY=your_key</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {lastError && (
            <Alert className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertTitle className="text-red-700 dark:text-red-300">{lastError.title}</AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-400">
                {lastError.message}
              </AlertDescription>
            </Alert>
          )}

          {/* URL Warning Alert */}
          {showUrlWarning && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                <div className="space-y-2">
                  <p className="font-medium">Image URL May Be Expired</p>
                  <p className="text-sm">
                    {isReplicateDeliveryUrl(image?.url || '')
                      ? 'This Replicate-generated image may have expired (24-hour limit). The upscaling process will attempt to recover the image automatically.'
                      : 'This image URL may no longer be accessible. The upscaling process will attempt to recover the image automatically.'
                    }
                  </p>
                  {urlValidationStatus === 'checking' && (
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Checking URL accessibility...
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Debug Logs */}
          {debugMode && (
            <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
              <h4 className="text-xs font-mono text-gray-400 mb-2">Debug Logs:</h4>
              {debugLogs.length === 0 ? (
                <p className="text-xs font-mono text-gray-500">No logs yet...</p>
              ) : (
                <div className="space-y-1">
                  {debugLogs.map((log, index) => (
                    <p key={index} className="text-xs font-mono text-gray-300">{log}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Image Preview and Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Current</Label>
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={image.url}
                  alt={image.prompt}
                  className="w-full h-full object-contain"
                />
              </div>
              {imageDimensions && (
                <p className="text-xs text-muted-foreground text-center">
                  {imageDimensions.width}×{imageDimensions.height}
                  <br />({(imageDimensions.width * imageDimensions.height / 1_000_000).toFixed(1)}MP)
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Output</Label>
              <div className="relative aspect-square bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/50" />
                  {outputDimensions && (
                    <>
                      <p className="text-xs font-medium">
                        {outputDimensions.width}×{outputDimensions.height}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(outputDimensions.width * outputDimensions.height / 1_000_000).toFixed(1)}MP
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Settings & Cost</Label>
              <div className="space-y-2">
                <Select value={enhanceModel} onValueChange={setEnhanceModel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelDescriptions).map(([model, description]) => (
                      <SelectItem key={model} value={model}>
                        <div>
                          <div className="font-medium text-xs">{model}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={upscaleFactor} onValueChange={setUpscaleFactor}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None (Enhance Only)</SelectItem>
                    <SelectItem value="2x">2x</SelectItem>
                    <SelectItem value="4x">4x</SelectItem>
                    <SelectItem value="6x">6x</SelectItem>
                  </SelectContent>
                </Select>
                {costEstimate && (
                  <div className="bg-muted/50 rounded p-2">
                    <div className="flex items-center gap-1 text-xs">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">${costEstimate.cost.toFixed(2)}</span>
                      <Badge variant="secondary" className="text-xs h-4 px-1">
                        {costEstimate.units} unit{costEstimate.units !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Settings in Grid */}
          <div className="grid grid-cols-2 gap-4">

            {/* Face Enhancement */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Face Enhancement</Label>
                <Switch
                  checked={faceEnhancement}
                  onCheckedChange={setFaceEnhancement}
                />
              </div>

              {faceEnhancement && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Creativity</Label>
                      <span className="text-xs text-muted-foreground">{faceCreativity[0].toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={faceCreativity}
                      onValueChange={setFaceCreativity}
                      className="h-1"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Strength</Label>
                      <span className="text-xs text-muted-foreground">{faceStrength[0].toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={faceStrength}
                      onValueChange={setFaceStrength}
                      className="h-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Other Settings */}
            <div className="space-y-2">
              <div className="space-y-2">
                <Label className="text-sm">Subject Detection</Label>
                <Select value={subjectDetection} onValueChange={setSubjectDetection}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Foreground">Foreground</SelectItem>
                    <SelectItem value="Background">Background</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Output Format</Label>
                <RadioGroup value={outputFormat} onValueChange={setOutputFormat} className="flex gap-4">
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="jpg" id="jpg" />
                    <Label htmlFor="jpg" className="text-xs font-normal cursor-pointer">JPG</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="png" id="png" />
                    <Label htmlFor="png" className="text-xs font-normal cursor-pointer">PNG</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Warning for large outputs */}
          {outputDimensions && outputDimensions.width * outputDimensions.height > 50_000_000 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will create a very large image ({(outputDimensions.width * outputDimensions.height / 1_000_000).toFixed(0)}MP).
                Processing may take longer and cost more.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpscaling}>
            Cancel
          </Button>
          <Button
            onClick={handleUpscale}
            disabled={isUpscaling || !imageDimensions || urlValidationStatus === 'checking' || apiKeyStatus === 'missing'}
            className="gap-2"
            variant={urlValidationStatus === 'expired' || apiKeyStatus === 'missing' ? 'destructive' : 'default'}
          >
            {isUpscaling ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {urlValidationStatus === 'checking' ? 'Validating URL...' : 'Upscaling...'}
              </>
            ) : urlValidationStatus === 'checking' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking URL...
              </>
            ) : urlValidationStatus === 'expired' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Try Upscale Anyway
              </>
            ) : apiKeyStatus === 'missing' ? (
              <>
                <Key className="w-4 h-4" />
                API Key Required
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Upscale Image
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}