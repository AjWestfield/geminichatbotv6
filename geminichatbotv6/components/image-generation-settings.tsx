import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Settings, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface ImageGenerationSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quality: 'standard' | 'hd'
  onQualityChange: (quality: 'standard' | 'hd') => void
  style: 'vivid' | 'natural'
  onStyleChange: (style: 'vivid' | 'natural') => void
  size: '1024x1024' | '1792x1024' | '1024x1536'
  onSizeChange: (size: '1024x1024' | '1792x1024' | '1024x1536') => void
}

export function ImageGenerationSettings({
  open,
  onOpenChange,
  quality,
  onQualityChange,
  style,
  onStyleChange,
  size,
  onSizeChange,
}: ImageGenerationSettingsProps) {
  const { toast } = useToast()

  const handleQualityChange = (newQuality: 'standard' | 'hd') => {
    console.log('Image quality changing from', quality, 'to', newQuality)
    onQualityChange(newQuality)
    
    const modelName = newQuality === 'hd' ? 'GPT-Image-1' : 'WaveSpeed AI'
    const modelDescription = newQuality === 'hd' 
      ? 'High quality generation with accurate text rendering' 
      : 'Fast image generation with good quality'
    
    toast({
      title: `Switched to ${modelName}`,
      description: modelDescription,
      duration: 3000,
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2B2B2B] border-[#4A4A4A] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Image Generation Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose your image generation model and settings
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Model Selection (via Quality) */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Generation Model</Label>
            <RadioGroup value={quality} onValueChange={(value) => handleQualityChange(value as 'standard' | 'hd')}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                  <RadioGroupItem value="hd" id="hd" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="hd" className="cursor-pointer flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      High Quality (GPT-Image-1)
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      OpenAI's multimodal model • Best quality • Accurate text rendering
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                  <RadioGroupItem value="standard" id="standard" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="standard" className="cursor-pointer flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Standard (WaveSpeed AI)
                    </Label>
                    <p className="text-xs text-gray-400 mt-1">
                      Flux Dev Ultra Fast • Very fast generation • Good quality
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Style Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Style</Label>
            <RadioGroup value={style} onValueChange={(value) => onStyleChange(value as 'vivid' | 'natural')}>
              <div className="flex gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="vivid" id="vivid" />
                  <Label htmlFor="vivid" className="cursor-pointer">Vivid (More Dramatic)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="natural" id="natural" />
                  <Label htmlFor="natural" className="cursor-pointer">Natural (More Realistic)</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Size Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Size</Label>
            <RadioGroup value={size} onValueChange={(value) => onSizeChange(value as any)}>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1024x1024" id="square" />
                  <Label htmlFor="square" className="cursor-pointer">1024×1024 (Square)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1792x1024" id="landscape" />
                  <Label htmlFor="landscape" className="cursor-pointer">
                    {quality === 'hd' ? '1536×1024' : '1792×1024'} (Landscape)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1024x1536" id="portrait" />
                  <Label htmlFor="portrait" className="cursor-pointer">
                    {quality === 'hd' ? '1024×1536' : '1024×1536'} (Portrait)
                  </Label>
                </div>
              </div>
              {quality === 'hd' && (
                <p className="text-xs text-gray-500 mt-2">
                  Note: GPT-Image-1 uses slightly different dimensions for landscape/portrait
                </p>
              )}
            </RadioGroup>
          </div>
          
          <div className="text-xs text-gray-400 bg-[#1E1E1E] p-3 rounded-lg">
            <p className="font-medium mb-1">Current Model: {quality === 'hd' ? 'GPT-Image-1' : 'WaveSpeed AI'}</p>
            {quality === 'hd' ? (
              <>
                <p>🎨 GPT-Image-1 - OpenAI's multimodal image generation</p>
                <p className="mt-1">✨ Superior quality with accurate text rendering</p>
                <p className="mt-1 text-gray-500">⚠️ Requires organization verification</p>
              </>
            ) : (
              <>
                <p>🚀 Flux Dev Ultra Fast by WaveSpeed AI</p>
                <p className="mt-1">⚡ High-speed generation in seconds</p>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} className="bg-[#4A4A4A] hover:bg-[#5A5A5A]">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
