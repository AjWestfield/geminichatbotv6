"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Settings, Image, Server, Upload, Plus, Trash2, Play, Square, FileJson, AlertCircle, CheckCircle2, Loader2, Wrench, Info, Video, Cookie } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useMCPServers } from '@/hooks/mcp/use-mcp-servers'
import { MCPServerConfig } from '@/lib/mcp/mcp-client'
import { MCPJSONParser } from '@/lib/mcp/mcp-json-parser'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useMCPState } from '@/hooks/use-mcp-state'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Image generation settings
  imageGenerationModel: string
  onImageGenerationModelChange: (model: string) => void
  imageEditingModel: string
  onImageEditingModelChange: (model: string) => void
  imageStyle: 'vivid' | 'natural'
  onImageStyleChange: (style: 'vivid' | 'natural') => void
  imageSize: '1024x1024' | '1792x1024' | '1024x1536'
  onImageSizeChange: (size: '1024x1024' | '1792x1024' | '1024x1536') => void
  imageQuality: 'standard' | 'hd' | 'wavespeed'
  onImageQualityChange: (quality: 'standard' | 'hd' | 'wavespeed') => void
  // Video generation settings
  videoModel?: 'standard' | 'pro' | 'fast'
  onVideoModelChange?: (model: 'standard' | 'pro' | 'fast') => void
  videoDuration?: 5 | 10
  onVideoDurationChange?: (duration: 5 | 10) => void
  videoAspectRatio?: '16:9' | '9:16' | '1:1'
  onVideoAspectRatioChange?: (ratio: '16:9' | '9:16' | '1:1') => void
  videoBackend?: 'replicate' | 'huggingface'
  onVideoBackendChange?: (backend: 'replicate' | 'huggingface') => void
  videoTier?: 'fast' | 'quality'
  onVideoTierChange?: (tier: 'fast' | 'quality') => void
  // Optional initial tab
  initialTab?: 'image' | 'mcp' | 'video'
  autoDetectAspectRatio: boolean
  onAutoDetectAspectRatioChange?: (checked: boolean) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  imageGenerationModel,
  onImageGenerationModelChange,
  imageEditingModel,
  onImageEditingModelChange,
  imageStyle,
  onImageStyleChange,
  imageSize,
  onImageSizeChange,
  imageQuality,
  onImageQualityChange,
  videoModel = 'standard',
  onVideoModelChange,
  videoDuration = 5,
  onVideoDurationChange,
  videoAspectRatio = '16:9',
  onVideoAspectRatioChange,
  videoBackend = 'replicate',
  onVideoBackendChange,
  videoTier = 'fast',
  onVideoTierChange,
  initialTab,
  autoDetectAspectRatio,
  onAutoDetectAspectRatioChange,
}: SettingsDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'image')
  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [manualServerForm, setManualServerForm] = useState({
    name: '',
    command: '',
    args: '',
    env: ''
  })
  
  // Local state for staged changes
  const [stagedImageGenerationModel, setStagedImageGenerationModel] = useState(imageGenerationModel)
  const [stagedImageEditingModel, setStagedImageEditingModel] = useState(imageEditingModel)
  const [stagedImageStyle, setStagedImageStyle] = useState(imageStyle)
  const [stagedImageSize, setStagedImageSize] = useState(imageSize)
  const [stagedImageQuality, setStagedImageQuality] = useState(imageQuality)
  const [stagedVideoModel, setStagedVideoModel] = useState(videoModel)
  const [stagedVideoDuration, setStagedVideoDuration] = useState(videoDuration)
  const [stagedVideoAspectRatio, setStagedVideoAspectRatio] = useState(videoAspectRatio)
  const [stagedVideoBackend, setStagedVideoBackend] = useState(videoBackend)
  const [stagedVideoTier, setStagedVideoTier] = useState(videoTier)
  const [stagedAutoDetectAspectRatio, setStagedAutoDetectAspectRatio] = useState(autoDetectAspectRatio)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  
  // Reset staged values when dialog opens
  useEffect(() => {
    if (open) {
      setStagedImageGenerationModel(imageGenerationModel)
      setStagedImageEditingModel(imageEditingModel)
      setStagedImageStyle(imageStyle)
      setStagedImageSize(imageSize)
      setStagedImageQuality(imageQuality)
      setStagedVideoModel(videoModel)
      setStagedVideoDuration(videoDuration)
      setStagedVideoAspectRatio(videoAspectRatio)
      setStagedVideoBackend(videoBackend)
      setStagedVideoTier(videoTier)
      setStagedAutoDetectAspectRatio(autoDetectAspectRatio)
      setHasUnsavedChanges(false)
    }
  }, [open, imageGenerationModel, imageEditingModel, imageStyle, imageSize, imageQuality, videoModel, videoDuration, videoAspectRatio, videoBackend, videoTier, autoDetectAspectRatio])
  
  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = 
      stagedImageGenerationModel !== imageGenerationModel ||
      stagedImageEditingModel !== imageEditingModel ||
      stagedImageStyle !== imageStyle ||
      stagedImageSize !== imageSize ||
      stagedImageQuality !== imageQuality ||
      stagedVideoModel !== videoModel ||
      stagedVideoDuration !== videoDuration ||
      stagedVideoAspectRatio !== videoAspectRatio ||
      stagedVideoBackend !== videoBackend ||
      stagedVideoTier !== videoTier ||
      stagedAutoDetectAspectRatio !== autoDetectAspectRatio
      
    setHasUnsavedChanges(hasChanges)
  }, [stagedImageGenerationModel, stagedImageEditingModel, stagedImageStyle, stagedImageSize, stagedImageQuality, stagedVideoModel, stagedVideoDuration, stagedVideoAspectRatio, stagedVideoBackend, stagedVideoTier, stagedAutoDetectAspectRatio, imageGenerationModel, imageEditingModel, imageStyle, imageSize, imageQuality, videoModel, videoDuration, videoAspectRatio, videoBackend, videoTier, autoDetectAspectRatio])

  const {
    servers,
    loading,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    getServerTools,
  } = useMCPServers()

  const mcpState = useMCPState()

  // Update active tab when dialog opens with a specific tab
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  // Auto-connect servers when enabled by default
  useEffect(() => {
    if (mcpState.autoConnectByDefault) {
      servers.forEach(server => {
        const serverState = mcpState.servers[server.id]
        if (serverState?.enabled && server.status === 'disconnected') {
          connectServer(server.id).catch(console.error)
        }
      })
    }
  }, [servers, mcpState.autoConnectByDefault, mcpState.servers, connectServer])

  const handleImageQualityChange = (newQuality: 'standard' | 'hd' | 'wavespeed') => {
    onImageQualityChange(newQuality)

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

  const handleJSONImport = async () => {
    setIsImporting(true)
    setParseError(null)

    try {
      // Use intelligent analysis API
      const response = await fetch('/api/mcp/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: jsonInput, type: 'json' })
      })

      const result = await response.json()

      if (!result.success || !result.correctedJSON) {
        throw new Error(result.errors?.join('. ') || 'Failed to parse configuration')
      }

      // Show suggestions if any
      if (result.suggestions && result.suggestions.length > 0) {
        toast({
          title: "Configuration Notes",
          description: result.suggestions.join('. '),
        })
      }

      // Parse the corrected JSON to get servers array
      let servers: any[] = []
      console.log('[Settings] Corrected JSON structure:', result.correctedJSON)

      if (Array.isArray(result.correctedJSON)) {
        servers = result.correctedJSON
      } else if (result.correctedJSON.mcpServers) {
        servers = Object.entries(result.correctedJSON.mcpServers).map(([name, cfg]: [string, any]) => ({ name, ...cfg }))
      } else if (result.correctedJSON.servers) {
        servers = result.correctedJSON.servers
      } else {
        // Single server object
        servers = [result.correctedJSON]
      }

      console.log('[Settings] Parsed servers:', servers)

      if (servers.length === 0) {
        throw new Error('No valid servers found in configuration')
      }

      // Add servers and auto-connect them
      let successCount = 0
      const errors: string[] = []

      for (const server of servers) {
        try {
          // Ensure server has an ID before adding
          const serverWithId = {
            ...server,
            id: server.id || `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          }

          console.log('[Settings] Adding server with ID:', serverWithId)
          const addedServer = await addServer(serverWithId)

          // Initialize and auto-connect the server after adding if it has an ID
          if (addedServer?.id) {
            // Initialize server in global state
            mcpState.initializeServer(addedServer.id, server.name)
            mcpState.setServerEnabled(addedServer.id, true)

            // Auto-connect if enabled
            if (mcpState.autoConnectByDefault) {
              console.log('[Settings] Connecting to server:', addedServer.id)
              await connectServer(addedServer.id)
            }
          }
          successCount++
        } catch (error) {
          console.error('[Settings] Error adding server:', server, error)
          errors.push(`${server.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        toast({
          title: "✅ Import successful",
          description: `Added and connected ${successCount} MCP server(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
          duration: 5000,
        })
      }

      if (errors.length > 0) {
        toast({
          title: "⚠️ Some servers failed",
          description: errors.join('\n'),
          variant: "destructive",
          duration: 8000,
        })
      }

      // Clear input on success
      if (successCount > 0) {
        setJsonInput('')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid JSON format"
      setParseError(errorMessage)
      toast({
        title: "❌ Import failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setJsonInput(text)
      toast({
        title: "File loaded",
        description: "Review the configuration and click Import",
      })
    } catch (error) {
      toast({
        title: "Failed to read file",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      })
    }
  }

  const handleManualAdd = async () => {
    try {
      const args = manualServerForm.args
        .split('\n')
        .filter(Boolean)
        .map(arg => arg.trim())

      const envPairs = manualServerForm.env
        .split('\n')
        .filter(Boolean)
        .map(line => line.trim().split('='))
        .filter(pair => pair.length === 2)

      const env = envPairs.reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

      const config: MCPServerConfig = {
        id: `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: manualServerForm.name.trim(),
        command: manualServerForm.command.trim(),
        args: args.length > 0 ? args : undefined,
        env: Object.keys(env).length > 0 ? env : undefined,
      }

      const addedServer = await addServer(config)

      // Initialize and enable in global state
      if (config.id) {
        mcpState.initializeServer(config.id, config.name)
        mcpState.setServerEnabled(config.id, true)

        // Auto-connect if enabled
        if (mcpState.autoConnectByDefault) {
          await connectServer(config.id)
        }
      }

      // Reset form
      setManualServerForm({
        name: '',
        command: '',
        args: '',
        env: ''
      })

      toast({
        title: "Server added",
        description: `${config.name} has been added successfully${mcpState.autoConnectByDefault ? ' and connecting...' : ''}`,
      })
    } catch (error) {
      toast({
        title: "Failed to add server",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      })
    }
  }

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      // Show confirmation dialog if there are unsaved changes
      setShowDiscardDialog(true)
    } else {
      onOpenChange(newOpen)
    }
  }
  
  const handleDiscardChanges = () => {
    // Reset staged values
    setStagedImageGenerationModel(imageGenerationModel)
    setStagedImageEditingModel(imageEditingModel)
    setStagedImageStyle(imageStyle)
    setStagedImageSize(imageSize)
    setStagedImageQuality(imageQuality)
    setStagedVideoModel(videoModel)
    setStagedVideoDuration(videoDuration)
    setStagedVideoAspectRatio(videoAspectRatio)
    setStagedVideoBackend(videoBackend)
    setStagedVideoTier(videoTier)
    setStagedAutoDetectAspectRatio(autoDetectAspectRatio)
    setHasUnsavedChanges(false)
    setShowDiscardDialog(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="bg-[#2B2B2B] border-[#4A4A4A] text-white max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-sm font-normal text-yellow-500">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span>Unsaved</span>
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Configure image generation, video generation, and MCP servers
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'video' | 'cookies' | 'mcp')} className="flex-1">
          <TabsList className="grid w-full grid-cols-4 bg-[#1E1E1E]">
            <TabsTrigger value="image" className="data-[state=active]:bg-[#3C3C3C]">
              <Image className="w-4 h-4 mr-2" />
              Image
            </TabsTrigger>
            <TabsTrigger value="video" className="data-[state=active]:bg-[#3C3C3C]">
              <Video className="w-4 h-4 mr-2" />
              Video
            </TabsTrigger>
            <TabsTrigger value="cookies" className="data-[state=active]:bg-[#3C3C3C]">
              <Cookie className="w-4 h-4 mr-2" />
              Cookies
            </TabsTrigger>
            <TabsTrigger value="mcp" className="data-[state=active]:bg-[#3C3C3C]">
              <Server className="w-4 h-4 mr-2" />
              MCP
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 overflow-y-auto max-h-[50vh]">
            <TabsContent value="image" className="space-y-6">
              {/* Model Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Generation Model</Label>
                <RadioGroup value={stagedImageGenerationModel} onValueChange={(value) => {
                  setStagedImageGenerationModel(value)
                }}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="gpt-image-1" id="gen-gpt-image-1" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="gen-gpt-image-1" className="cursor-pointer">
                          High Quality (GPT-Image-1)
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          OpenAI's multimodal model • Best quality • Accurate text rendering
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="flux-kontext-max" id="gen-flux-kontext-max" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="gen-flux-kontext-max" className="cursor-pointer">
                          Flux Kontext Max
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Maximum performance and improved typography generation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="flux-kontext-pro" id="gen-flux-kontext-pro" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="gen-flux-kontext-pro" className="cursor-pointer">
                          Flux Kontext Pro
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Excellent prompt following and consistent results
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="flux-dev-ultra-fast" id="gen-flux-dev-ultra-fast" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="gen-flux-dev-ultra-fast" className="cursor-pointer">
                          WaveSpeed AI
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Fast image generation with Flux Dev Ultra Fast model
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Editing Model Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Editing Model</Label>
                <RadioGroup value={stagedImageEditingModel} onValueChange={(value) => {
                  setStagedImageEditingModel(value)
                }}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="gpt-image-1" id="edit-gpt-image-1" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="edit-gpt-image-1" className="cursor-pointer">
                          High Quality (GPT-Image-1)
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          OpenAI's multimodal model • Best for general purpose editing
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="flux-kontext-max" id="edit-flux-kontext-max" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="edit-flux-kontext-max" className="cursor-pointer">
                          Flux Kontext Max
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Best for typography and high-performance edits
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="flux-kontext-pro" id="edit-flux-kontext-pro" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="edit-flux-kontext-pro" className="cursor-pointer">
                          Flux Kontext Pro
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Best for prompt following and consistent results
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Style Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Style</Label>
                <RadioGroup value={stagedImageStyle} onValueChange={(value) => {
                  setStagedImageStyle(value as 'vivid' | 'natural')
                }}>
                  <div className="flex gap-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="vivid" id="vivid" />
                      <Label htmlFor="vivid" className="cursor-pointer">Vivid</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="natural" id="natural" />
                      <Label htmlFor="natural" className="cursor-pointer">Natural</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Size Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Size</Label>
                <RadioGroup value={stagedImageSize} onValueChange={(value) => {
                  setStagedImageSize(value as any)
                }}>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1024x1024" id="square" />
                      <Label htmlFor="square" className="cursor-pointer">Square (1024×1024)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1792x1024" id="landscape" />
                      <Label htmlFor="landscape" className="cursor-pointer">Landscape (1792×1024)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1024x1536" id="portrait" />
                      <Label htmlFor="portrait" className="cursor-pointer">Portrait (1024×1536)</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Auto Aspect Ratio Detection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-300">Auto Aspect Ratio Detection</Label>
                <div className="flex items-center space-x-3 p-3 rounded border border-[#3A3A3A] hover:border-[#4A4A4A]">
                  <Checkbox
                    id="auto-aspect-ratio"
                    checked={stagedAutoDetectAspectRatio}
                    onCheckedChange={(checked) => setStagedAutoDetectAspectRatio(checked as boolean)}
                    aria-labelledby="auto-aspect-ratio-label"
                  />
                  <div className="flex-1">
                    <Label htmlFor="auto-aspect-ratio" id="auto-aspect-ratio-label" className="cursor-pointer text-sm">
                      Automatically detect optimal aspect ratio from source images
                    </Label>
                    <p className="text-xs text-gray-500 mt-1">
                      When enabled, the system will analyze your image dimensions and automatically select the best matching video aspect ratio (16:9, 9:16, or 1:1).
                    </p>
                  </div>
                </div>
              </div>

              {/* Default Aspect Ratio */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-300">Default Aspect Ratio</Label>
                <p className="text-xs text-gray-500">Used when auto-detection is disabled or fails</p>
              </div>
            </TabsContent>

            <TabsContent value="video" className="space-y-6">
              {/* Backend Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Video Generation Backend</Label>
                <RadioGroup value={stagedVideoBackend} onValueChange={(value) => {
                  setStagedVideoBackend(value as 'replicate' | 'huggingface')
                }}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="replicate" id="backend-replicate" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="backend-replicate" className="cursor-pointer">
                          Replicate (Kling Models)
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Kling v1.6 Standard/Pro • Easy setup • Pay per generation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                      <RadioGroupItem value="huggingface" id="backend-huggingface" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="backend-huggingface" className="cursor-pointer">
                          HuggingFace (HunyuanVideo)
                        </Label>
                        <p className="text-xs text-gray-400 mt-1">
                          Private endpoints • Fast/Quality tiers • Better for high volume
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* HuggingFace Tier Selection (only show when HF is selected) */}
              {stagedVideoBackend === 'huggingface' && (
                <div>
                  <Label className="text-sm font-medium mb-3 block">HuggingFace Tier</Label>
                  <RadioGroup value={stagedVideoTier} onValueChange={(value) => setStagedVideoTier(value as 'fast' | 'quality')}>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                        <RadioGroupItem value="fast" id="tier-fast" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="tier-fast" className="cursor-pointer">
                            Fast (L40 S GPU)
                          </Label>
                          <p className="text-xs text-gray-400 mt-1">
                            ~3 min generation • Always warm • $1.80/hour idle cost
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                        <RadioGroupItem value="quality" id="tier-quality" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="tier-quality" className="cursor-pointer">
                            Quality (H100 GPU)
                          </Label>
                          <p className="text-xs text-gray-400 mt-1">
                            ~6 min total • Cold start • ~$1 per video • No idle cost
                          </p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Model Selection */}
              <div>
                  <Label className="text-sm font-medium mb-3 block">Video Generation Model</Label>
                  <RadioGroup value={stagedVideoModel} onValueChange={(value) => setStagedVideoModel(value as 'standard' | 'pro')}>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                        <RadioGroupItem value="standard" id="video-standard" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="video-standard" className="cursor-pointer">
                            Standard (Kling v1.6)
                          </Label>
                          <p className="text-xs text-gray-400 mt-1">
                            720p resolution • Text-to-video & Image-to-video • Lower cost
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border border-[#3A3A3A] hover:border-[#4A4A4A] transition-colors">
                        <RadioGroupItem value="pro" id="video-pro" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="video-pro" className="cursor-pointer">
                            Pro (Kling v1.6 Pro)
                          </Label>
                          <p className="text-xs text-gray-400 mt-1">
                            1080p resolution • Image-to-video focus • Highest quality
                          </p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

              {/* Duration Selection */}
              <div>
                <Label htmlFor="video-duration" className="text-sm font-medium mb-3 block">Default Duration</Label>
                <Select value={stagedVideoDuration.toString()} onValueChange={(value) => setStagedVideoDuration(Number(value) as 5 | 10)}>
                  <SelectTrigger id="video-duration" className="bg-[#1E1E1E] border-[#3A3A3A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2B2B2B] border-[#3A3A3A]">
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Default Aspect Ratio</Label>
                <RadioGroup value={stagedVideoAspectRatio} onValueChange={(value) => setStagedVideoAspectRatio(value as '16:9' | '9:16' | '1:1')}>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-2 rounded border border-[#3A3A3A] hover:border-[#4A4A4A]">
                      <RadioGroupItem value="16:9" id="video-landscape" />
                      <Label htmlFor="video-landscape" className="cursor-pointer">16:9 (Landscape)</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded border border-[#3A3A3A] hover:border-[#4A4A4A]">
                      <RadioGroupItem value="9:16" id="video-portrait" />
                      <Label htmlFor="video-portrait" className="cursor-pointer">9:16 (Portrait)</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded border border-[#3A3A3A] hover:border-[#4A4A4A]">
                      <RadioGroupItem value="1:1" id="video-square" />
                      <Label htmlFor="video-square" className="cursor-pointer">1:1 (Square)</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Info Box */}
              <Alert className="bg-blue-500/10 border-blue-500/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Note:</strong>
                  {stagedVideoBackend === 'replicate'
                    ? ' Video generation requires a Replicate API key. Videos typically take 2-8 minutes to generate depending on duration.'
                    : ' HuggingFace endpoints require setup. Run scripts/setup-huggingface-endpoints.sh to provision your endpoints.'}
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="cookies" className="space-y-4">
              <div className="text-center py-8">
                <Cookie className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Cookie Management</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Save your authentication cookies for automatic social media downloads
                </p>
                <Button
                  onClick={() => window.open('/settings/cookies', '_blank')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Open Cookie Manager
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="mcp" className="space-y-4">
              {/* Default Settings */}
              <div className="space-y-4 pb-4 border-b border-[#3A3A3A]">
                <h3 className="text-sm font-medium">Default Settings</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-connect" className="text-sm font-medium cursor-pointer">
                      Auto-connect servers by default
                    </Label>
                    <p className="text-xs text-gray-400">
                      Automatically connect to servers when they are enabled
                    </p>
                  </div>
                  <Switch
                    id="auto-connect"
                    checked={mcpState.autoConnectByDefault}
                    onCheckedChange={mcpState.setAutoConnectByDefault}
                  />
                </div>
              </div>

              {/* Import Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Import MCP Configuration</h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="json-input">JSON Configuration</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const examples = MCPJSONParser.getExamples()
                        const exampleFormat = Object.keys(examples)[0]
                        setJsonInput(examples[exampleFormat])
                      }}
                      className="text-xs h-7"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      Show Example
                    </Button>
                  </div>
                  <Textarea
                    id="json-input"
                    placeholder={`Paste any MCP configuration format:
• Claude Desktop format
• Array of servers
• Single server object
• NPX package shortcuts

Supports all standard MCP configuration formats!`}
                    value={jsonInput}
                    onChange={(e) => {
                      setJsonInput(e.target.value)
                      setParseError(null)
                    }}
                    className={`bg-[#1E1E1E] border-[#3A3A3A] font-mono text-sm h-32 ${parseError ? 'border-red-500' : ''}`}
                  />
                  {parseError && (
                    <Alert className="mt-2 bg-red-500/10 border-red-500/50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{parseError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-[#3A3A3A]"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Load from File
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleJSONImport}
                      disabled={!jsonInput.trim() || isImporting}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileJson className="w-4 h-4 mr-2" />
                          Import & Connect
                        </>
                      )}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                    aria-label="Select JSON configuration file to import"
                  />
                </div>
              </div>

              <div className="border-t border-[#3A3A3A] pt-4">
                <h3 className="text-sm font-medium mb-3">Add Server Manually</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="server-name">Name</Label>
                    <Input
                      id="server-name"
                      value={manualServerForm.name}
                      onChange={(e) => setManualServerForm({...manualServerForm, name: e.target.value})}
                      className="bg-[#1E1E1E] border-[#3A3A3A]"
                      placeholder="My MCP Server"
                    />
                  </div>
                  <div>
                    <Label htmlFor="server-command">Command</Label>
                    <Input
                      id="server-command"
                      value={manualServerForm.command}
                      onChange={(e) => setManualServerForm({...manualServerForm, command: e.target.value})}
                      className="bg-[#1E1E1E] border-[#3A3A3A]"
                      placeholder="node server.js"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleManualAdd}
                    disabled={!manualServerForm.name || !manualServerForm.command}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Server
                  </Button>
                </div>
              </div>

              {/* Server List */}
              <div className="border-t border-[#3A3A3A] pt-4">
                <h3 className="text-sm font-medium mb-3">Configured Servers</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {servers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No MCP servers configured</p>
                  ) : (
                    servers.map((server) => {
                      const tools = getServerTools(server.id)
                      const isConnecting = server.status === 'connecting'
                      const isConnected = server.status === 'connected'
                      const hasError = server.status === 'error'
                      const serverState = mcpState.servers[server.id]
                      const isEnabled = serverState?.enabled ?? mcpState.autoConnectByDefault

                      return (
                        <Collapsible key={server.id}>
                          <Card className="bg-[#1E1E1E] border-[#3A3A3A] overflow-hidden">
                            <div className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  {isConnecting ? (
                                    <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                                  ) : isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : hasError ? (
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <Server className="w-4 h-4 text-gray-400" />
                                  )}
                                  <span className="font-medium">{server.name}</span>
                                  {!isEnabled && (
                                    <Badge variant="outline" className="text-xs">Disabled</Badge>
                                  )}
                                  {isEnabled && isConnected && (
                                    <Badge variant="default" className="text-xs bg-green-600">Connected</Badge>
                                  )}
                                  {isEnabled && isConnecting && (
                                    <Badge variant="secondary" className="text-xs">Connecting...</Badge>
                                  )}
                                  {isEnabled && hasError && (
                                    <Badge variant="destructive" className="text-xs">Error</Badge>
                                  )}
                                  {isConnected && tools.length > 0 && (
                                    <CollapsibleTrigger className="ml-auto mr-2">
                                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-[#3A3A3A]">
                                        <Wrench className="w-3 h-3 mr-1" />
                                        {tools.length} tools
                                      </Badge>
                                    </CollapsibleTrigger>
                                  )}
                                </div>
                                <div className="flex gap-1 items-center">
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={async (checked) => {
                                      mcpState.setServerEnabled(server.id, checked)
                                      if (checked && server.status === 'disconnected') {
                                        await connectServer(server.id)
                                      } else if (!checked && server.status === 'connected') {
                                        await disconnectServer(server.id)
                                      }
                                    }}
                                    className="mr-2"
                                  />
                                  {isEnabled && (
                                    <>
                                      {server.status === 'disconnected' || hasError ? (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => connectServer(server.id)}
                                          className="h-7 w-7"
                                          disabled={isConnecting}
                                        >
                                          <Play className="w-3 h-3" />
                                        </Button>
                                      ) : (
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => disconnectServer(server.id)}
                                          className="h-7 w-7"
                                          disabled={isConnecting}
                                        >
                                          <Square className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={async () => {
                                      if (isConnected) {
                                        const confirmDelete = window.confirm(
                                          `Server "${server.name}" is currently connected. Are you sure you want to remove it?`
                                        );
                                        if (!confirmDelete) return;
                                      }
                                      try {
                                        await removeServer(server.id);
                                        toast({
                                          title: "Server removed",
                                          description: `${server.name} has been removed successfully`,
                                        });
                                      } catch (error) {
                                        toast({
                                          title: "Failed to remove server",
                                          description: error instanceof Error ? error.message : "Unknown error",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                    disabled={isConnecting}
                                    title={isConnecting ? "Cannot remove while connecting" : "Remove server"}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-1 font-mono">
                                {server.command} {server.args?.join(' ') || ''}
                              </p>
                              {server.error && (
                                <p className="text-xs text-red-400 mt-1">{server.error}</p>
                              )}
                            </div>
                            {isConnected && tools.length > 0 && (
                              <CollapsibleContent>
                                <div className="border-t border-[#3A3A3A] bg-[#1A1A1A] px-3 py-2">
                                  <p className="text-xs text-gray-400 mb-2 font-medium">Available Tools:</p>
                                  <div className="grid grid-cols-1 gap-1">
                                    {tools.map((tool) => (
                                      <div key={tool.name} className="text-xs bg-[#2A2A2A] rounded px-2 py-1">
                                        <span className="font-mono text-blue-400">{tool.name}</span>
                                        {tool.description && (
                                          <span className="text-gray-400 ml-2">{tool.description}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            )}
                          </Card>
                        </Collapsible>
                      )
                    })
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-sm text-yellow-500">
                <AlertCircle className="w-4 h-4" />
                <span>You have unsaved changes</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                // Reset staged values and close
                setStagedImageGenerationModel(imageGenerationModel)
                setStagedImageEditingModel(imageEditingModel)
                setStagedImageStyle(imageStyle)
                setStagedImageSize(imageSize)
                setStagedImageQuality(imageQuality)
                setStagedVideoModel(videoModel)
                setStagedVideoDuration(videoDuration)
                setStagedVideoAspectRatio(videoAspectRatio)
                setStagedVideoBackend(videoBackend)
                setStagedVideoTier(videoTier)
                setStagedAutoDetectAspectRatio(autoDetectAspectRatio)
                setHasUnsavedChanges(false)
                onOpenChange(false)
              }}
              className="border-[#3A3A3A] hover:bg-[#3A3A3A]"
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                setIsSaving(true)
                try {
                  // Validate settings before saving
                  const validModels = ['gpt-image-1', 'flux-kontext-max', 'flux-kontext-pro', 'flux-dev-ultra-fast']
                  const validSizes = ['1024x1024', '1792x1024', '1024x1536']
                  const validStyles = ['vivid', 'natural']
                  
                  if (!validModels.includes(stagedImageGenerationModel)) {
                    throw new Error(`Invalid image generation model: ${stagedImageGenerationModel}`)
                  }
                  if (!validModels.includes(stagedImageEditingModel)) {
                    throw new Error(`Invalid image editing model: ${stagedImageEditingModel}`)
                  }
                  if (!validSizes.includes(stagedImageSize)) {
                    throw new Error(`Invalid image size: ${stagedImageSize}`)
                  }
                  if (!validStyles.includes(stagedImageStyle)) {
                    throw new Error(`Invalid image style: ${stagedImageStyle}`)
                  }
                  
                  // Apply all changes
                  console.log('[Settings] Applying changes:', {
                    imageGenerationModel: stagedImageGenerationModel,
                    imageEditingModel: stagedImageEditingModel,
                    imageStyle: stagedImageStyle,
                    imageSize: stagedImageSize,
                    imageQuality: stagedImageQuality,
                    videoModel: stagedVideoModel,
                    videoDuration: stagedVideoDuration,
                    videoAspectRatio: stagedVideoAspectRatio,
                    videoBackend: stagedVideoBackend,
                    videoTier: stagedVideoTier,
                    autoDetectAspectRatio: stagedAutoDetectAspectRatio
                  })
                  
                  // Additional debug for image editing model
                  console.log('[Settings] Image editing model being saved:', stagedImageEditingModel)
                  
                  onImageGenerationModelChange(stagedImageGenerationModel)
                  onImageEditingModelChange(stagedImageEditingModel)
                  onImageStyleChange(stagedImageStyle)
                  onImageSizeChange(stagedImageSize)
                  onImageQualityChange(stagedImageQuality)
                  if (onVideoModelChange) onVideoModelChange(stagedVideoModel)
                  if (onVideoDurationChange) onVideoDurationChange(stagedVideoDuration)
                  if (onVideoAspectRatioChange) onVideoAspectRatioChange(stagedVideoAspectRatio)
                  if (onVideoBackendChange) onVideoBackendChange(stagedVideoBackend)
                  if (onVideoTierChange) onVideoTierChange(stagedVideoTier)
                  if (onAutoDetectAspectRatioChange) onAutoDetectAspectRatioChange(stagedAutoDetectAspectRatio)
                  
                  // Force a small delay to ensure context updates
                  await new Promise(resolve => setTimeout(resolve, 100))
                  
                  setHasUnsavedChanges(false)
                  toast({
                    title: "Settings saved",
                    description: "Your preferences have been updated successfully.",
                    duration: 3000,
                  })
                  
                  // Close dialog after save
                  onOpenChange(false)
                } catch (error) {
                  console.error('Error saving settings:', error)
                  toast({
                    title: "Error saving settings",
                    description: error instanceof Error ? error.message : "There was an error saving your settings. Please try again.",
                    variant: "destructive"
                  })
                } finally {
                  setIsSaving(false)
                }
              }}
              disabled={!hasUnsavedChanges || isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Apply Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard unsaved changes?"
        description="You have unsaved changes in your settings. Are you sure you want to discard them?"
        onConfirm={handleDiscardChanges}
        onCancel={() => setShowDiscardDialog(false)}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        confirmVariant="destructive"
      />
    </>
  )
}