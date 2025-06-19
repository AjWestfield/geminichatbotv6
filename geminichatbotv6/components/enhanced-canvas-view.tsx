"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Code, ImageIcon, FileText, Eye, Monitor, Video, Music, Bot, User, Sparkles, Brain } from "lucide-react"
import { EnhancedBrowserView } from "@/components/enhanced-browser-view"
import { CredentialDialog } from "@/components/credential-dialog"
import { ImageGallery } from "@/components/image-gallery"
import { GeneratedImage } from "@/lib/image-utils"
import { VideoGallery } from "@/components/video-gallery"
import { GeneratedVideo } from "@/lib/video-generation-types"
import { AudioGallery, type GeneratedAudio } from "@/components/audio-gallery"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface CanvasState {
  selectedImageIds: string[]
  activeTab: string
  layout?: 'grid' | 'list' | 'masonry'
  filters?: {
    model?: string
    dateRange?: { start: Date; end: Date }
  }
  browserMode?: 'agent' | 'manual'
  browserSessionId?: string
}

interface EnhancedCanvasViewProps {
  generatedImages?: GeneratedImage[]
  onImagesChange?: (images: GeneratedImage[]) => void
  generatedVideos?: GeneratedVideo[]
  onVideosChange?: (videos: GeneratedVideo[]) => void
  generatedAudios?: GeneratedAudio[]
  onAudiosChange?: (audios: GeneratedAudio[]) => void
  isGeneratingImage?: boolean
  onGenerateImage?: () => void
  canvasState?: CanvasState
  onCanvasStateChange?: (state: CanvasState) => void
  chatId?: string
  enableAgentMode?: boolean
  onVideoDelete?: (videoId: string) => void
  onCancelVideo?: (videoId: string) => void
}

interface CredentialRequest {
  type: 'login' | 'payment' | 'verification';
  fields: string[];
  message: string;
}

