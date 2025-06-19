'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Film, Sparkles, Clock, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoGenerationModalProps {
  open: boolean
  onClose: () => void
  onGenerate: (options: VideoGenerationOptions) => void
  initialPrompt?: string
  initialImage?: string
  suggestedWorkflow?: 'quick' | 'studio'
}

export interface VideoGenerationOptions {
  workflow: 'quick' | 'studio'
  prompt: string
  backend: 'replicate' | 'huggingface'
  model?: string
  duration?: number
  aspectRatio?: string
  startImage?: string
  negativePrompt?: string
}

const BACKEND_INFO = {
  replicate: {
    name: 'Replicate (Kling)',
    duration: '5 seconds',
    aspectRatios: ['16:9', '9:16', '1:1'],
    features: ['Image animation', 'Text-to-video', 'High quality'],
    limitations: []
  },
  huggingface: {
    name: 'HuggingFace',
    duration: 'Custom',
    aspectRatios: ['16:9', '9:16', '1:1'],
    features: ['Custom duration', 'Open source models'],
    limitations: ['May be slower']
  }
}

export function VideoGenerationModal({
  open,
  onClose,
  onGenerate,
  initialPrompt = '',
  initialImage,
  suggestedWorkflow = 'quick'
}: VideoGenerationModalProps) {
  const [workflow, setWorkflow] = useState<'quick' | 'studio'>(suggestedWorkflow)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [backend, setBackend] = useState<'replicate' | 'huggingface'>('replicate')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setWorkflow(suggestedWorkflow)
      setPrompt(initialPrompt)
      setIsGenerating(false)
    }
  }, [open, suggestedWorkflow, initialPrompt])

  // Auto-detect workflow from prompt
  useEffect(() => {
    if (prompt && !initialImage) {
      const studioKeywords = /story|narrat|script|scene|character|dialogue|voice.*over|multi.*scene/i
      if (studioKeywords.test(prompt)) {
        setWorkflow('studio')
      }
    }
  }, [prompt, initialImage])

  const handleGenerate = () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    
    const options: VideoGenerationOptions = {
      workflow,
      prompt: prompt.trim(),
      backend: workflow === 'studio' ? 'replicate' : backend,
      aspectRatio,
      negativePrompt: negativePrompt.trim(),
      startImage: initialImage
    }

    // Add duration based on backend
    if (backend === 'replicate') {
      options.duration = 5
    }

    onGenerate(options)
  }

  const selectedBackendInfo = BACKEND_INFO[backend]
  const isAspectRatioDisabled = false

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Video Generation
          </DialogTitle>
          <DialogDescription>
            Choose between quick video generation or full video studio production
          </DialogDescription>
        </DialogHeader>

        <Tabs value={workflow} onValueChange={(v) => setWorkflow(v as 'quick' | 'studio')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick" className="flex items-center gap-2">
              <Film className="h-4 w-4" />
              Quick Video
            </TabsTrigger>
            <TabsTrigger value="studio" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Video Studio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium">Quick Video Generation</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Animate images or create short clips</li>
                <li>• 5-8 second videos</li>
                <li>• Fast generation time</li>
                <li>• Simple text prompts</li>
              </ul>
            </div>

            {initialImage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Image attached - will be animated based on your prompt</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prompt">
                {initialImage ? 'Animation Prompt' : 'Video Prompt'}
              </Label>
              <Textarea
                id="prompt"
                placeholder={
                  initialImage 
                    ? "Describe how to animate this image..."
                    : "Describe the video you want to create..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backend">Model</Label>
                <Select value={backend} onValueChange={(v) => setBackend(v as any)}>
                  <SelectTrigger id="backend">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replicate">
                      <div className="flex items-center gap-2">
                        <span>Replicate (Kling)</span>
                        <span className="text-xs text-muted-foreground">5s</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="huggingface">
                      <div className="flex items-center gap-2">
                        <span>HuggingFace</span>
                        <span className="text-xs text-muted-foreground">Custom</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                <Select 
                  value={aspectRatio} 
                  onValueChange={setAspectRatio}
                  disabled={isAspectRatioDisabled}
                >
                  <SelectTrigger id="aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">
                      1:1 (Square)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Backend info */}
            <div className="rounded-lg bg-muted p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-3 w-3" />
                {selectedBackendInfo.name} - {selectedBackendInfo.duration}
              </div>
              {selectedBackendInfo.limitations.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mt-0.5" />
                  <div>{selectedBackendInfo.limitations.join(', ')}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="negative-prompt">
                Negative Prompt
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </Label>
              <Textarea
                id="negative-prompt"
                placeholder="Things to avoid in the video..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="studio" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-medium">Video Studio Production</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• AI-powered script generation</li>
                <li>• Professional voice narration</li>
                <li>• Sound effects and music</li>
                <li>• Full production pipeline</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-prompt">Story Concept</Label>
              <Textarea
                id="studio-prompt"
                placeholder="Describe the story or concept for your video..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 space-y-2">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Production Pipeline
              </h5>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>1. Gemini expands your concept into a detailed script</div>
                <div>2. Kling generates video scenes</div>
                <div>3. Professional TTS creates narration</div>
                <div>4. Lip-sync and sound effects are added</div>
                <div>5. Final video is produced with all elements</div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <>
                {workflow === 'quick' ? 'Generate Video' : 'Start Production'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}