export function EnhancedCanvasView({
  generatedImages = [],
  onImagesChange,
  generatedVideos = [],
  onVideosChange,
  generatedAudios = [],
  onAudiosChange,
  isGeneratingImage = false,
  onGenerateImage,
  canvasState,
  onCanvasStateChange,
  chatId,
  enableAgentMode = true,
  onVideoDelete,
  onCancelVideo
}: EnhancedCanvasViewProps) {
  const [activeTab, setActiveTab] = useState(canvasState?.activeTab || "browser")
  const [browserMode, setBrowserMode] = useState<'agent' | 'manual'>(canvasState?.browserMode || 'manual')
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(canvasState?.browserSessionId || null)
  const [credentialRequest, setCredentialRequest] = useState<CredentialRequest | null>(null)
  const [showCredentialDialog, setShowCredentialDialog] = useState(false)
  const [agentTaskCount, setAgentTaskCount] = useState(0)

  // Update parent state when local state changes
  useEffect(() => {
    if (onCanvasStateChange) {
      onCanvasStateChange({
        ...canvasState,
        activeTab,
        browserMode,
        browserSessionId: browserSessionId || undefined,
        selectedImageIds: canvasState?.selectedImageIds || []
      })
    }
  }, [activeTab, browserMode, browserSessionId])

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Handle browser session changes
  const handleBrowserSessionChange = (sessionId: string | null) => {
    setBrowserSessionId(sessionId)
  }

  // Handle browser mode changes
  const handleBrowserModeChange = (mode: 'agent' | 'manual') => {
    setBrowserMode(mode)
  }

  // Handle credential requests from browser agent
  const handleCredentialRequest = async (context: {
    type: 'login' | 'payment' | 'verification';
    fields: string[];
    message: string;
  }): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
      setCredentialRequest(context)
      setShowCredentialDialog(true)

      // Store resolve/reject for later use
      const handleSubmit = (credentials: Record<string, string>) => {
        setShowCredentialDialog(false)
        setCredentialRequest(null)
        resolve(credentials)
      }

      const handleCancel = () => {
        setShowCredentialDialog(false)
        setCredentialRequest(null)
        reject(new Error('User cancelled credential input'))
      }

      // Temporarily store handlers (in production, use a more robust approach)
      (window as any).__credentialHandlers = { handleSubmit, handleCancel }
    })
  }

  // Handle credential dialog submission
  const handleCredentialSubmit = (credentials: Record<string, string>) => {
    const handlers = (window as any).__credentialHandlers
    if (handlers?.handleSubmit) {
      handlers.handleSubmit(credentials)
      delete (window as any).__credentialHandlers
    }
  }

  // Handle credential dialog cancellation
  const handleCredentialCancel = () => {
    const handlers = (window as any).__credentialHandlers
    if (handlers?.handleCancel) {
      handlers.handleCancel()
      delete (window as any).__credentialHandlers
    }
  }

  // Tab configuration with enhanced browser tab
  const tabs = [
    {
      id: "browser",
      label: "Browser",
      icon: Monitor,
      count: browserMode === 'agent' ? agentTaskCount : 0,
      badge: browserMode === 'agent' ? <Bot className="h-3 w-3" /> : null
    },
    {
      id: "images",
      label: "Images",
      icon: ImageIcon,
      count: generatedImages.length
    },
    {
      id: "videos",
      label: "Videos",
      icon: Video,
      count: generatedVideos.length
    },
    {
      id: "audio",
      label: "Audio",
      icon: Music,
      count: generatedAudios.length
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <div className="px-4 pt-4 pb-0">
          <TabsList className="grid w-full grid-cols-4 h-12">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 relative data-[state=active]:bg-background"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                  >
                    {tab.count}
                  </motion.span>
                )}
                {tab.badge && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-1"
                  >
                    {tab.badge}
                  </motion.div>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="browser" className="h-full m-0 p-4">
            <div className="h-full relative">
              {enableAgentMode && browserMode === 'agent' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-2 left-2 z-10"
                >
                  <Badge
                    variant="default"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    <Brain className="h-3 w-3" />
                    AI Agent Active
                    <Sparkles className="h-3 w-3 animate-pulse" />
                  </Badge>
                </motion.div>
              )}

              <EnhancedBrowserView
                sessionId={browserSessionId}
                onSessionChange={handleBrowserSessionChange}
                agentMode={browserMode === 'agent'}
                onModeChange={handleBrowserModeChange}
                onCredentialRequest={handleCredentialRequest}
                className="h-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="images" className="h-full m-0 p-0">
            <ImageGallery
              images={generatedImages}
              onImagesChange={onImagesChange}
              isGenerating={isGeneratingImage}
            />
          </TabsContent>

          <TabsContent value="videos" className="h-full m-0 p-0">
            <VideoGallery
              videos={generatedVideos}
              onVideoDelete={onVideoDelete}
              onCancelVideo={onCancelVideo}
            />
          </TabsContent>

          <TabsContent value="audio" className="h-full m-0 p-0">
            <AudioGallery
              audios={generatedAudios}
              onAudiosChange={onAudiosChange}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Credential Dialog */}
      <CredentialDialog
        open={showCredentialDialog}
        onOpenChange={setShowCredentialDialog}
        request={credentialRequest}
        onSubmit={handleCredentialSubmit}
        onCancel={handleCredentialCancel}
      />

      {/* Floating Agent Control Button */}
      {enableAgentMode && activeTab === 'browser' && (
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute bottom-6 right-6"
          >
            <Button
              onClick={() => handleBrowserModeChange(browserMode === 'agent' ? 'manual' : 'agent')}
              className={cn(
                "rounded-full shadow-lg",
                browserMode === 'agent'
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  : "bg-secondary hover:bg-secondary/80"
              )}
              size="lg"
            >
              {browserMode === 'agent' ? (
                <>
                  <User className="h-5 w-5 mr-2" />
                  Switch to Manual
                </>
              ) : (
                <>
                  <Bot className="h-5 w-5 mr-2" />
                  Enable AI Agent
                </>
              )}
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
