"use client"

import type React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMemo } from "react"
import ChatMessage from "./chat-message"
import { AI_Prompt } from "@/components/ui/animated-ai-input"
import { useState, useCallback, useRef, useEffect } from "react"
import { UploadProgress } from "./upload-progress"
import { AnimatePresence } from "framer-motion"
import { generateVideoThumbnail, getVideoDuration, formatVideoDuration } from "@/lib/video-utils"
import {
  type GeneratedImage,
  generateImageId,
  isImageGenerationRequest,
  extractImagePrompt
} from "@/lib/image-utils"
import { SettingsDialog } from "./settings-dialog"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { useChatWithTools } from "@/hooks/use-chat-with-tools"
import { toast } from "sonner"
import { SecureApiKeyInput } from "./secure-api-key-input"
import { MCPAgentWorkflow } from "@/lib/mcp/mcp-agent-workflow"
import { GeneratedVideo } from "@/lib/video-generation-types"
import { useVideoProgressStore } from "@/lib/stores/video-progress-store"
import { InlineImageOptions } from "./inline-image-options"
import { InlineVideoOptions } from "./inline-video-options"
import { ImageActionDialog } from "./image-action-dialog"
import { MultiImageEditModal } from "./multi-image-edit-modal"
import { FilePreviewModal } from "./file-preview-modal"
import { getImageAspectRatio } from "@/lib/image-utils"
import { parseGeminiTranscription, hasTranscription, removeTranscriptionFromResponse } from "@/lib/gemini-transcription-parser"
import { useImageSettings, useVideoSettings } from "@/lib/contexts/settings-context"
import { createAnalysisPrompt } from "@/lib/reverse-engineering-utils"
import { useDeepResearch } from "@/hooks/use-deep-research"
import { useResearchIntent } from "@/hooks/use-research-intent"
import { useDeepResearchStore } from "@/lib/stores/deep-research-store"
import { DeepResearchPanel } from "./deep-research-panel"
import { VideoGenerationModal, type VideoGenerationOptions } from "./video-generation-modal"
import { WebSearchIndicator } from "./web-search-indicator"

interface FileUpload {
  file: File
  preview?: string
  geminiFile?: {
    uri: string
    mimeType: string
    name: string
  }
  transcription?: {
    text: string
    language?: string
    duration?: number
    segments?: Array<{
      start: number
      end: number
      text: string
    }> // For detailed timing info
  }
  videoThumbnail?: string // Add this for video thumbnail
  videoDuration?: number // Add this for video duration
  aspectRatio?: {
    width: number
    height: number
    aspectRatio: number
    orientation: 'landscape' | 'portrait' | 'square'
    imageSize: '1024x1024' | '1536x1024' | '1024x1536'
    videoAspectRatio: '16:9' | '9:16' | '1:1'
  }
}

interface ChatInterfaceProps {
  onGeneratedImagesChange?: (images: GeneratedImage[]) => void
  generatedImages?: GeneratedImage[] // Add this prop to receive current images
  onImageGenerationStart?: () => void
  onAnimateImage?: (imageUrl: string, imageName: string) => void
  onGeneratedVideosChange?: (videos: GeneratedVideo[]) => void
  onVideoGenerationStart?: () => void
  generatedVideos?: GeneratedVideo[]
  onGeneratedAudioChange?: (audio: any) => void
  onAudioGenerationStart?: (prompt: string, voiceName?: string, estimatedDuration?: string) => string
  onEditImageRequested?: (imageId: string | null) => void
  onChatSubmitRef?: (submitFn: (message: string) => void) => void
  onMessagesChange?: (messages: any[], attachments?: Record<string, any[]>) => void
  onModelChange?: (model: string) => void
  selectedModel?: string
  initialMessages?: any[]
  initialMessageAttachments?: Record<string, any[]>
  chatId?: string | null
  onResetChat?: () => void
  onImageEditingModelChange?: (model: string) => void
  initialImageEditingModel?: string
}

export default function ChatInterface({
  onGeneratedImagesChange,
  generatedImages = [], // Add this with default empty array
  onImageGenerationStart,
  onAnimateImage,
  onGeneratedVideosChange,
  onVideoGenerationStart,
  generatedVideos = [],
  onGeneratedAudioChange,
  onAudioGenerationStart,
  onEditImageRequested,
  onChatSubmitRef,
  onMessagesChange,
  onModelChange,
  selectedModel: initialSelectedModel,
  initialMessages,
  initialMessageAttachments,
  chatId,
  onResetChat,
  onImageEditingModelChange,
  initialImageEditingModel
}: ChatInterfaceProps) {
  const [selectedModel, setSelectedModel] = useState(initialSelectedModel || "gemini-2.0-flash")
  const [selectedFile, setSelectedFile] = useState<FileUpload | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<FileUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'transcribing' | 'complete' | 'error' | 'converting' | 'analyzing'>('idle')
  // Remove local generatedImages state - we'll use the parent's state through props
  // const [isGeneratingImage, setIsGeneratingImage] = useState(false) // Removed - using main chat API flow
  const [isSearchingWeb, setIsSearchingWeb] = useState(false)
  const [webSearchQuery, setWebSearchQuery] = useState<string>('')

  // MCP tool execution state is now managed by useChatWithTools hook

  // MCP tool management state
  const [enabledTools, setEnabledTools] = useState<Record<string, Record<string, boolean>>>({})
  const [enabledServers, setEnabledServers] = useState<Record<string, boolean>>({})

  // Track processed messages to prevent infinite loops
  const processedImageNotificationsRef = useRef<Set<string>>(new Set())

  // API Key request state
  const [apiKeyRequest, setApiKeyRequest] = useState<{
    isOpen: boolean
    serverName: string
    serverInfo?: any
  }>({ isOpen: false, serverName: '' })

  // Image generation settings from context
  const { settings: currentImageSettings, updateSettings: updateImageSettings } = useImageSettings()

  // Function to map quality to model
  const getModelFromQuality = useCallback((quality: 'standard' | 'hd' | 'wavespeed') => {
    switch (quality) {
      case 'hd':
        return 'gpt-image-1'
      case 'standard':
      case 'wavespeed':
        return 'flux-dev-ultra-fast'
      default:
        return 'gpt-image-1'
    }
  }, [])

  // Get image editing model from context (already declared above)
  const imageEditingModel = currentImageSettings.editingModel

  const [imageQuality, setImageQuality] = useState<'standard' | 'hd' | 'wavespeed'>(() => {
    // Load saved quality preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('imageGenerationQuality')
      if (saved === 'standard' || saved === 'hd' || saved === 'wavespeed') {
        console.log('Loaded saved quality preference:', saved)
        return saved
      }
    }
    return 'hd' // Default to 'hd' for GPT-Image-1
  })
  // imageStyle and imageSize are now managed by the context
  const [showImageSettings, setShowImageSettings] = useState(false)

  // Video generation modal state
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoModalConfig, setVideoModalConfig] = useState<{
    prompt?: string
    image?: string
    suggestedWorkflow?: 'quick' | 'studio'
  }>({})

  // Show image options when image is uploaded
  const [showImageOptions, setShowImageOptions] = useState(false)

  // Show video options when video is uploaded
  const [showVideoOptions, setShowVideoOptions] = useState(false)

  // Track when options were shown to enforce minimum display time
  const [optionsShownAt, setOptionsShownAt] = useState<number>(0)

  // Track user interaction with file options to prevent premature clearing
  const [userHasInteractedWithOptions, setUserHasInteractedWithOptions] = useState(false)
  const fileInteractionLockRef = useRef<number | null>(null)

  const [lastDetectedScript, setLastDetectedScript] = useState<{
    content: string
    messageId: string
    length: number
  } | null>(null)
  const [generatedScriptHashes, setGeneratedScriptHashes] = useState<Set<string>>(new Set())

  // Action dialog state for edit/animate prompts
  const [actionDialog, setActionDialog] = useState<{
    isOpen: boolean
    action: 'edit' | 'animate' | null
    imageName: string
  }>({ isOpen: false, action: null, imageName: '' })

  // Multi-image edit modal state
  const [multiImageEditModal, setMultiImageEditModal] = useState<{
    isOpen: boolean
    images: string[]
  }>({ isOpen: false, images: [] })

  // File preview modal state
  const [filePreviewModal, setFilePreviewModal] = useState<{
    isOpen: boolean
    file: {
      name: string
      url: string
      contentType: string
      prompt?: string
    }
    options: ('analyze' | 'edit' | 'animate')[]
  }>({
    isOpen: false,
    file: { name: '', url: '', contentType: '' },
    options: []
  })

  // Ref to store handleSubmit function to avoid temporal dead zone
  const handleSubmitRef = useRef<((e?: React.FormEvent) => void) | null>(null)

  // Video generation settings from context
  const { settings: videoSettings, updateSettings: updateVideoSettings } = useVideoSettings()

  // Map video settings from context - now all settings are in context
  const videoModel = videoSettings.model
  const videoDuration = videoSettings.duration
  const videoAspectRatio = videoSettings.aspectRatio
  const videoBackend = videoSettings.backend
  const videoTier = videoSettings.tier
  const autoDetectAspectRatio = videoSettings.autoDetectAspectRatio

  // Store object URLs for cleanup
  const objectURLsRef = useRef<Set<string>>(new Set())

  // Debug infrastructure for file upload issues
  const isUploadingNewFilesRef = useRef<boolean>(false)
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileUploadTimestampRef = useRef<number>(0)

  // Track files that have been sent in messages to avoid clearing new uploads
  const sentFilesRef = useRef<Set<string>>(new Set())

  // Debug logging for file state changes
  useEffect(() => {
    console.log('[FILE_DEBUG] File state changed:', {
      selectedFile: selectedFile?.file?.name || 'null',
      selectedFilesCount: selectedFiles.length,
      isUploading,
      uploadStatus,
      isUploadingNewFiles: isUploadingNewFilesRef.current,
      fileUploadTimestamp: fileUploadTimestampRef.current,
      hasCleanupTimeout: !!cleanupTimeoutRef.current
    })
  }, [selectedFile, selectedFiles, isUploading, uploadStatus])

  // Wrapper functions for clearing files with logging
  const clearSelectedFile = useCallback((reason: string, preserveOptions = false) => {
    console.log(`[FILE_DEBUG] Clearing selectedFile - Reason: ${reason}, preserveOptions: ${preserveOptions}`)

    // Don't clear if options are visible and this isn't a user-initiated action
    if ((showImageOptions || showVideoOptions) && !reason.includes('user-removed') && !reason.includes('chat-switch')) {
      console.warn('[FILE_DEBUG] Preventing file clear - options are visible')
      return
    }

    // Don't clear if within interaction lock period
    if (fileInteractionLockRef.current && !reason.includes('user-removed') && !reason.includes('chat-switch')) {
      console.warn('[FILE_DEBUG] Preventing file clear - within interaction lock period')
      return
    }

    setSelectedFile(null)
    // Only hide options if not preserving them AND not from post-analysis cleanup
    if (!preserveOptions && !reason.includes('post-analysis')) {
      // For user-initiated actions, check if any files remain before hiding
      if (reason.includes('user-removed')) {
        // Check if there are still files in selectedFiles
        const hasRemainingImages = selectedFiles.some(f => f.file.type.startsWith('image/'))
        const hasRemainingVideos = selectedFiles.some(f => f.file.type.startsWith('video/'))

        if (!hasRemainingImages) {
          setShowImageOptions(false)
        }
        if (!hasRemainingVideos) {
          setShowVideoOptions(false)
        }
      } else {
        // For other reasons, add a short delay and check again
        setTimeout(() => {
          // Re-check current state
          const currentSelectedFile = selectedFile
          const currentSelectedFiles = selectedFiles
          const hasImages = currentSelectedFile?.file.type.startsWith('image/') ||
                           currentSelectedFiles.some(f => f.file.type.startsWith('image/'))
          const hasVideos = currentSelectedFile?.file.type.startsWith('video/') ||
                           currentSelectedFiles.some(f => f.file.type.startsWith('video/'))

          if (!hasImages) {
            setShowImageOptions(false)
          }
          if (!hasVideos) {
            setShowVideoOptions(false)
          }
        }, 1000)
      }
    } else if (reason.includes('post-analysis')) {
      // For post-analysis cleanup, don't hide media options at all
      console.log('[FILE_DEBUG] Post-analysis cleanup - preserving media options')
    }
  }, [selectedFile, selectedFiles, showImageOptions, showVideoOptions])

  const clearSelectedFiles = useCallback((reason: string, preserveOptions = false) => {
    console.log(`[FILE_DEBUG] Clearing selectedFiles - Reason: ${reason}, preserveOptions: ${preserveOptions}`)

    // Don't clear if options are visible and this isn't a user-initiated action
    if ((showImageOptions || showVideoOptions) && !reason.includes('user-removed') && !reason.includes('chat-switch')) {
      console.warn('[FILE_DEBUG] Preventing files clear - options are visible')
      return
    }

    // Don't clear if within interaction lock period
    if (fileInteractionLockRef.current && !reason.includes('user-removed') && !reason.includes('chat-switch')) {
      console.warn('[FILE_DEBUG] Preventing files clear - within interaction lock period')
      return
    }

    setSelectedFiles([])
    // Only hide options if not preserving them and no single file exists AND not from post-analysis
    if (!preserveOptions && !reason.includes('post-analysis')) {
      // For user-initiated actions, check if selectedFile has media
      if (reason.includes('user-removed')) {
        const hasRemainingImage = selectedFile?.file.type.startsWith('image/')
        const hasRemainingVideo = selectedFile?.file.type.startsWith('video/')

        if (!hasRemainingImage) {
          setShowImageOptions(false)
        }
        if (!hasRemainingVideo) {
          setShowVideoOptions(false)
        }
      } else {
        // For other reasons, add a short delay and check again
        setTimeout(() => {
          // Re-check current state
          const currentSelectedFile = selectedFile
          const currentSelectedFiles = selectedFiles
          const hasImages = currentSelectedFile?.file.type.startsWith('image/') ||
                           currentSelectedFiles.some(f => f.file.type.startsWith('image/'))
          const hasVideos = currentSelectedFile?.file.type.startsWith('video/') ||
                           currentSelectedFiles.some(f => f.file.type.startsWith('video/'))

          if (!hasImages) {
            setShowImageOptions(false)
          }
          if (!hasVideos) {
            setShowVideoOptions(false)
          }
        }, 1000)
      }
    } else if (reason.includes('post-analysis')) {
      // For post-analysis cleanup, don't hide media options at all
      console.log('[FILE_DEBUG] Post-analysis cleanup - preserving media options')
    }
  }, [selectedFile, selectedFiles, showImageOptions, showVideoOptions])

  // Image generation model is now managed by settings context

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('imageEditingModel', imageEditingModel)
    }
  }, [imageEditingModel])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('imageQuality', imageQuality)
    }
  }, [imageQuality])

  // Style and size are now managed by the context, no need for separate effects

  // Simple hash function for scripts
  const hashScript = (content: string): string => {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Script detection function
  const detectScript = useCallback((content: string, previousUserMessage?: any): { isScript: boolean; length: number; estimatedDuration: string } => {
    if (!content || content.length < 100) {
      return { isScript: false, length: 0, estimatedDuration: '0s' }
    }


    // Video analysis exclusions - if content appears to be video analysis, don't treat as script
    const videoAnalysisIndicators = [
      /please\s+(?:provide|give|analyze|reverse\s+engineer)/i,
      /video\s+(?:analysis|transcription|breakdown|reverse\s+engineering)/i,
      /reverse\s+engineer(?:ing)?\s+(?:this\s+)?video/i,
      /analyze\s+(?:this\s+)?video/i,
      /complete\s+audio\s+transcription\s+with\s+timestamps/i,
      /production\s+breakdown/i,
      /technical\s+recreation\s+guide/i,
      /content\s+structure\s+(?:&|and)\s+script\s+analysis/i, // Specific pattern from our prompt
      /timestamped\s+transcription/i,
      /visual\s+analysis\s+with\s+timeline/i
    ]

    // If this appears to be a video analysis request, exclude from script detection
    const isVideoAnalysis = videoAnalysisIndicators.some(pattern => pattern.test(content))
    if (isVideoAnalysis) {
      console.log('[Script Detection] Detected video analysis request, excluding from script detection')
      return { isScript: false, length: 0, estimatedDuration: '0s' }
    }

    // Check if previous user message explicitly requested a script
    const userRequestedScript = previousUserMessage && (
      previousUserMessage.content.toLowerCase().includes('script') ||
      previousUserMessage.content.toLowerCase().includes('voiceover') ||
      previousUserMessage.content.toLowerCase().includes('narration') ||
      previousUserMessage.content.toLowerCase().includes('write a commercial') ||
      previousUserMessage.content.toLowerCase().includes('write an ad')
    ) && !videoAnalysisIndicators.some(pattern => pattern.test(previousUserMessage.content))

    // Strong script indicators (must have at least one)
    const strongScriptIndicators = [
      /###.*?(script|narration|voice[ -]?over)/i,     // Markdown headers mentioning script/narration
      /\*\*.*?(script|narration|voice[ -]?over).*?\*\*/i, // Bold script headings
      /^(narrator|announcer|voice[ -]?over|v\.o\.|vo):/mi, // Narrator/announcer labels
      /speaker\s*\d+:/gi,                              // Speaker labels
      /\[(pause|emphasis|whisper|loud|soft|music|sfx)\]/gi, // Audio direction tags
      /\(voice[ -]?over\)/i,                          // Voice-over indication
      /fade\s+(in|out)/i,                             // Audio/video directions
      /^int\.|^ext\./mi,                              // Screenplay format
      /^scene\s+\d+/mi,                               // Scene numbers
    ]

    // News/informational content indicators (exclude these)
    const newsIndicators = [
      /\d+\.\s*(news|update|highlights?|finals?|player|team|game|score|trades?|coaching|injuries)/i,
      /here\s+are\s+the\s+latest/i,
      /latest\s+(news|updates?|highlights?)/i,
      /nba|nfl|mlb|nhl|sports?\s+(news|updates?)/i,
      /stock\s+market|financial\s+news/i,
      /technology\s+news|tech\s+updates?/i,
      /sources?:|references?:/i,
      /\[?\d+\]?\./,  // Numbered lists like "1." or "[1]."
      // Search results and structured content patterns
      /\*\*\s*(market\s+size|innovation|feasibility|scalability|competitive\s+landscape)/i,
      /present\s+your\s+response\s+in\s+the\s+following\s+format/i,
      /\*\*\s*(startup\s+idea|description|growth\s+potential|earnings\s+potential)/i,
      /\d+\.\s+(startup\s+idea|description|growth\s+potential|earnings\s+potential)/i,
      /ai.driven\s+(custom|healthcare|software|platforms?)/i,
      /\*\*key\s+technologies\*\*/i,
      /based\s+on\s+(market\s+size|trends?|revenue\s+model)/i,
      /search\s+results?/i,
      /related\s+questions?/i,
      /follow.up\s+questions?/i,
      /web\s+search/i,
      /according\s+to\s+(sources?|research|reports?)/i,
      /\*\*\d+\.\s+[A-Z]/,  // Structured numbered lists with bold formatting
      // Deep research and web search result exclusions
      /deep\s+research\s+on/i,
      /research\s+(?:summary|findings|results)/i,
      /\*\*\s*(?:overview|introduction|conclusion|summary|findings|key\s+points?|main\s+points?)/i,
      /based\s+on\s+(?:my\s+)?(?:research|analysis|investigation)/i,
      /here\s+(?:is\s+)?(?:a\s+)?(?:comprehensive|detailed|thorough)\s+(?:analysis|overview|summary|research)/i,
      /research\s+(?:indicates|shows|reveals|suggests)/i,
      /\*\*\s*(?:methodology|approach|findings|results|conclusion)/i,
      /perplexity\s+(?:search|results?|api)/i,
      /web\s+(?:search|crawling|scraping)\s+results?/i,
      /\[SEARCH_METADATA\]/i,
      /\[WEB_SEARCH_RESULTS\]/i,
      /\[DEEP_RESEARCH_/i,
      /information\s+gathered\s+from/i,
      /sources?\s+consulted/i,
      /comprehensive\s+(?:research|analysis|study)/i,
      /\*\*\s*(?:executive\s+summary|research\s+summary|key\s+findings)/i,
    ]

    // Check for strong script indicators
    let hasStrongIndicator = false
    for (const pattern of strongScriptIndicators) {
      if (pattern.test(content)) {
        hasStrongIndicator = true
        break
      }
    }

    // Check for news/informational content
    let isNewsContent = false
    for (const pattern of newsIndicators) {
      if (pattern.test(content)) {
        isNewsContent = true
        break
      }
    }

    // Additional script characteristics
    const hasDialogueQuotes = /"[^"]{10,}"/g.test(content) // Quoted dialogue
    const hasActionLines = /\([^)]+\)/g.test(content) && (content.match(/\([^)]+\)/g)?.length || 0) > 2 // Multiple parenthetical actions
    const hasScriptFormatting = content.includes('\n\n') && content.split('\n\n').length > 3 // Multiple paragraph breaks

    // Additional AI response characteristics (should NOT be treated as scripts)
    const hasAIResponseMarkers = [
      /\*\*.*?\*\*/g.test(content) && (content.match(/\*\*.*?\*\*/g)?.length || 0) > 3, // Multiple bold formatting
      /\d+\.\s+\*\*/.test(content), // Numbered list with bold headers
      /based\s+on/i.test(content) && /market/i.test(content), // Analysis language
      content.includes('**') && content.includes('•'), // Mixed formatting
      /the\s+(market|industry|sector)/i.test(content), // Business analysis terms
    ].some(Boolean)

    // Exclude if it's clearly news, informational content, or AI-generated analysis
    if ((isNewsContent || hasAIResponseMarkers) && !userRequestedScript) {
      console.log('[Script Detection] Excluding AI response/informational content from script detection')
      return { isScript: false, length: 0, estimatedDuration: '0s' }
    }

    // Determine if it's a script
    const isScript = userRequestedScript || (
      hasStrongIndicator &&
      !isNewsContent &&
      (hasDialogueQuotes || hasActionLines || hasScriptFormatting)
    )

    // Calculate estimated duration (rough estimate: 150 words per minute)
    const wordCount = content.split(/\s+/).length
    const estimatedMinutes = Math.ceil(wordCount / 150)
    const estimatedDuration = estimatedMinutes < 1 ? '30s' : `${estimatedMinutes}m`

    return {
      isScript,
      length: content.length,
      estimatedDuration
    }
  }, [])


  // Use a ref to store the current quality to avoid stale closures
  const imageQualityRef = useRef(imageQuality)

  // Update quality in context when local quality changes
  useEffect(() => {
    console.log('Image quality setting changed to:', imageQuality)

    // Map local quality to context quality (context only supports 'standard' | 'hd')
    const contextQuality: 'standard' | 'hd' = imageQuality === 'hd' ? 'hd' : 'standard'

    // Only update the quality, not the model
    // The model should be controlled by the settings dialog
    updateImageSettings({
      quality: contextQuality
    })

    // Update the ref whenever imageQuality changes
    imageQualityRef.current = imageQuality
  }, [imageQuality, updateImageSettings])

  // Wrapper function for setImageQuality with logging
  const updateImageQuality = useCallback((newQuality: 'standard' | 'hd' | 'wavespeed') => {
    console.log('[updateImageQuality] Changing from', imageQuality, 'to', newQuality)
    setImageQuality(newQuality)
  }, [imageQuality])

  // Callback to handle settings dialog close
  const handleSettingsClose = useCallback((open: boolean) => {
    setShowImageSettings(open)
    if (!open) {
      // Log current settings when dialog closes
      console.log('Settings dialog closed. Current quality:', imageQuality)
      console.log('Settings dialog closed. Current style:', currentImageSettings.style)
      console.log('Settings dialog closed. Current size:', currentImageSettings.size)
    }
  }, [imageQuality, currentImageSettings.style, currentImageSettings.size])

  // Initialize MCP on mount and start workflow monitor
  useEffect(() => {
    // Initialize MCP servers
    fetch('/api/mcp/init')
      .then(res => res.json())
      .then(data => console.log('MCP initialized:', data))
      .catch(err => console.error('Failed to initialize MCP:', err))

    // Initialize the MCP Agent Workflow monitor (starts automatically)
    MCPAgentWorkflow.getInstance()
    console.log('MCP Agent Workflow monitor initialized')

    // Cleanup on unmount
    return () => {
      MCPAgentWorkflow.getInstance().stopMonitoring()
    }
  }, [])

  // Store file attachments for each message
  const [messageAttachments, setMessageAttachments] = useState<Record<string, {
    name: string
    contentType: string
    url?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
      segments?: Array<{
        start: number
        end: number
        text: string
      }>
    }
    videoThumbnail?: string // Add this
    videoDuration?: number // Add this
  }[]>>(initialMessageAttachments || {})

  // Track pending attachment for the next message
  const pendingAttachmentRef = useRef<{
    name: string
    contentType: string
    url?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
      segments?: Array<{
        start: number
        end: number
        text: string
      }>
    }
    videoThumbnail?: string // Add this
    videoDuration?: number // Add this
    additionalFiles?: Array<{
      name: string
      contentType: string
      url?: string
      transcription?: {
        text: string
        language?: string
        duration?: number
        segments?: Array<{
          start: number
          end: number
          text: string
        }>
      }
      videoThumbnail?: string
      videoDuration?: number
    }>
  } | null>(null)

  // Ref to track temporary message IDs for pre-setting attachments
  const tempMessageIdRef = useRef<string | null>(null)

  // Track if we've successfully displayed attachments
  const attachmentsDisplayedRef = useRef<Set<string>>(new Set())

  // Backup of pending attachments to ensure they persist
  const pendingAttachmentBackupRef = useRef<any>(null)

  // Debug: Monitor messageAttachments state changes
  useEffect(() => {
    console.log('[STATE UPDATE] messageAttachments changed:', {
      keys: Object.keys(messageAttachments),
      count: Object.keys(messageAttachments).length,
      details: Object.entries(messageAttachments).map(([id, attachments]) => ({
        messageId: id,
        attachmentCount: attachments?.length || 0
      }))
    })
  }, [messageAttachments])

  // State specifically for first message attachments to handle race condition
  const [firstMessageAttachments, setFirstMessageAttachments] = useState<any[] | null>(null)

  // Track the last submitted message timestamp to help identify new messages
  const lastSubmitTimeRef = useRef<number>(0)


  // Use initial messages if provided, otherwise use welcome message
  const defaultInitialMessages = [
    {
      id: "welcome-message",
      role: "assistant",
      content: "Hello! I'm your AI assistant powered by Gemini. How can I help you today?",
    },
  ]

  // Store references to uploaded files for transcription parsing
  const uploadedFilesRef = useRef<Map<string, FileUpload>>(new Map())

  // Track if we need to reload messages
  const prevChatIdRef = useRef<string | null>(chatId || null)
  const prevInitialMessagesRef = useRef(initialMessages)

  // Add save lock to prevent duplicate image saves
  const processedImageGenerationRef = useRef<Set<string>>(new Set())

  // Deep Research mode state (moved above useChatWithTools to avoid declaration order issues)
  const [isDeepResearchMode, setIsDeepResearchMode] = useState(false)

  const { messages, input, handleInputChange, handleSubmit: originalHandleSubmit, isLoading, error, stop, mcpToolExecuting, append } = useChatWithTools({
    api: "/api/chat",
    body: {
      model: selectedModel,
      imageGenerationModel: currentImageSettings.model, // Add image generation model from settings
      imageEditingModel: imageEditingModel, // Add image editing model from settings
      imageSettings: {
        model: currentImageSettings.model,
        size: currentImageSettings.size,
        style: currentImageSettings.style,
        quality: imageQuality
      }, // Add image settings including model selection
      // For backward compatibility, keep single file fields
      fileUri: selectedFile?.geminiFile?.uri,
      fileMimeType: selectedFile?.geminiFile?.mimeType,
      transcription: selectedFile?.transcription, // Include transcription data
      chatId: chatId, // Include chat ID for persistence
      isDeepResearchMode: isDeepResearchMode, // Include deep research mode
      // Include ALL files (both single and multiple) in multipleFiles array
      multipleFiles: (() => {
        const allFiles = []
        if (selectedFile?.geminiFile) {
          allFiles.push({
            uri: selectedFile.geminiFile.uri,
            mimeType: selectedFile.geminiFile.mimeType,
            name: selectedFile.file.name,
            transcription: selectedFile.transcription
          })
        }
        if (selectedFiles.length > 0) {
          allFiles.push(...selectedFiles.filter(f => f.geminiFile).map(file => ({
            uri: file.geminiFile!.uri,
            mimeType: file.geminiFile!.mimeType,
            name: file.file.name,
            transcription: file.transcription
          })))
        }
        return allFiles.length > 0 ? allFiles : undefined
      })(),
    },
    initialMessages: initialMessages || defaultInitialMessages,
    onError: (error) => {
      console.error("Chat error:", error)
    },
  })

  // Deep Research hooks
  const deepResearch = useDeepResearch()
  const { detectIntent, shouldAutoTrigger } = useResearchIntent()
  const { createSession, getActiveSession } = useDeepResearchStore()
  const [showDeepResearchPanel, setShowDeepResearchPanel] = useState(false)

  // Track processed messages to prevent infinite loops
  const processedDeepResearchMessagesRef = useRef<Set<string>>(new Set())

  // DISABLED: Auto-trigger deep research - Deep research should only be triggered by button click
  // useEffect(() => {
  //   if (messages && messages.length > 0) {
  //     const lastMessage = messages[messages.length - 1]
  //     if (lastMessage?.role === 'user' && lastMessage.content && lastMessage.id) {
  //       // Check if we've already processed this message
  //       if (processedDeepResearchMessagesRef.current.has(lastMessage.id)) {
  //         return
  //       }
  //
  //       // Check if research is already loading
  //       if (deepResearch.loading) {
  //         return
  //       }
  //
  //       const intent = detectIntent(lastMessage.content)
  //
  //       if (shouldAutoTrigger(intent) && intent.researchTopic) {
  //         // Mark this message as processed
  //         processedDeepResearchMessagesRef.current.add(lastMessage.id)
  //         console.log('[Deep Research] Auto-triggering research:', intent)
  //
  //         // Create a new research session
  //         const sessionId = createSession(intent.researchTopic, {
  //           mode: intent.suggestedMode,
  //           depth: intent.suggestedDepth
  //         })
  //
  //         // Start the research
  //         deepResearch.startResearch(intent.researchTopic, {
  //           reasoningEffort: intent.suggestedDepth === 'deep' ? 'high' :
  //                           intent.suggestedDepth === 'moderate' ? 'medium' : 'low',
  //           onProgress: (job) => {
  //             console.log('[Deep Research] Progress:', job)
  //           }
  //         })
  //
  //         // Show the research panel
  //         setShowDeepResearchPanel(true)
  //       }
  //     }
  //   }
  // }, [messages, detectIntent, shouldAutoTrigger, createSession, deepResearch.startResearch, deepResearch.loading])

  // Monitor messages for web search indicator
  useEffect(() => {
    if (messages && messages.length > 0 && isLoading) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'assistant' && lastMessage.content) {
        // Check if the content includes the new search started indicator
        const searchStartedMatch = lastMessage.content.match(/\[WEB_SEARCH_STARTED\](.*?)\[\/WEB_SEARCH_STARTED\]/)
        if (searchStartedMatch) {
          try {
            const searchData = JSON.parse(searchStartedMatch[1])
            setIsSearchingWeb(true)
            setWebSearchQuery(searchData.query || '')
          } catch (error) {
            console.error('Failed to parse web search data:', error)
            setIsSearchingWeb(true)
            setWebSearchQuery('')
          }
        }

        // Check for the old format for backward compatibility
        if (lastMessage.content.includes('[SEARCHING_WEB]')) {
          setIsSearchingWeb(true)
        }

        // Check if search is completed
        if (lastMessage.content.includes('[WEB_SEARCH_COMPLETED]')) {
          setIsSearchingWeb(false)
          setWebSearchQuery('')
        }
      }
    } else if (!isLoading) {
      // Reset search state when not loading
      setIsSearchingWeb(false)
      setWebSearchQuery('')
    }
  }, [messages, isLoading])

  // Handle chat changes - reset messages when switching chats or starting new chat
  useEffect(() => {
    // Check if chat has changed
    const chatChanged = prevChatIdRef.current !== chatId
    const messagesChanged = prevInitialMessagesRef.current !== initialMessages

    if (chatChanged || messagesChanged) {
      // Chat changed, resetting state

      // Clear file uploads when switching chats
      clearSelectedFile('chat-switch')
      clearSelectedFiles('chat-switch')
      setUploadStatus('idle')
      uploadedFilesRef.current.clear()
      sentFilesRef.current.clear()
      console.log('[Chat Switch] Cleared sent files tracking')

      // Update refs
      prevChatIdRef.current = chatId || null
      prevInitialMessagesRef.current = initialMessages

      // If initialMessages is undefined (new chat), the hook will use defaultInitialMessages
      // The messages will be properly reset by the useChatWithTools hook
    }
  }, [chatId, initialMessages])

  // Update messageAttachments when initialMessageAttachments changes (e.g., loading a chat)
  useEffect(() => {
    if (initialMessageAttachments && Object.keys(initialMessageAttachments).length > 0) {
      console.log('[ChatInterface] Updating messageAttachments from initialMessageAttachments:', {
        messageCount: Object.keys(initialMessageAttachments).length,
        totalAttachments: Object.values(initialMessageAttachments).reduce((sum, atts) => sum + atts.length, 0)
      })
      setMessageAttachments(initialMessageAttachments)
    }
  }, [initialMessageAttachments])


  // Track if we just handled a paste to skip the next input change

  // Wrapper for input change to also check for URLs

  // Clear files after successful submission (not just upload)
  useEffect(() => {
    // Only clear if we have messages and a file was just processed
    if (!isLoading && messages && messages.length > 1 && (selectedFile || selectedFiles.length > 0)) {
      const lastMessage = messages[messages.length - 1]
      const previousMessage = messages[messages.length - 2]

      // Check if the last message is from assistant and previous was from user with our file
      if (lastMessage?.role === 'assistant' && previousMessage?.role === 'user') {
        // Check if the user message had our file attachment
        const userMessageAttachments = messageAttachments[previousMessage.id]
        if (userMessageAttachments && userMessageAttachments.length > 0) {
          console.log('[Post-Analysis] Files analyzed, checking if they should be cleared')

          // Check if new files are being uploaded - if so, don't clear
          if (isUploadingNewFilesRef.current) {
            console.log('[Post-Analysis] New files being uploaded, skipping clear')
            return
          }

          // Build list of files that can be cleared (only those that were sent)
          const filesToClear: FileUpload[] = []
          const filesToKeep: FileUpload[] = []

          // Check single file
          if (selectedFile && sentFilesRef.current.has(selectedFile.file.name)) {
            filesToClear.push(selectedFile)
          } else if (selectedFile) {
            filesToKeep.push(selectedFile)
          }

          // Check multiple files
          selectedFiles.forEach(file => {
            if (sentFilesRef.current.has(file.file.name)) {
              filesToClear.push(file)
            } else {
              filesToKeep.push(file)
            }
          })

          console.log('[Post-Analysis] Files to clear:', filesToClear.map(f => f.file.name))
          console.log('[Post-Analysis] Files to keep:', filesToKeep.map(f => f.file.name))

          // If all current files were sent, proceed with cleanup
          if (filesToClear.length > 0 && filesToKeep.length === 0) {
            // For ALL file types (including images), keep them visible until user takes action
            const hasMediaFiles = userMessageAttachments.some(att =>
              att.contentType?.startsWith('video/') ||
              att.contentType?.startsWith('audio/') ||
              att.contentType?.startsWith('image/')
            )

            // Keep ALL files (media and non-media) visible - user can manually remove if needed
            console.log('[Post-Analysis] Files detected, keeping all files in input area')

            // Check what types of files we have
            const hasImages = userMessageAttachments.some(att => att.contentType?.startsWith('image/'))
            const hasVideos = userMessageAttachments.some(att => att.contentType?.startsWith('video/'))
            const hasAudio = userMessageAttachments.some(att => att.contentType?.startsWith('audio/'))

            // Ensure options stay visible by setting them explicitly for media files
            if (hasImages) {
              setShowImageOptions(true)
              setOptionsShownAt(Date.now())
            }
            if (hasVideos) {
              setShowVideoOptions(true)
              setOptionsShownAt(Date.now())
            }

            // Don't clear ANY files at all - let user decide when to remove them
            console.log('[Post-Analysis] All files will remain in input area until user removes them')

            // Clear the sent files tracking so they can be re-analyzed if needed
            filesToClear.forEach(file => {
              sentFilesRef.current.delete(file.file.name)
            })

            // Clear any existing cleanup timeout to prevent future auto-clearing
            if (cleanupTimeoutRef.current) {
              clearTimeout(cleanupTimeoutRef.current)
              cleanupTimeoutRef.current = null
              console.log('[Post-Analysis] Cleared cleanup timeout - no auto-clearing will occur')
            }
          } else if (filesToKeep.length > 0) {
            console.log('[Post-Analysis] Keeping newly uploaded files that haven\'t been sent yet')
          }
        }
      }
    }

    // Cleanup function to clear timeout if component unmounts or effect re-runs
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
      }
    }
  }, [isLoading, messages, selectedFile, selectedFiles, messageAttachments, clearSelectedFile, clearSelectedFiles, showImageOptions, showVideoOptions])

  // Notify parent when messages or attachments change
  useEffect(() => {
    // Pass both messages and attachments to parent
    onMessagesChange?.(messages, messageAttachments)
  }, [messages, messageAttachments, onMessagesChange])

  // Process pending attachments when new messages are added
  useEffect(() => {
    if (messages && messages.length > 0 && pendingAttachmentRef.current) {
      // Process immediately without delay for instant display
      // Find the latest user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()

      if (lastUserMessage && !messageAttachments[lastUserMessage.id] && pendingAttachmentRef.current) {
        console.log('[Attachment Processing] Processing pending attachments for message:', lastUserMessage.id)

        const pendingAttachment = pendingAttachmentRef.current
        const newAttachments: any[] = []

        // Add the primary attachment
        newAttachments.push({
          name: pendingAttachment.name,
          contentType: pendingAttachment.contentType,
          url: pendingAttachment.url,
          transcription: pendingAttachment.transcription,
          videoThumbnail: pendingAttachment.videoThumbnail,
          videoDuration: pendingAttachment.videoDuration
        })

        // Add additional files if they exist
        if (pendingAttachment.additionalFiles && pendingAttachment.additionalFiles.length > 0) {
          newAttachments.push(...pendingAttachment.additionalFiles)
        }

        // Update message attachments immediately
        setMessageAttachments(prev => ({
          ...prev,
          [lastUserMessage.id]: newAttachments
        }))

        console.log('[Attachment Processing] Added', newAttachments.length, 'attachments to message:', lastUserMessage.id)

        // Clear pending attachments
        pendingAttachmentRef.current = null
      }
    }
  }, [messages]) // Remove messageAttachments from dependencies to avoid infinite loops

  // Debounced script detection to prevent UI freezing during streaming
  const scriptDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedMessageIdRef = useRef<string | null>(null)

  // Watch for script generation in messages (debounced for performance)
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Skip user messages
    if (lastMessage?.role === 'user') {
      return
    }

    // Only check assistant messages for script detection
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      // Skip if this message contains data injection markers
      if (lastMessage.content.includes('[VIDEO_GENERATION_STARTED]') ||
          lastMessage.content.includes('[IMAGE_EDITING_COMPLETED]') ||
          lastMessage.content.includes('[IMAGE_GENERATION_COMPLETED]')) {
        return
      }

      // Skip if this message contains transcription
      if (lastMessage.content.includes('### Word-for-Word Transcription') ||
          lastMessage.content.includes('### Audio Transcription') ||
          lastMessage.content.includes('### Transcription') ||
          lastMessage.content.includes('**Audio Transcription') ||
          lastMessage.content.includes('**Complete Transcription')) {
        console.log('[Script Detection] Skipping transcription content')
        return
      }

      // Skip if we've already processed this message to avoid redundant operations
      if (lastProcessedMessageIdRef.current === lastMessage.id) {
        return
      }

      // Clear any existing timeout to debounce the detection
      if (scriptDetectionTimeoutRef.current) {
        clearTimeout(scriptDetectionTimeoutRef.current)
      }

      // Debounce script detection by 500ms to prevent UI blocking during streaming
      scriptDetectionTimeoutRef.current = setTimeout(() => {
        // Double-check the message still exists and hasn't changed
        const currentLastMessage = messages[messages.length - 1]
        if (currentLastMessage?.id !== lastMessage.id || currentLastMessage?.role !== 'assistant') {
          return
        }

        // Mark this message as processed
        lastProcessedMessageIdRef.current = lastMessage.id

        // Check if the message contains a script
        const previousUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]
        const scriptDetection = detectScript(lastMessage.content, previousUserMessage)

        if (scriptDetection.isScript) {
        console.log('[Script Detection] Script detected in message:', {
          messageId: lastMessage.id,
          length: scriptDetection.length,
          estimatedDuration: scriptDetection.estimatedDuration,
          preview: lastMessage.content.substring(0, 100) + '...'
        })

        // Check if audio has already been generated for this script
        const scriptHash = hashScript(lastMessage.content)
        const audioAlreadyGenerated = generatedScriptHashes.has(scriptHash)

        if (!audioAlreadyGenerated) {
          // Update script state
          setLastDetectedScript({
            content: lastMessage.content,
            messageId: lastMessage.id,
            length: scriptDetection.length
          })

        } else {
          console.log('[Script Detection] Audio already generated for this script')
        }
      } else {
        // Log why it wasn't detected as a script for debugging
        console.log('[Script Detection] Not detected as script:', {
          messageId: lastMessage.id,
          contentLength: lastMessage.content.length,
          preview: lastMessage.content.substring(0, 100) + '...'
        })
      }
      }, 500) // 500ms debounce delay
    }
  }, [messages, detectScript])

  // Watch for assistant messages with video/audio transcription
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Only check assistant messages
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      console.log('[Transcription Parser] Checking assistant message, content length:', lastMessage.content.length)
      console.log('[Transcription Parser] Content preview:', lastMessage.content.substring(0, 200))

      // Check if this message contains transcription
      if (hasTranscription(lastMessage.content)) {
        console.log('[Transcription Parser] Detected transcription in assistant message')

        // Parse the transcription
        const parsedTranscription = parseGeminiTranscription(lastMessage.content)

        if (parsedTranscription) {
          console.log('[Transcription Parser] Successfully parsed transcription:', {
            textLength: parsedTranscription.text.length,
            segmentCount: parsedTranscription.segments.length,
            duration: parsedTranscription.duration,
            language: parsedTranscription.language
          })

          // Look for the previous user message that might have the video/audio attachment
          let userMessageId = null

          // Search backwards through messages to find the most recent user message with video/audio attachment
          for (let i = messages.length - 2; i >= 0; i--) {
            const msg = messages[i]
            if (msg.role === 'user' && messageAttachments[msg.id]) {
              const attachments = messageAttachments[msg.id]
              const hasVideoOrAudio = attachments.some(att =>
                att.contentType.startsWith('video/') || att.contentType.startsWith('audio/')
              )
              if (hasVideoOrAudio) {
                userMessageId = msg.id
                break
              }
            }
          }

          if (userMessageId && messageAttachments[userMessageId]) {
            console.log('[Transcription Parser] Found user message with video/audio attachment:', userMessageId)

            // Update the attachments with transcription
            const updatedAttachments = messageAttachments[userMessageId].map((att) => {
              if (att.contentType.startsWith('video/') || att.contentType.startsWith('audio/')) {
                console.log('[Transcription Parser] Adding transcription to attachment:', att.name)
                return {
                  ...att,
                  transcription: parsedTranscription
                }
              }
              return att
            })

            setMessageAttachments(prev => ({
              ...prev,
              [userMessageId]: updatedAttachments
            }))

            console.log('[Transcription Parser] Updated message attachments with transcription')
          } else {
            console.log('[Transcription Parser] No user message with video/audio attachment found')
          }
        }
      }
    }
  }, [messages]) // Remove messageAttachments from dependencies to avoid infinite loop

  // Watch for assistant messages with image generation data
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Only check assistant messages
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      // Check if this message contains image generation data
      const imageGenerationMatch = lastMessage.content.match(/\[IMAGE_GENERATION_COMPLETED\]([\s\S]*?)\[\/IMAGE_GENERATION_COMPLETED\]/)

      if (imageGenerationMatch) {
        // Create a unique key for this image generation to prevent duplicates
        const imageGenerationKey = `${lastMessage.id}-${imageGenerationMatch[0].substring(0, 100)}`

        // Check if we've already processed this specific image generation
        if (processedImageGenerationRef.current.has(imageGenerationKey)) {
          console.log('[Image Generation Parser] Already processed this image generation, skipping')
          return
        }

        console.log('[Image Generation Parser] Detected image generation data in assistant message')

        try {
          const imageData = JSON.parse(imageGenerationMatch[1])
          console.log('[Image Generation Parser] Parsed image data:', imageData)

          if (imageData.success && imageData.images && imageData.images.length > 0) {
            // Mark this generation as processed before creating images
            processedImageGenerationRef.current.add(imageGenerationKey)

            // Create GeneratedImage objects from the data
            const newImages: GeneratedImage[] = imageData.images.map((img: any) => ({
              id: generateImageId(),
              url: img.url,
              prompt: imageData.metadata.originalPrompt || imageData.prompt,
              revisedPrompt: img.revisedPrompt,
              timestamp: new Date(),
              quality: imageData.metadata.quality as 'standard' | 'hd',
              style: imageData.metadata.style as 'vivid' | 'natural',
              size: imageData.metadata.size,
              model: imageData.metadata.model,
              isGenerating: false,
            }))

            console.log('[Image Generation Parser] Processing', newImages.length, 'completed images')

            // Find and replace any placeholders for this prompt
            let updatedImages = [...generatedImages]
            const originalPrompt = imageData.metadata.originalPrompt || imageData.prompt
            const cleanedPrompt = imageData.prompt

            console.log('[Image Generation Parser] Looking for placeholder with prompts:', {
              original: originalPrompt,
              cleaned: cleanedPrompt
            })

            // Look for placeholders that match either the original or cleaned prompt
            const placeholderIndex = updatedImages.findIndex(img =>
              img.isGenerating && (
                img.prompt === cleanedPrompt ||
                img.prompt === originalPrompt ||
                img.prompt === extractImagePrompt(originalPrompt)
              )
            )

            if (placeholderIndex !== -1) {
              // Replace placeholder with actual images
              console.log('[Image Generation Parser] Replacing placeholder at index', placeholderIndex)
              updatedImages.splice(placeholderIndex, 1, ...newImages)
            } else {
              // No placeholder found, just add the images
              console.log('[Image Generation Parser] No placeholder found, adding images to gallery')
              updatedImages = [...updatedImages, ...newImages]
            }

            onGeneratedImagesChange?.(updatedImages)

            // Switch to Images tab to show the new images
            onImageGenerationStart?.()
          } else if (imageData.success === false && imageData.error) {
            // Handle image generation failure
            console.error('[Image Generation Parser] Image generation failed:', imageData.error)

            // Show error toast notification
            toast.error(`Image generation failed: ${imageData.error}`, {
              description: `Model: ${imageData.model || 'Unknown'} | Prompt: ${imageData.prompt}`,
              duration: 5000,
            })

            // Remove any placeholders for this failed generation
            const originalPrompt = imageData.prompt

            // Filter out any generating placeholders for this prompt
            const filteredImages = generatedImages.filter(img =>
              !(img.isGenerating && (
                img.prompt === originalPrompt ||
                img.prompt === extractImagePrompt(originalPrompt)
              ))
            )

            onGeneratedImagesChange?.(filteredImages)
          }
        } catch (error) {
          console.error('[Image Generation Parser] Failed to parse image data:', error)
        }
      }
    }
  }, [messages, onGeneratedImagesChange, onImageGenerationStart])

  // Watch for user messages with image generation requests to create placeholders
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // Check if it's a user message
    if (lastMessage?.role === 'user' && lastMessage.content) {
      // Check if this is an image generation request
      if (isImageGenerationRequest(lastMessage.content)) {
        console.log('[Chat Interface] Detected image generation request in user message:', lastMessage.content)

        // Create a unique key to prevent duplicate placeholders
        const placeholderKey = `user-${lastMessage.id}-placeholder`

        // Check if we've already created a placeholder for this message
        if (processedImageGenerationRef.current.has(placeholderKey)) {
          console.log('[Chat Interface] Placeholder already created for this message')
          return
        }

        // Extract the cleaned prompt (same as ImageGenerationHandler does)
        const cleanedPrompt = extractImagePrompt(lastMessage.content)
        console.log('[Chat Interface] Extracted prompt:', cleanedPrompt, 'from:', lastMessage.content)

        // Check if a placeholder already exists for this prompt
        const existingPlaceholder = generatedImages.find(img =>
          img.isGenerating && (img.prompt === cleanedPrompt || img.prompt === lastMessage.content)
        )

        if (existingPlaceholder) {
          console.log('[Chat Interface] Placeholder already exists for this prompt')
          return
        }

        // Mark as processed
        processedImageGenerationRef.current.add(placeholderKey)

        // Create placeholder image with cleaned prompt
        const placeholder: GeneratedImage = {
          id: generateImageId(),
          url: '', // Empty URL for placeholder
          prompt: cleanedPrompt, // Use cleaned prompt for better matching
          revisedPrompt: '',
          timestamp: new Date(),
          quality: currentImageSettings.quality,
          style: currentImageSettings.style,
          size: currentImageSettings.size,
          model: currentImageSettings.model,
          isGenerating: true, // This marks it as a placeholder
        }

        console.log('[Chat Interface] Creating placeholder for image generation request with settings:', {
          quality: currentImageSettings.quality,
          style: currentImageSettings.style,
          size: currentImageSettings.size,
          model: currentImageSettings.model
        })

        // Add placeholder to gallery
        onGeneratedImagesChange?.([...generatedImages, placeholder])

        // Switch to Images tab
        onImageGenerationStart?.()

        console.log('[Chat Interface] Placeholder created and Images tab should switch')
      }
    }
  }, [messages, generatedImages, currentImageSettings, onGeneratedImagesChange, onImageGenerationStart])

  // Handle model change
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model)
    onModelChange?.(model)
  }, [onModelChange])




  // Reset chat state when chatId changes or reset is requested
  useEffect(() => {
    if (chatId === null && onResetChat) {
      // Clear local state when starting a new chat
      // setLocalMessages([]) // Removed - no longer using local messages for image generation
      clearSelectedFile('chat-reset')
      setMessageAttachments({})
      pendingAttachmentRef.current = null
      pendingAttachmentBackupRef.current = null
      attachmentsDisplayedRef.current.clear()
      sentFilesRef.current.clear()
      processedImageGenerationRef.current.clear()
      console.log('[Chat Reset] Cleared sent files and image generation tracking')
    }
  }, [chatId, onResetChat])

  // REMOVED: Duplicate useEffect - keeping the newer one with debug logs below

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      // Delay cleanup to ensure URLs are still valid when needed
      setTimeout(() => {
        for (const url of objectURLsRef.current) {
          URL.revokeObjectURL(url)
        }
      }, 5000) // 5 second delay
    }
  }, [])

  // Clear local messages when real messages change (to prevent duplicates)
  // But preserve image generation success messages
  useEffect(() => {
    if (messages && messages.length > 1) { // Keep initial welcome message check
      // Keep user messages for image generation
      // setLocalMessages(prev => prev) // Removed - no longer using local messages
    }
  }, [messages?.length])

  // Process a single file (extracted from handleFileSelect for reuse)
  const processFile = useCallback(async (file: File): Promise<FileUpload> => {
    const fileUpload: FileUpload = { file }

    // Create preview for images
    if (file.type.startsWith("image/")) {
      try {
        // Convert to data URL for persistence
        const reader = new FileReader()
        const preview = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Handle HEIC conversion
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') ||
            file.name.toLowerCase().endsWith('.heif')) {

          const convertFormData = new FormData()
          convertFormData.append('file', file)

          const convertResponse = await fetch('/api/convert-heic', {
            method: 'POST',
            body: convertFormData
          })

          if (convertResponse.ok) {
            const { preview: convertedPreview } = await convertResponse.json()
            fileUpload.preview = convertedPreview
          } else {
            fileUpload.preview = preview
          }
        } else {
          fileUpload.preview = preview
        }

        // Get aspect ratio for image-to-video
        try {
          const aspectRatio = await getImageAspectRatio(file)
          fileUpload.aspectRatio = aspectRatio
        } catch (error) {
          console.warn('Failed to get image aspect ratio:', error)
        }
      } catch (error) {
        console.error('Failed to create image preview:', error)
      }
    }

    // Generate thumbnail and duration for videos
    if (file.type.startsWith("video/")) {
      try {
        console.log(`[processFile] Generating thumbnail for video: ${file.name}`)
        fileUpload.videoThumbnail = await generateVideoThumbnail(file, 2.0)
        fileUpload.videoDuration = await getVideoDuration(file)
        console.log(`[processFile] Video thumbnail generated, duration: ${fileUpload.videoDuration}s`)
      } catch (error) {
        console.error('Failed to generate video thumbnail:', error)
      }
    }

    // Upload to Google AI for processing
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('File upload failed. Status:', response.status, 'Body:', errorBody);
        throw new Error(`File upload failed with status: ${response.status}`);
      }

      const result = await response.json()

      // The API returns 'file' not 'geminiFile'
      if (result.file) {
        fileUpload.geminiFile = result.file
      }

      if (result.transcription) {
        fileUpload.transcription = result.transcription
      }

      if (result.videoThumbnail) {
        fileUpload.videoThumbnail = result.videoThumbnail
      }

      if (result.videoDuration) {
        fileUpload.videoDuration = result.videoDuration
      }

      // Store file reference for later transcription parsing
      if (fileUpload.geminiFile && fileUpload.geminiFile.uri) {
        uploadedFilesRef.current.set(fileUpload.geminiFile.uri, fileUpload)
      }
    } catch (error) {
      console.error('File upload failed:', error)
      throw error
    }

    return fileUpload
  }, [])

  // Handle multiple files
  const handleFilesSelect = useCallback(async (files: File[]) => {
    // Reset user interaction state when new files upload starts
    setUserHasInteractedWithOptions(false)

    isUploadingNewFilesRef.current = true
    fileUploadTimestampRef.current = Date.now() // Set new timestamp for this upload

    // Clear any existing cleanup timeout from previous uploads
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
      console.log('[Upload] Cleared existing cleanup timeout for multiple files')
    }

    setIsUploading(true)
    setUploadStatus('uploading')

    // If we have a single file selected, convert it to the multiple files array first
    if (selectedFile && selectedFiles.length === 0) {
      // Add the existing single file to the array
      setSelectedFiles([selectedFile])
      setSelectedFile(null)
      setShowImageOptions(false)
    }

    const processedFiles: FileUpload[] = []

    try {
      // Calculate progress based on existing files + new files
      const existingCount = selectedFiles.length
      const totalCount = existingCount + files.length

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const progress = ((existingCount + i + 1) / totalCount) * 100
        setUploadProgress(progress)

        // Process each file
        const fileUpload = await processFile(file)
        processedFiles.push(fileUpload)
      }

      // Append to existing files instead of replacing
      setSelectedFiles(prev => [...prev, ...processedFiles])
      setUploadStatus('complete')

      // Check if any of the uploaded files are images and show image options
      const hasImages = processedFiles.some(file => file.file.type.startsWith('image/'))
      const existingImages = selectedFiles.some(file => file.file.type.startsWith('image/'))

      if (hasImages || existingImages) {
        setShowImageOptions(true)
      }

      const totalFiles = selectedFiles.length + files.length
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} added (${totalFiles} total)`)
    } catch (error: any) {
      console.error('Multiple file upload error:', error)
      setUploadStatus('error')
      toast.error("File Upload Failed", {
        description: error.message || "An error occurred while uploading files."
      })
    } finally {
      setIsUploading(false)
      isUploadingNewFilesRef.current = false
      setTimeout(() => {
        setUploadStatus('idle')
        setUploadProgress(0)
      }, 3000)
    }
  }, [processFile, selectedFile, selectedFiles])


  // Watch for new messages and attach pending files
  useEffect(() => {
    console.trace('[EFFECT] Attachment effect triggered:', {
      messagesCount: messages?.length || 0,
      hasPending: !!pendingAttachmentRef.current || !!pendingAttachmentBackupRef.current,
      messageIds: messages?.map(m => ({ id: m.id, role: m.role })) || [],
      attachmentKeys: Object.keys(messageAttachments),
      tempMessageId: tempMessageIdRef.current
    })

    if (messages && messages.length > 0 && (pendingAttachmentRef.current || pendingAttachmentBackupRef.current)) {
      const lastMessage = messages[messages.length - 1]
      console.log('[EFFECT] Processing last message:', {
        id: lastMessage.id,
        role: lastMessage.role,
        hasAttachments: !!messageAttachments[lastMessage.id],
        content: lastMessage.content.substring(0, 50)
      })

      // Check if this is a new user message without attachments
      if (lastMessage.role === 'user' && !messageAttachments[lastMessage.id]) {
        console.log('[EFFECT] Processing attachment for user message:', {
          messageId: lastMessage.id,
          hasTempId: !!tempMessageIdRef.current,
          hasFirstMessageAttachments: !!firstMessageAttachments
        })

        // Check if we have pre-set attachments with a temp ID
        if (tempMessageIdRef.current && messageAttachments[tempMessageIdRef.current]) {
          console.log('[EFFECT] Found pre-set attachments with temp ID:', tempMessageIdRef.current)

          // Move attachments from temp ID to real message ID
          setMessageAttachments(prev => {
            const tempAttachments = prev[tempMessageIdRef.current!]
            const updated = {
              ...prev,
              [lastMessage.id]: tempAttachments
            }
            // Remove the temp ID entry
            delete updated[tempMessageIdRef.current!]

            console.log('[EFFECT] Moved attachments from temp to real message ID:', {
              tempId: tempMessageIdRef.current,
              realId: lastMessage.id,
              attachmentCount: tempAttachments?.length || 0
            })

            // CRITICAL: Notify parent immediately with updated attachments
            // This ensures attachments are available when creating a new chat
            onMessagesChange?.(messages, updated)

            return updated
          })

          // Clear the temp ID
          tempMessageIdRef.current = null

          // Mark as displayed and clear after delay
          attachmentsDisplayedRef.current.add(lastMessage.id)
          setTimeout(() => {
            console.log('[EFFECT] Clearing pending attachments after successful association');
            pendingAttachmentRef.current = null
            pendingAttachmentBackupRef.current = null
            // Don't clear files immediately - let user interact with options
            // clearSelectedFile('attachment-processed')
            // clearSelectedFiles('attachment-processed')
          }, 500)

          return // Exit early since we handled the attachments
        }

        // Use pending attachment (prefer current over backup)
        const attachment = pendingAttachmentRef.current || pendingAttachmentBackupRef.current

        if (!attachment && !firstMessageAttachments) {
          console.log('[EFFECT] No pending attachments or first message attachments found')
          return
        }

        // If we have first message attachments but no pending, use those
        if (!attachment && firstMessageAttachments) {
          console.log('[EFFECT] Using firstMessageAttachments as fallback')

          setTimeout(() => {
            setMessageAttachments(prev => ({
              ...prev,
              [lastMessage.id]: firstMessageAttachments
            }))
          }, 0)

          // Clear after use
          setTimeout(() => {
            setFirstMessageAttachments(null)
          }, 100)

          // Notify parent
          onMessagesChange?.(messages, {
            ...messageAttachments,
            [lastMessage.id]: firstMessageAttachments
          })

          return
        }

        // Create an array with the primary attachment and any additional files
        const allAttachments: {
          name: string
          contentType: string
          url?: string
          transcription?: {
            text: string
            language?: string
            duration?: number
            segments?: Array<{
              start: number
              end: number
              text: string
            }>
          }
          videoThumbnail?: string
          videoDuration?: number
        }[] = [];

        // Add the primary attachment (extract just the attachment properties)
        allAttachments.push({
          name: attachment.name,
          contentType: attachment.contentType,
          url: attachment.url,
          transcription: attachment.transcription,
          videoThumbnail: attachment.videoThumbnail,
          videoDuration: attachment.videoDuration
        });

        // Add additional files if they exist
        if (attachment.additionalFiles && attachment.additionalFiles.length > 0) {
          allAttachments.push(...attachment.additionalFiles);
        }

        console.log('[EFFECT] All attachments to be set:', allAttachments.length, 'files', allAttachments)

        // ENHANCED: Set attachments with retry mechanism
        const setAttachmentsWithRetry = (retryCount = 0) => {
          const maxRetries = 3;

          setMessageAttachments(prev => {
            const updated = {
              ...prev,
              [lastMessage.id]: allAttachments
            };
            console.log('[EFFECT] Setting messageAttachments for:', lastMessage.id, 'attachments:', allAttachments.length);

            // CRITICAL: Notify parent immediately when attachments are set
            // This ensures attachments are included when creating a new chat
            onMessagesChange?.(messages, updated);

            // Verify the attachment was set correctly
            setTimeout(() => {
              if (!updated[lastMessage.id] && retryCount < maxRetries) {
                console.log('[EFFECT] Attachment setting failed, retrying...', retryCount + 1);
                setAttachmentsWithRetry(retryCount + 1);
              } else {
                console.log('[EFFECT] Attachments successfully set for message:', lastMessage.id);
                // Mark as displayed
                attachmentsDisplayedRef.current.add(lastMessage.id);
              }
            }, 100);

            return updated;
          });
        };

        // Execute attachment setting
        setAttachmentsWithRetry();

        // Clear the pending attachment and file states after a small delay
        setTimeout(() => {
          if (attachmentsDisplayedRef.current.has(lastMessage.id)) {
            pendingAttachmentRef.current = null
            pendingAttachmentBackupRef.current = null
            // Don't clear files immediately after submission - let post-analysis effect handle it
            // This allows users to interact with options
            console.log('[SUBMIT] Preserving files and options after submission for user interaction')
            // clearSelectedFile('submit-complete', true) // Preserve options after submission
            // clearSelectedFiles('submit-complete', true) // Preserve options after submission
            console.log('[EFFECT] Cleared pending attachments and selected files, preserved options');
          }
        }, 500);

      } else if (lastMessage.role === 'user' && messageAttachments[lastMessage.id] && (pendingAttachmentRef.current || pendingAttachmentBackupRef.current)) {
        // If attachments are already set (from render), just clear pending
        console.log('[EFFECT] Attachments already set during render, clearing pending refs')
        pendingAttachmentRef.current = null
        pendingAttachmentBackupRef.current = null
        clearSelectedFile('already-attached', true) // Preserve options
        clearSelectedFiles('already-attached', true) // Preserve options
      }
    }

    // ADDITIONAL: Handle case where we have selected files but no pending attachment ref
    if (messages && messages.length > 0 && !pendingAttachmentRef.current && (selectedFile || selectedFiles.length > 0)) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user' && !messageAttachments[lastMessage.id]) {
        // Check if this message was just created (within last 2 seconds)
        const messageAge = lastMessage.createdAt ? Date.now() - lastMessage.createdAt.getTime() : 0;
        if (messageAge < 2000) {
          console.log('[EFFECT] Found recent user message without attachments, but have selected files');

          const attachmentsFromFiles: any[] = [];

          // Process single file
          if (selectedFile) {
            attachmentsFromFiles.push({
              name: selectedFile.file.name,
              contentType: selectedFile.file.type,
              url: selectedFile.preview || '',
              transcription: selectedFile.transcription,
              videoThumbnail: selectedFile.videoThumbnail,
              videoDuration: selectedFile.videoDuration
            });
          }

          // Process multiple files
          selectedFiles.forEach(file => {
            attachmentsFromFiles.push({
              name: file.file.name,
              contentType: file.file.type,
              url: file.preview || '',
              transcription: file.transcription,
              videoThumbnail: file.videoThumbnail,
              videoDuration: file.videoDuration
            });
          });

          if (attachmentsFromFiles.length > 0) {
            console.log('[EFFECT] Setting attachments from selected files:', attachmentsFromFiles.length);
            setMessageAttachments(prev => {
              const updated = { ...prev, [lastMessage.id]: attachmentsFromFiles };
              onMessagesChange?.(messages, updated);
              return updated;
            });

            // IMPORTANT: Do NOT auto-clear files after setting attachments
            // Files should remain visible so users can interact with options (Analyze, Reverse Engineer, etc.)
            // Users must manually remove files when they're done
            // This prevents the frustrating experience of options disappearing before they can be clicked

            // setTimeout(() => {
            //   clearSelectedFile('attachments-from-files-processed', true); // Preserve options
            //   clearSelectedFiles('attachments-from-files-processed', true); // Preserve options
            // }, 100);
          }
        }
      }
    }
  }, [messages, onMessagesChange, firstMessageAttachments]) // Remove messageAttachments from dependencies to avoid re-running when it updates

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      // Delay cleanup to ensure URLs are still valid when needed
      setTimeout(() => {
        for (const url of objectURLsRef.current) {
          URL.revokeObjectURL(url)
        }
      }, 5000) // 5 second delay
    }
  }, [])

  // Clear local messages when real messages change (to prevent duplicates)
  // But preserve image generation success messages
  useEffect(() => {
    if (messages && messages.length > 1) { // Keep initial welcome message check
      // setLocalMessages(prev => prev.filter(msg =>
      //   msg.id.startsWith('img-success-') ||
      //   msg.id.startsWith('img-error-')
      // )) // Removed - no longer using local messages
    }
  }, [messages?.length])


  const handleFileSelect = useCallback(async (file: File) => {
    // Reset user interaction state when a new file upload starts
    setUserHasInteractedWithOptions(false)

    // Always set upload timestamp when a new file is selected
    fileUploadTimestampRef.current = Date.now()
    console.log('[Upload] New file selected:', file.name, 'timestamp:', fileUploadTimestampRef.current)

    // Check if we already have a file selected
    if (selectedFile || selectedFiles.length > 0) {
      // We have existing files, we need to convert to multiple files mode
      // First, process the new file
      isUploadingNewFilesRef.current = true

      // Clear any existing cleanup timeout from previous uploads
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
        cleanupTimeoutRef.current = null
        console.log('[Upload] Cleared existing cleanup timeout for additional file')
      }

      setIsUploading(true)
      setUploadProgress(0)
      setUploadStatus('uploading')

      try {
        const processedFile = await processFile(file)

        // Convert single file to array if needed and add new file
        if (selectedFile && selectedFiles.length === 0) {
          setSelectedFiles([selectedFile, processedFile])
          setSelectedFile(null)

          // Check if we have images and keep image options visible
          const hasImages = selectedFile.file.type.startsWith('image/') || processedFile.file.type.startsWith('image/')
          setShowImageOptions(hasImages)
        } else {
          setSelectedFiles(prev => [...prev, processedFile])

          // Check if any files are images and show image options
          const hasImages = processedFile.file.type.startsWith('image/') ||
                           selectedFiles.some(file => file.file.type.startsWith('image/'))
          if (hasImages) {
            setShowImageOptions(true)
          }
        }

        setUploadStatus('complete')
        toast.success(`File added successfully`)
      } catch (error: any) {
        console.error("File upload error:", error)
        setUploadStatus('error')
        toast.error("File Upload Failed", {
          description: error.message || "An error occurred while uploading the file. Please try again."
        })
      } finally {
        setIsUploading(false)
        isUploadingNewFilesRef.current = false
        setTimeout(() => {
          setUploadStatus('idle')
          setUploadProgress(0)
        }, 2000)
      }
      return
    }

    // This is the first file, handle as single file
    isUploadingNewFilesRef.current = true
    fileUploadTimestampRef.current = Date.now() // Set new timestamp for this upload

    // Clear any existing cleanup timeout from previous uploads
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
      console.log('[Upload] Cleared existing cleanup timeout')
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('uploading')

    // Clear multiple files array when selecting a single file
    setSelectedFiles([])

    try {
      // Create preview for images, audio, and video files
      let preview: string | undefined
      let videoThumbnail: string | undefined
      let videoDuration: number | undefined

      if (file.type.startsWith("image/")) {
        // Check if it's a HEIC/HEIF file (browsers can't display these)
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
          console.log('HEIC file detected, converting to JPEG for preview...')
          setUploadStatus('converting')
          setUploadProgress(0)

          try {
            // Convert HEIC to JPEG for preview
            const convertFormData = new FormData()
            convertFormData.append('file', file)

            const convertResponse = await fetch('/api/convert-heic', {
              method: 'POST',
              body: convertFormData
            })

            if (convertResponse.ok) {
              const { preview: convertedPreview, conversionTime } = await convertResponse.json()
              console.log(`HEIC converted successfully in ${conversionTime}`)
              preview = convertedPreview // Use the converted JPEG data URL
              setUploadProgress(100)
            } else {
              const errorData = await convertResponse.json()
              console.warn('HEIC conversion failed:', errorData.error)
              console.warn('Details:', errorData.details)
              // Continue without preview
              preview = undefined
            }
          } catch (error) {
            console.error('HEIC conversion error:', error)
            // Continue without preview
            preview = undefined
          }

          // Reset converting status
          setUploadStatus('uploading')
          setUploadProgress(0)
        } else {
          // Convert to data URL for image editing compatibility
          const reader = new FileReader()
          preview = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        }
      } else if (file.type.startsWith("audio/")) {
        // Convert audio to data URL for persistence
        const reader = new FileReader()
        preview = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      } else if (file.type.startsWith("video/")) {
        // For video files, convert to data URL for persistence
        const reader = new FileReader()
        preview = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        try {
          // Generate thumbnail at 2 seconds (or 0 if video is shorter)
          videoThumbnail = await generateVideoThumbnail(file, 2.0)
          videoDuration = await getVideoDuration(file)
          console.log('Video thumbnail generated, duration:', videoDuration)
        } catch (thumbError) {
          console.error('Failed to generate video thumbnail:', thumbError)
          // Continue without thumbnail
        }
      }

      // Track upload start time for progress estimation
      const uploadStartTime = Date.now()
      const fileSizeMB = file.size / (1024 * 1024)
      // Estimate upload time based on file size (assuming ~5MB/s upload speed)
      const estimatedUploadTime = Math.max(3000, (fileSizeMB / 5) * 1000)

      console.log(`[Upload Progress] Starting upload - File: ${file.name}, Size: ${fileSizeMB.toFixed(1)}MB, Estimated time: ${(estimatedUploadTime/1000).toFixed(1)}s`)

      // More realistic progress simulation with smooth updates
      let lastProgress = 0
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - uploadStartTime
        const progressRatio = Math.min(0.90, elapsed / estimatedUploadTime)
        const targetProgress = Math.round(progressRatio * 100)

        // Smooth progress updates
        if (targetProgress > lastProgress) {
          lastProgress = targetProgress
          setUploadProgress(targetProgress)
          console.log(`[Upload Progress] ${targetProgress}% (${(elapsed/1000).toFixed(1)}s elapsed)`)
        }

        // Stop at 90% until actual upload completes
        if (targetProgress >= 90) {
          clearInterval(progressInterval)
        }
      }, 100)

      // Upload to Gemini
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)

      // Smooth transition to 100% with visible animation
      console.log('[Upload Progress] Upload API call completed, animating to 100%')

      // Animate from current progress to 100%
      const currentProgress = lastProgress || 90
      const steps = 10
      const stepDelay = 50 // 50ms between steps for smooth animation

      for (let i = 1; i <= steps; i++) {
        const progress = currentProgress + Math.round((100 - currentProgress) * i / steps)
        setUploadProgress(progress)
        await new Promise(resolve => setTimeout(resolve, stepDelay))
      }

      console.log('[Upload Progress] 100% - Upload complete!')

      if (!response.ok) {
        // Try to get detailed error information from the response
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error('[Upload] Failed to parse error response:', parseError)
          throw new Error(`Upload failed with status ${response.status}`)
        }

        console.error('[Upload] Server error response:', errorData)

        // Use the detailed error message from the server if available
        const errorMessage = errorData.details || errorData.error || `Upload failed with status ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Validate the response data
      if (!data.success || !data.file) {
        console.error('[Upload] Invalid response data:', data)
        throw new Error("Invalid response from upload server")
      }

      // Note: Audio transcription for videos is now handled by Gemini during analysis
      // This provides better context understanding and removes the 25MB file size limit
      let transcription: FileUpload['transcription'] = undefined

      // For audio/video files, show that Gemini will handle transcription
      if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
        console.log(`Audio/Video file detected: ${file.name} (${fileSizeMB}MB) - Gemini will handle transcription`)

        // Show info toast for audio/video files
        toast.info("Audio Analysis", {
          description: `Gemini will analyze and transcribe the audio content (${fileSizeMB}MB) during processing.`
        })
      }

      // Detect aspect ratio for images
      let aspectRatio = undefined
      if (file.type.startsWith("image/")) {
        try {
          aspectRatio = await getImageAspectRatio(file)
          console.log('Detected aspect ratio:', {
            width: aspectRatio.width,
            height: aspectRatio.height,
            ratio: aspectRatio.aspectRatio,
            orientation: aspectRatio.orientation,
            imageSize: aspectRatio.imageSize,
            videoAspectRatio: aspectRatio.videoAspectRatio
          })
        } catch (err) {
          console.error('Failed to detect aspect ratio:', err)
        }
      }

      const fileUploadData = {
        file,
        preview,
        geminiFile: data.file,
        transcription,
        videoThumbnail,
        videoDuration,
        aspectRatio,
      }

      setSelectedFile(fileUploadData)

      // Store file reference for later transcription parsing
      if (data.file && data.file.uri) {
        uploadedFilesRef.current.set(data.file.uri, fileUploadData)
      }

      setUploadStatus('complete')

      // Show image options if it's an image file
      if (file.type.startsWith("image/")) {
        setShowImageOptions(true)
        setOptionsShownAt(Date.now())

        // Show info toast about available options
        toast.info("Image Options Available", {
          description: "Analyze, edit, or animate your image using the options below!",
          duration: 3000
        })

        // Set file interaction lock to prevent auto-clearing for 10 seconds
        if (fileInteractionLockRef.current) {
          clearTimeout(fileInteractionLockRef.current)
        }
        fileInteractionLockRef.current = window.setTimeout(() => {
          fileInteractionLockRef.current = null
        }, 10000) // 10 second lock
      }

      // For video files, show completion message and video options
      if (file.type.startsWith("video/")) {
        console.log('[Upload Complete] Video file uploaded successfully')

        // Show video options immediately
        setShowVideoOptions(true)
        setOptionsShownAt(Date.now())
        console.log('[Video Upload] Showing inline video options')

        // Show info toast about available options
        toast.info("Video Options Available", {
          description: "Analyze or reverse-engineer your video using the options below!",
          duration: 3000
        })

        // Show success message with file details
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
        const duration = videoDuration ? ` (${formatVideoDuration(videoDuration)})` : ""

        toast.success(`Video Upload Complete`, {
          description: `${file.name} (${fileSizeMB}MB)${duration} uploaded successfully. Choose an option below!`,
          duration: 3000
        })

        // Set status to show file is ready
        setUploadStatus('complete')

        // Set file interaction lock to prevent auto-clearing for 10 seconds
        if (fileInteractionLockRef.current) {
          clearTimeout(fileInteractionLockRef.current)
        }
        fileInteractionLockRef.current = window.setTimeout(() => {
          fileInteractionLockRef.current = null
        }, 10000) // 10 second lock
      }
      // For audio files, show completion and prepare for auto-analysis
      else if (file.type.startsWith("audio/")) {
        console.log('[Upload Complete] Audio file uploaded successfully')

        // Show success message with file details
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)

        toast.success(`Audio Upload Complete`, {
          description: `${file.name} (${fileSizeMB}MB) uploaded successfully. Ready to analyze!`,
          duration: 5000 // Show for 5 seconds
        })

        // Set status to show file is ready for analysis
        setUploadStatus('complete')

        // Declare timeout variable first to avoid temporal dead zone
        let autoAnalysisTimeout: NodeJS.Timeout

        // Show a countdown toast for auto-analysis
        let countdown = 3
        let countdownToast = toast.info(`Auto-analysis starting in ${countdown}...`, {
          description: "Click the X to cancel auto-analysis",
          duration: 3000,
          action: {
            label: "Cancel",
            onClick: () => {
              console.log('[Auto-Analysis] Cancelled by user')
              clearTimeout(autoAnalysisTimeout)
            }
          }
        })

        const countdownInterval = setInterval(() => {
          countdown--
          if (countdown > 0) {
            toast.dismiss(countdownToast)
            countdownToast = toast.info(`Auto-analysis starting in ${countdown}...`, {
              description: "Click the X to cancel auto-analysis",
              duration: 1000,
              action: {
                label: "Cancel",
                onClick: () => {
                  console.log('[Auto-Analysis] Cancelled by user')
                  clearTimeout(autoAnalysisTimeout)
                  clearInterval(countdownInterval)
                }
              }
            })
          } else {
            clearInterval(countdownInterval)
          }
        }, 1000)

        // Auto-submit after a delay to let user see the file
        autoAnalysisTimeout = setTimeout(() => {
          clearInterval(countdownInterval)
          toast.dismiss(countdownToast)

          // Check if file is still selected (user hasn't removed it)
          if (selectedFile || selectedFiles.length > 0) {
            console.log('[Auto-Analysis] Starting automatic analysis of video/audio file')

            // Set status to analyzing
            setUploadStatus('analyzing')

            // Debug log for video auto-analysis
            if (fileUploadData && fileUploadData.file.type.startsWith('video/')) {
              console.log('[VIDEO DEBUG] Auto-analyzing video file:')
              console.log('[VIDEO DEBUG] File:', {
                name: fileUploadData.file.name,
                type: fileUploadData.file.type,
                size: fileUploadData.file.size,
                hasPreview: !!fileUploadData.preview,
                hasThumbnail: !!fileUploadData.videoThumbnail,
                duration: fileUploadData.videoDuration
              })
            }

            // Set input to describe what's happening
            handleInputChange({ target: { value: 'Analyze this file and provide transcription' } } as React.ChangeEvent<HTMLInputElement>)

            // Submit after a short delay
            setTimeout(() => {
              if (handleSubmitRef.current) {
                console.log('[VIDEO DEBUG] Auto-submitting video analysis')
                handleSubmitRef.current()
              }
            }, 500)
          }
        }, 3000) // 3 second delay before auto-analysis
      }

      // Hide success message after 3 seconds
      setTimeout(() => {
        if (uploadStatus === 'complete') {
          setUploadStatus('idle')
          setUploadProgress(0)
        }
      }, 3000)

    } catch (error: any) {
      console.error("[Upload] File upload error:", error)
      setUploadStatus('error')

      // Provide more specific error messages based on the error type
      let errorTitle = "File Upload Failed"
      let errorDescription = error.message || "An error occurred while uploading the file. Please try again."

      if (error.message?.includes("Server configuration error")) {
        errorTitle = "Server Configuration Error"
        errorDescription = "The server is not properly configured. Please contact support."
      } else if (error.message?.includes("Invalid Gemini API key")) {
        errorTitle = "API Configuration Error"
        errorDescription = "The Gemini API key is invalid. Please check the server configuration."
      } else if (error.message?.includes("Network connection error")) {
        errorTitle = "Connection Error"
        errorDescription = "Unable to connect to the upload service. Please check your internet connection and try again."
      } else if (error.message?.includes("quota exceeded")) {
        errorTitle = "Service Quota Exceeded"
        errorDescription = "The upload service quota has been exceeded. Please try again later."
      } else if (error.message?.includes("Failed to fetch")) {
        errorTitle = "Network Error"
        errorDescription = "Unable to reach the upload server. Please check your connection and try again."
      } else if (error.message?.includes("Unsupported file type")) {
        errorTitle = "Unsupported File Type"
        errorDescription = "This file type is not supported. Please upload an image, audio, or video file."
      }

      // Show error to user with improved messaging
      toast.error(errorTitle, {
        description: errorDescription,
        duration: 5000 // Show longer for errors
      })

      setTimeout(() => {
        setUploadStatus('idle')
        setUploadProgress(0)
      }, 3000)
    } finally {
      setIsUploading(false)
      isUploadingNewFilesRef.current = false
    }
  }, [processFile, selectedFile, selectedFiles])

  const handleFileRemove = useCallback(() => {
    // Don't revoke the URL immediately as it might still be needed
    clearSelectedFile('user-removed-file')
    pendingAttachmentRef.current = null
    setUploadStatus('idle')
    setUploadProgress(0)
    setShowImageOptions(false)
    setShowVideoOptions(false)
  }, [clearSelectedFile])

  const handleFilesRemove = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleAllFilesRemove = useCallback(() => {
    clearSelectedFile('user-removed-all-files')
    clearSelectedFiles('user-removed-all-files')
    setShowImageOptions(false)
    setShowVideoOptions(false)
    setUploadStatus('idle')
    setUploadProgress(0)
  }, [clearSelectedFile, clearSelectedFiles])

  // Removed local messages - using main chat API flow

  /* Removed - now handled by main chat API
  const handleImageGeneration = useCallback(async (originalPrompt: string) => {
    setIsGeneratingImage(true)

    // Add user's message to local messages immediately
    const userMessage = {
      id: `img-user-${Date.now()}`,
      role: "user",
      content: originalPrompt,
    }
    // setLocalMessages(prev => [...prev, userMessage]) // Removed - no longer using local messages

    // Switch to Images tab when starting generation
    onImageGenerationStart?.()

    // Create a placeholder image with generating state
    const placeholderId = generateImageId()
    const placeholderImage: GeneratedImage = {
      id: placeholderId, // Use the placeholder ID to update it
      url: '', // Empty URL while generating
      prompt: originalPrompt,
      timestamp: new Date(),
      quality: imageQuality,
      style: currentImageSettings.style,
      size: currentImageSettings.size,
      model: currentImageSettings.model,
      isGenerating: true,
      generationStartTime: new Date(),
    }

    // Add placeholder to gallery immediately by updating parent state - use callback form
    console.log('Adding placeholder image:', placeholderImage)
    onGeneratedImagesChange?.((prevImages) => {
      const updatedWithPlaceholder = [...prevImages, placeholderImage]
      console.log('Updated images with placeholder:', updatedWithPlaceholder)
      return updatedWithPlaceholder
    })

    try {
      console.log('Generating image with original prompt:', originalPrompt)

      // Extract the cleaned prompt for the API, but keep the original for display
      const cleanedPrompt = extractImagePrompt(originalPrompt)
      console.log('Cleaned prompt for API:', cleanedPrompt)

      // Use the ref to get the current quality value to avoid stale closures
      const currentQuality = imageQualityRef.current
      console.log('Current quality setting from ref:', currentQuality) // Debug log
      console.log('Sending request with quality:', currentQuality) // Additional debug

      // Double-check the quality value
      const qualityToSend = currentQuality
      console.log('Quality value being sent to API:', qualityToSend)

      // Log the current imageGenerationModel value before API call
      console.log('[handleImageGeneration] Current imageGenerationModel state:', currentImageSettings.model)

      // Create the request body
      const requestBody = {
        prompt: cleanedPrompt,  // Use cleaned prompt for API
        originalPrompt: originalPrompt,  // Send original too
        model: currentImageSettings.model,  // Use the selected model from settings context
        style: currentImageSettings.style,
        size: currentImageSettings.size,
        n: 1,
      }

      // Log the complete request body
      console.log('[handleImageGeneration] Complete request body being sent to API:', JSON.stringify(requestBody, null, 2))

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }).catch(error => {
        console.error('Network error:', error)
        throw new Error('Failed to connect to the server. Make sure the development server is running.')
      })

      let data: {
        success: boolean
        images: Array<{
          url: string
          revisedPrompt?: string
          index: number
        }>
        metadata: {
          model: string
          provider: string
          quality: string
          style: string
          size: string
          originalPrompt: string
          imageCount: number
        }
        error?: string
        details?: string
      }
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error('Invalid response from image generation API')
      }

      if (!response.ok) {
        console.error('Image generation failed. Status:', response.status)
        console.error('Response data:', data)

        // Provide more detailed error message
        const errorMessage = data?.error || data?.details || `Failed to generate image (Status: ${response.status})`
        throw new Error(errorMessage)
      }

      console.log('Image generation response:', data)

      // Update the placeholder image with the actual result
      const newImages: GeneratedImage[] = data.images.map((img) => ({
        id: placeholderId, // Use the placeholder ID to update it
        url: img.url,
        prompt: data.metadata.originalPrompt,
        revisedPrompt: img.revisedPrompt,
        timestamp: new Date(),
        quality: data.metadata.quality as 'standard' | 'hd' | 'wavespeed',
        style: data.metadata.style as 'vivid' | 'natural' | undefined,
        size: data.metadata.size,
        model: data.metadata.model,
        isGenerating: false, // Image is done generating
        generationStartTime: placeholderImage.generationStartTime,
        urlAvailableTime: new Date(), // Track when URL became available
      }))

      // Update state by replacing the placeholder using functional update
      console.log('Updating placeholder with actual image:', {
        placeholderId,
        newImageUrl: newImages[0]?.url,
        newImage: newImages[0]
      })

      // Update state by replacing the placeholder - use callback form
      onGeneratedImagesChange?.((prevImages) => {
        console.log('Previous images:', prevImages)
        const updatedImages = (prevImages || []).map(img =>
          img.id === placeholderId ? newImages[0] : img
        )
        console.log('Updated images:', updatedImages)
        return updatedImages
      })

      // Add success message to local messages
      const modelName = data.metadata.model.includes('gpt-image-1') ? 'GPT-Image-1' :
                       data.metadata.model.includes('dall-e') ? 'DALL-E' :
                       data.metadata.model === 'flux-kontext-pro' ? 'Flux Kontext Pro' :
                       data.metadata.model === 'flux-kontext-max' ? 'Flux Kontext Max' :
                       data.metadata.model === 'flux-dev-ultra-fast' ? 'WaveSpeed AI' :
                       data.metadata.model
      const successMessage = {
        id: `img-success-${Date.now()}`,
        role: "assistant" as const,
        content: `✨ **I've successfully generated your image!**

**Prompt:** "${newImages[0].prompt}"
**Model:** ${modelName}${data.metadata.model.includes('fallback') ? ' (fallback)' : ''}
**Quality:** ${newImages[0].quality?.toUpperCase() || currentQuality.toUpperCase()}
**Size:** ${newImages[0].size || currentImageSettings.size}

You can view it in the **Images** tab on the right.`,
      }

      // Add the success message directly to the chat
      append({
        id: successMessage.id,
        role: successMessage.role,
        content: successMessage.content
      })

    } catch (error) {
      console.error("Image generation error:", error)
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      // Remove the placeholder on error - use callback form
      onGeneratedImagesChange?.((prevImages) => {
        const updatedAfterError = (prevImages || []).filter(img => img.id !== placeholderId)
        return updatedAfterError
      })

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      // Check if it's a network error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        const errorMsg = {
          id: `img-error-${Date.now()}`,
          role: "assistant",
          content: `❌ I couldn't connect to the image generation service.\n\nPlease check:\n\n1. **Is your development server running?**\n   Run: \`npm run dev\` or \`pnpm dev\`\n\n2. **Did the server crash?**\n   Check your terminal for errors\n\n3. **Is the server running on the correct port?**\n   Should be: http://localhost:3000`,
        }
        // setLocalMessages(prev => [...prev, errorMsg]) // Removed - no longer using local messages
      } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        const modelName = imageQualityRef.current === 'hd' ? 'GPT-Image-1' : 'WaveSpeed';
        const errorMsg = {
          id: `img-error-${Date.now()}`,
          role: "assistant",
          content: `⏳ Rate limit reached.\n\nThe ${modelName} API has a rate limit to prevent abuse.\n\n**Solution:** Wait a few seconds and try again.\n\n${imageQualityRef.current === 'hd' ? 'GPT-Image-1 is a premium service with token-based limits.' : 'This is a fast, high-quality image generation service with reasonable limits.'}`,
        }
        // setLocalMessages(prev => [...prev, errorMsg]) // Removed - no longer using local messages
      } else if (errorMessage.includes('timeout')) {
        const errorMsg = {
          id: `img-error-${Date.now()}`,
          role: "assistant",
          content: "⏱️ Image generation timed out.\n\nThe generation took longer than expected (>30 seconds).\n\n**Solutions:**\n1. Try a simpler prompt\n2. Try again - it might work on the next attempt\n3. Check if the service is experiencing high load",
        }
        // setLocalMessages(prev => [...prev, errorMsg]) // Removed - no longer using local messages
      } else {
        const errorMsg = {
          id: `img-error-${Date.now()}`,
          role: "assistant",
          content: `❌ I couldn't generate the image.\n\n**Error:** ${errorMessage}\n\nPlease try again or check the console for more details.`,
        }
        // setLocalMessages(prev => [...prev, errorMsg]) // Removed - no longer using local messages
      }
    } finally {
      setIsGeneratingImage(false)
    }
  }, [onGeneratedImagesChange, onImageGenerationStart, currentImageSettings.style, currentImageSettings.size])
  */


  // Handle inline image option selection
  const handleImageOptionSelect = useCallback((option: 'analyze' | 'edit' | 'animate', imageIndex?: number) => {
    console.log('[handleImageOptionSelect] Selected option:', option, 'imageIndex:', imageIndex);
    console.log('[handleImageOptionSelect] Current state:', {
      hasSelectedFile: !!selectedFile,
      selectedFilesCount: selectedFiles.length,
      showImageOptions
    });

    // Determine which file to work with
    const targetFile = imageIndex !== undefined ? selectedFiles[imageIndex] : selectedFile;

    if (!targetFile) {
      console.log('[handleImageOptionSelect] No target file found - hiding options and showing user message');

      // Hide the options since there are no files
      setShowImageOptions(false);

      // Show user-friendly error message
      toast.error("No image available", {
        description: "Please upload an image first to use this feature",
        duration: 3000
      });
      return;
    }

    // Hide the options
    setShowImageOptions(false);

    switch (option) {
      case 'analyze':
        // Direct analysis - submit with analyze prompt
        const analyzePrompt = 'Analyze this image and provide a detailed analysis';
        handleInputChange({ target: { value: analyzePrompt } } as React.ChangeEvent<HTMLInputElement>)

        // Submit after a short delay to ensure state update
        setTimeout(() => {
          console.log('[analyze] Submitting with file:', targetFile?.file?.name)
          console.log('[analyze] File URI:', targetFile?.geminiFile?.uri)
          console.log('[analyze] File type:', targetFile?.file?.type)
          const event = new Event('submit', { bubbles: true, cancelable: true }) as any
          event.preventDefault = () => {}
          originalHandleSubmit(event)
        }, 100)
        break;

      case 'edit':
        // Enhanced uploaded image to gallery integration
        if (targetFile && targetFile.geminiFile && targetFile.preview) {
          console.log('[ChatInterface] Processing uploaded image for editing:', {
            fileName: targetFile.file.name,
            fileSize: targetFile.file.size,
            aspectRatio: targetFile.aspectRatio,
            hasGeminiFile: !!targetFile.geminiFile,
            hasPreview: !!targetFile.preview
          })

          // Create a proper GeneratedImage object identical to AI-generated images
          const uploadedImageId = generateImageId()
          const uploadedImage: GeneratedImage = {
            id: uploadedImageId,
            url: targetFile.preview, // Data URL for immediate display
            prompt: `Uploaded Image: ${targetFile.file.name}`,
            revisedPrompt: `Uploaded Image: ${targetFile.file.name}`,
            timestamp: new Date(),
            quality: imageQuality || "standard",
            style: currentImageSettings.style || "vivid",
            size: targetFile.aspectRatio?.imageSize || currentImageSettings.size || "1024x1024",
            model: 'uploaded-image',
            isUploaded: true,
            isGenerating: false, // Critical: Must be false for proper saving
            geminiUri: targetFile.geminiFile.uri, // Store Gemini URI for AI processing
            originalImageId: undefined, // No original since this IS the original
          }

          console.log('[ChatInterface] Created uploaded image object:', uploadedImageId)

          // Add to existing gallery with proper error handling
          try {
            const updatedImages = [...generatedImages, uploadedImage]
            console.log('[ChatInterface] Adding uploaded image to gallery...')

            onGeneratedImagesChange?.(updatedImages)

            // Wait for state update, then trigger edit with longer delay
            setTimeout(() => {
              console.log('[ChatInterface] Requesting edit modal for:', uploadedImageId)
              onEditImageRequested?.(uploadedImageId)

              // Ensure we switch to images tab
              onImageGenerationStart?.()

              // Clear the file upload after successful addition
              setTimeout(() => {
                clearSelectedFile('image-added-to-gallery', true)
              }, 800)

            }, 200) // Increased delay for state update

            toast.success("Image Added to Gallery", {
              description: "Opening edit dialog...",
              duration: 2000
            })

          } catch (error) {
            console.error('[ChatInterface] Error adding uploaded image to gallery:', error)
            toast.error("Failed to add image to gallery", {
              description: "Please try uploading again",
              duration: 3000
            })
          }
        } else {
          console.error('[ChatInterface] Missing required data for edit:', {
            hasTargetFile: !!targetFile,
            hasGeminiFile: !!targetFile?.geminiFile,
            hasPreview: !!targetFile?.preview
          })
          toast.error("Unable to edit image", {
            description: "Image data is incomplete. Please re-upload the image.",
            duration: 3000
          })
        }
        break;

      case 'animate':
        // Show video generation modal with animation context
        if (targetFile) {
          setVideoModalConfig({
            prompt: '',
            image: targetFile.preview || targetFile.geminiFile?.uri,
            suggestedWorkflow: 'quick'
          });
          setShowVideoModal(true);
        }
        break;
    }
  }, [handleInputChange, selectedFile, selectedFiles, originalHandleSubmit]);

  // Handle image option selection for single images
  // Handle inline video option selection
  const handleInlineVideoOptionSelect = useCallback((option: 'analyze' | 'reverse-engineer') => {
    console.log('[InlineVideoOptions] Option selected:', option)

    // Mark that user has interacted with options
    setUserHasInteractedWithOptions(true)

    // Don't hide video options immediately - keep them visible until the user removes files
    // This allows users to retry if submission fails
    // setShowVideoOptions(false) // Removed to keep options visible

    if (option === 'analyze') {
      // Use detailed analysis prompt with enhanced timestamp requirements
      const analysisPrompt = `Please provide a detailed examination of this entire video from start to finish. Include:

1. **Overview**: Brief summary of the video's purpose and content with total duration

2. **Complete Audio Transcription with Precise Timestamps**:
   - Provide a COMPLETE word-for-word transcription of ALL spoken content
   - Use precise timestamps in [MM:SS] format for videos under 60 minutes, [HH:MM:SS] for longer
   - Format EXACTLY as: [00:15] Speaker A: "exact words spoken here"
   - Start from [00:00] and include timestamps at:
     * The beginning of each speaker's turn
     * Every 30 seconds during long speeches
     * Significant audio events (music, sound effects)
   - Example format:
     [00:00] Speaker A: "Welcome to today's video..."
     [00:08] Music: [Background music starts playing]
     [00:12] Speaker A: "We'll be exploring three main topics..."
   - Identify speakers consistently (Speaker A, Speaker B, etc.)
   - Include ALL audio events: [01:23] [Door closes], [02:45] [Music fades out]
   - Note language, accents, tone, and speech patterns
   - DO NOT summarize or paraphrase - transcribe exact words

3. **Visual Analysis with Timeline**:
   - Describe all scenes chronologically with timestamps
   - Note text overlays, graphics, and when they appear/disappear
   - Describe camera work, transitions, and editing style with timing
   - Correlate visual elements with audio timestamps

4. **Synchronized Audio-Visual Breakdown**:
   - Match spoken content with visual elements at each timestamp
   - Note how audio and visual elements complement each other
   - Identify any audio-visual misalignments

5. **Technical Aspects**: Video quality, aspect ratio, production value, audio quality

6. **Key Messages & Themes**: Main themes or messages conveyed throughout

7. **Overall Assessment**: Style, effectiveness, and notable features

CRITICAL REQUIREMENTS:
- Generate timestamps through careful frame-by-frame and audio analysis
- Every spoken line MUST have a timestamp
- Include timestamps for ALL significant audio/visual events
- Start at [00:00] and continue chronologically to video end
- Provide word-for-word transcription, not summaries

Please analyze the ENTIRE video from beginning to end with precise timing information.`

      handleInputChange({ target: { value: analysisPrompt } } as React.ChangeEvent<HTMLInputElement>)

      // Submit after a short delay to ensure state update
      setTimeout(() => {
        console.log('[InlineVideoOptions] Submitting video analysis request')
        handleSubmitRef.current?.()
      }, 100)
    } else if (option === 'reverse-engineer') {
      // Use enhanced reverse engineering prompt with transcription
      const reverseEngineerPrompt = `Please reverse engineer this video and provide a complete breakdown including:

1. **Complete Audio Transcription with Timestamps**:
   - Provide COMPLETE word-for-word transcription of ALL spoken content
   - Use precise timestamps in [MM:SS] format for videos under 60 minutes, [HH:MM:SS] for longer videos
   - Format EXACTLY like this: [00:15] Speaker A: "exact words spoken"
   - Include timestamps at the start of each speaker turn and every 30 seconds within long segments
   - Example format:
     [00:00] Speaker A: "Welcome to our video tutorial..."
     [00:05] Speaker B: "Today we'll be discussing..."
     [00:12] Music: [Upbeat background music starts]
     [00:15] Speaker A: "Let's dive into the first topic..."
   - Include all dialogue, narration, voice-overs, and background audio
   - Note speaker identification (Speaker A, B, C, etc.), tone, pacing, and delivery style
   - Include sound effects, music cues, and audio transitions with exact timing
   - Mark significant audio events: [Music starts], [Sound effect: door slam], [Silence], etc.

2. **Production Breakdown**:
   - Estimated tools and software used for creation (video editing, audio post-production)
   - Camera/recording equipment likely used (based on video and audio quality)
   - Editing techniques and transitions employed (reference specific timestamps)
   - Visual effects and how they were achieved (note timing from transcription)
   - Audio production techniques (mixing, mastering, effects)

3. **Content Structure & Script Analysis**:
   - Script or outline reconstruction based on the timestamped transcription
   - Storytelling techniques used and their exact timing
   - Information architecture and flow (correlate with transcript timestamps)
   - Pacing decisions and how they relate to the spoken content
   - Call-to-action placement and delivery style with timestamps

4. **Technical Recreation Guide**:
   - Step-by-step process to recreate similar content
   - Required skills and tools for both video and audio production
   - Estimated time and resources needed for each production phase
   - Specific techniques for achieving similar audio quality and delivery
   - Script writing approach based on the transcribed content structure

5. **Design Decisions**:
   - Color grading and visual style choices
   - Audio mixing and sound design approach (reference timestamp analysis)
   - Pacing and rhythm decisions (correlate with speech timing)
   - Visual-audio synchronization techniques

6. **Creation Workflow**:
   - Pre-production planning evident in the video (script preparation, audio planning)
   - Production process insights (recording techniques, equipment setup)
   - Post-production workflow analysis (editing, audio sync, effects timing)

CRITICAL REQUIREMENTS:
- Generate timestamps through careful audio-visual analysis
- Start transcription from 00:00 and continue chronologically
- The transcription should inform all other analysis sections
- Reference specific timestamps when discussing production techniques
- Provide actionable insights that include both visual and audio recreation guidance

Please provide actionable insights that would help someone recreate a similar video with identical production quality and content structure.`

      handleInputChange({ target: { value: reverseEngineerPrompt } } as React.ChangeEvent<HTMLInputElement>)

      // Submit after a short delay to ensure state update
      setTimeout(() => {
        console.log('[InlineVideoOptions] Submitting video reverse engineering request')
        handleSubmitRef.current?.()
      }, 100)
    }
  }, [handleInputChange])

  const handleInlineImageOptionSelect = useCallback((option: 'analyze' | 'analyze-reverse' | 'edit' | 'animate' | 'multi-edit') => {
    if (option === 'multi-edit') {
      // For multi-edit, we need to collect all uploaded images
      const allImages: string[] = []

      // Add single file if it exists and is an image
      if (selectedFile?.file.type.startsWith('image/') && selectedFile.preview) {
        allImages.push(selectedFile.preview)
      }

      // Add multiple files that are images
      selectedFiles.forEach(file => {
        if (file.file.type.startsWith('image/') && file.preview) {
          allImages.push(file.preview)
        }
      })

      if (allImages.length >= 2) {
        setMultiImageEditModal({ isOpen: true, images: allImages })
      } else {
        toast.error("Multi-edit requires at least 2 images", {
          description: "Please upload more images to use multi-edit feature",
          duration: 3000
        })
      }
    } else if (option === 'analyze') {
      // Standard analysis without reverse engineering
      handleAnalyzeAllFiles(false);
    } else if (option === 'analyze-reverse') {
      // Analysis with reverse engineering
      handleAnalyzeAllFiles(true);
    } else {
      // For edit and animate, we need to show a modal to select which file to work with
      handleShowFileSelectionModal(option);
    }
  }, [selectedFile, selectedFiles, showImageOptions, showVideoOptions]);

  // Handle analyzing all uploaded files
  const handleAnalyzeAllFiles = useCallback((includeReverseEngineering: boolean = true) => {
    console.log('[handleAnalyzeAllFiles] Analyzing all uploaded files', {
      chatId,
      messagesLength: messages?.length,
      selectedFile: !!selectedFile,
      selectedFilesCount: selectedFiles.length,
      includeReverseEngineering
    });

    // Validate that the chat is properly initialized
    if (!handleSubmitRef.current) {
      console.error('[handleAnalyzeAllFiles] handleSubmitRef.current is not initialized');
      toast.error("Chat not ready", {
        description: "Please wait for the chat to initialize and try again",
        duration: 3000
      });
      return;
    }

    // Ensure messages array exists
    if (!messages) {
      console.error('[handleAnalyzeAllFiles] messages is undefined');
      toast.error("Chat not initialized", {
        description: "Please wait for the chat to load and try again",
        duration: 3000
      });
      return;
    }

    // Create a comprehensive analysis prompt
    const allFiles: FileUpload[] = []
    if (selectedFile) allFiles.push(selectedFile)
    if (selectedFiles.length > 0) allFiles.push(...selectedFiles)

    if (allFiles.length === 0) {
      toast.error("No files to analyze", {
        description: "Please upload files first",
        duration: 3000
      });
      return;
    }

    // Create analysis prompt based on file types
    const imageFiles = allFiles.filter(f => f.file.type.startsWith('image/')).map(f => f.file)
    const videoFiles = allFiles.filter(f => f.file.type.startsWith('video/')).map(f => f.file)
    const audioFiles = allFiles.filter(f => f.file.type.startsWith('audio/')).map(f => f.file)
    const documentFiles = allFiles.filter(f =>
      f.file.type.includes('pdf') ||
      f.file.type.includes('document') ||
      f.file.type.includes('text')
    ).map(f => f.file)

    // Use the utility function to create the analysis prompt
    const analysisPrompt = createAnalysisPrompt(
      imageFiles,
      videoFiles,
      audioFiles,
      documentFiles,
      includeReverseEngineering
    )

    // Debug log the analysis prompt for videos
    if (videoFiles.length > 0) {
      console.log('[VIDEO DEBUG] Analysis prompt created:')
      console.log('[VIDEO DEBUG] Prompt text:', analysisPrompt)
      console.log('[VIDEO DEBUG] Video files in prompt:', videoFiles.map(f => f.name))
    }

    // Set the analysis prompt and submit
    handleInputChange({ target: { value: analysisPrompt } } as React.ChangeEvent<HTMLInputElement>)

    // Submit after a short delay to ensure state update
    setTimeout(() => {
      console.log('[handleAnalyzeAllFiles] Submitting analysis request with', allFiles.length, 'files',
        'includeReverseEngineering:', includeReverseEngineering)
      handleSubmitRef.current?.()
    }, 100)
  }, [selectedFile, selectedFiles, handleInputChange, chatId, messages]);

  // Handle showing file selection modal for edit/animate
  const handleShowFileSelectionModal = useCallback((option: 'edit' | 'animate') => {
    // For now, we'll use the first available file or show an error
    // TODO: Implement a file selection modal
    const allFiles: FileUpload[] = []
    if (selectedFile) allFiles.push(selectedFile)
    if (selectedFiles.length > 0) allFiles.push(...selectedFiles)

    if (allFiles.length === 0) {
      toast.error("No files available", {
        description: "Please upload files first",
        duration: 3000
      });
      return;
    }

    if (allFiles.length === 1) {
      // Only one file, use it directly
      handleImageOptionSelect(option);
    } else {
      // Multiple files - for now, show a message that user should click on individual files
      toast.info(`Multiple files detected`, {
        description: `Click on individual files to ${option} them, or use the Analyze button to analyze all files`,
        duration: 4000
      });
    }
  }, [selectedFile, selectedFiles, handleImageOptionSelect]);

  // Handle clicking on individual files
  const handleFileClick = useCallback((file: FileUpload, index?: number) => {
    console.log('[handleFileClick] File clicked:', file.file.name, 'index:', index);

    // Set this file as the temporary selected file for the modal
    const originalSelectedFile = selectedFile;
    setSelectedFile(file);

    // Show the file preview modal with options
    if (file.file.type.startsWith('image/')) {
      // For images, show analyze, edit, animate options
      setFilePreviewModal({
        isOpen: true,
        file: {
          name: file.file.name,
          url: file.preview || '',
          contentType: file.file.type,
          prompt: file.file.name.startsWith('Generated') ? 'AI Generated Image' : undefined
        },
        options: ['analyze', 'edit', 'animate']
      });
    } else {
      // For non-images, only show analyze option
      setFilePreviewModal({
        isOpen: true,
        file: {
          name: file.file.name,
          url: file.preview || '',
          contentType: file.file.type
        },
        options: ['analyze']
      });
    }

    // Restore original selected file after a delay (the modal will handle the action)
    setTimeout(() => {
      setSelectedFile(originalSelectedFile);
    }, 100);
  }, [selectedFile]);

  // Handle file preview modal option selection
  const handleFilePreviewOptionSelect = useCallback((option: 'analyze' | 'edit' | 'animate') => {
    console.log('[handleFilePreviewOptionSelect] Option selected:', option);

    // Close the modal first
    setFilePreviewModal({ isOpen: false, file: { name: '', url: '', contentType: '' }, options: [] });

    if (option === 'analyze') {
      // For analyze, create a specific analysis prompt for this file
      const file = filePreviewModal.file;
      let analysisPrompt = `Please analyze this ${file.contentType.startsWith('image/') ? 'image' : 'file'}: ${file.name}. `;

      if (file.contentType.startsWith('image/')) {
        analysisPrompt += "Provide a detailed analysis of the visual content, composition, subjects, colors, style, and any text or objects visible.";
      } else if (file.contentType.startsWith('video/')) {
        analysisPrompt += "Analyze the video content, duration, visual elements, and any audio components.";
      } else if (file.contentType.startsWith('audio/')) {
        analysisPrompt += "Analyze the audio content, transcribe any speech, and identify music or sound effects.";
      } else {
        analysisPrompt += "Analyze the content and provide key insights and information.";
      }

      // Set the analysis prompt and submit
      handleInputChange({ target: { value: analysisPrompt } } as React.ChangeEvent<HTMLInputElement>);

      setTimeout(() => {
        console.log('[handleFilePreviewOptionSelect] Submitting analysis request for:', file.name);
        handleSubmitRef.current?.();
      }, 100);
    } else {
      // For edit and animate, use the existing image option handler
      handleImageOptionSelect(option);
    }
  }, [filePreviewModal.file, handleInputChange, handleImageOptionSelect]);

  // Handle image option selection for multiple images in chat
  const handleMultiImageOptionSelect = useCallback((option: 'analyze' | 'edit' | 'animate' | 'multi-edit', attachment: any) => {
    console.log('[handleMultiImageOptionSelect] Called with:', { option, attachmentName: attachment.name });

    if (option === 'multi-edit') {
      // For multi-edit, collect all images from the message attachments
      // We need to find the message that contains this attachment
      const messageWithAttachment = messages.find(m => {
        const attachments = messageAttachments[m.id] || []
        return attachments.some(att => att.name === attachment.name)
      })

      if (messageWithAttachment) {
        const attachments = messageAttachments[messageWithAttachment.id] || []
        const imageAttachments = attachments.filter(att =>
          att.contentType?.startsWith('image/')
        )

        if (imageAttachments.length >= 2) {
          const imageUrls = imageAttachments.map(att => att.url).filter(Boolean) as string[]
          setMultiImageEditModal({ isOpen: true, images: imageUrls })
        } else {
          toast.error("Multi-edit requires at least 2 images", {
            description: "This message doesn't have enough images for multi-edit",
            duration: 3000
          })
        }
      }
    } else if (option === 'edit') {
      // Handle edit option specifically for chat message attachments
      if (attachment && attachment.url) {
        // Create a GeneratedImage object from the chat attachment
        const uploadedImage: GeneratedImage = {
          id: generateImageId(),
          url: attachment.url,
          prompt: `Chat Image: ${attachment.name}`,
          timestamp: new Date(),
          quality: imageQuality,
          style: currentImageSettings.style,
          size: currentImageSettings.size,
          model: 'uploaded',
          isUploaded: true,
          isGenerating: false,
          // Store the original attachment URL as geminiUri for reference
          geminiUri: attachment.url
        }

        // Add to gallery
        onGeneratedImagesChange?.([...generatedImages, uploadedImage])

        // Request auto-open of edit modal
        onEditImageRequested?.(uploadedImage.id)

        // Switch to Images tab
        onImageGenerationStart?.()

        toast.success("Image Added to Gallery", {
          description: "Opening edit dialog...",
          duration: 2000
        })
      }
    } else {
      // For analyze and animate, create a temporary file object to work with existing logic
      const mockFile = {
        file: {
          name: attachment.name,
          type: attachment.contentType,
          size: 0
        },
        preview: attachment.url,
        geminiFile: { uri: attachment.url } // Use the attachment URL as the URI
      };

      // Set this as the temporary selected file and trigger the option handler
      const originalSelectedFile = selectedFile;
      setSelectedFile(mockFile as any);

      // Use timeout to ensure state is updated before calling handler
      setTimeout(() => {
        handleImageOptionSelect(option);
        // Restore the original selected file
        setSelectedFile(originalSelectedFile);
      }, 0);
    }
  }, [handleImageOptionSelect, selectedFile, messages, onGeneratedImagesChange, onEditImageRequested, onImageGenerationStart, imageQuality, currentImageSettings]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    // Prevent default form submission
    if (e) {
      e.preventDefault()
    }

    console.trace('[SUBMIT] handleSubmit called with:', {
      hasInput: !!input.trim(),
      inputValue: input,
      hasSelectedFile: !!selectedFile,
      selectedFilesCount: selectedFiles.length,
      hasPendingAttachment: !!pendingAttachmentRef.current,
      timestamp: Date.now()
    })

    // Debug log for video uploads
    if (selectedFile?.file.type.startsWith('video/') || selectedFiles.some(f => f.file.type.startsWith('video/'))) {
      console.log('[VIDEO DEBUG] Video file(s) detected in submission:')
      console.log('[VIDEO DEBUG] Input value:', input)
      console.log('[VIDEO DEBUG] Selected file:', selectedFile ? {
        name: selectedFile.file.name,
        type: selectedFile.file.type,
        size: selectedFile.file.size,
        hasPreview: !!selectedFile.preview,
        hasGeminiFile: !!selectedFile.geminiFile,
        hasThumbnail: !!selectedFile.videoThumbnail,
        duration: selectedFile.videoDuration,
        transcription: selectedFile.transcription
      } : null)
      console.log('[VIDEO DEBUG] Multiple files:', selectedFiles.filter(f => f.file.type.startsWith('video/')).map(f => ({
        name: f.file.name,
        type: f.file.type,
        size: f.file.size,
        hasPreview: !!f.preview,
        hasGeminiFile: !!f.geminiFile,
        hasThumbnail: !!f.videoThumbnail,
        duration: f.videoDuration,
        transcription: f.transcription
      })))
    }

    // Check if we have input or a file or pending attachments
    if (!input.trim() && !selectedFile && selectedFiles.length === 0 && !pendingAttachmentRef.current) {
      return
    }

    // Check if this is an image generation request
    if (input.trim() && isImageGenerationRequest(input)) {
      // The main chat API will handle image generation
      // No need for separate local handling
      console.log('[SUBMIT] Image generation request detected, letting main chat API handle it')
    }


    // Store the attachment info before submission
    // Combine single file and multiple files into one array
    const allFiles: FileUpload[] = []

    if (selectedFile) {
      allFiles.push(selectedFile)
    }

    if (selectedFiles.length > 0) {
      allFiles.push(...selectedFiles)
    }




    // Only set pendingAttachmentRef if it's not already set (from social media download)
    if (allFiles.length > 0 && !pendingAttachmentRef.current) {
      console.log('[handleSubmit] Creating pendingAttachmentRef with files:', allFiles.length)

      // Debug log for video files
      const videoFiles = allFiles.filter(f => f.file.type.startsWith('video/'))
      if (videoFiles.length > 0) {
        console.log('[VIDEO DEBUG] Setting pendingAttachmentRef with video files:')
        console.log('[VIDEO DEBUG] Video files:', videoFiles.map(f => ({
          name: f.file.name,
          type: f.file.type,
          size: f.file.size,
          hasPreview: !!f.preview,
          hasThumbnail: !!f.videoThumbnail,
          duration: f.videoDuration,
          transcription: f.transcription
        })))
      }

      // Use the first file as primary attachment
      const primaryFile = allFiles[0]
      pendingAttachmentRef.current = {
        name: primaryFile.file.name,
        contentType: primaryFile.file.type,
        url: primaryFile.preview || '',
        transcription: primaryFile.transcription,
        videoThumbnail: primaryFile.videoThumbnail,
        videoDuration: primaryFile.videoDuration,
        additionalFiles: allFiles.slice(1).map(file => ({
          name: file.file.name,
          contentType: file.file.type,
          url: file.preview || '',
          transcription: file.transcription,
          videoThumbnail: file.videoThumbnail,
          videoDuration: file.videoDuration,
        }))
      }

      // Create a backup to ensure attachments persist
      pendingAttachmentBackupRef.current = { ...pendingAttachmentRef.current };

      console.log(`Pending attachments set: ${allFiles.length} file(s)`, pendingAttachmentRef.current)

      // Check if this is the first user message (after welcome message)
      const userMessages = messages ? messages.filter(m => m.role === 'user') : [];
      const isFirstUserMessage = userMessages.length === 0;

      // CRITICAL FIX: Pre-set attachments for FIRST USER MESSAGE or NEW CHAT
      if (isFirstUserMessage || !chatId) {
        console.log('[handleSubmit] First user message or new chat - pre-setting attachments')
        const tempId = `temp-${Date.now()}`
        tempMessageIdRef.current = tempId

        // Pre-set the attachments
        const attachmentsToSet = [
          {
            name: primaryFile.file.name,
            contentType: primaryFile.file.type,
            url: primaryFile.preview || '',
            transcription: primaryFile.transcription,
            videoThumbnail: primaryFile.videoThumbnail,
            videoDuration: primaryFile.videoDuration
          },
          ...allFiles.slice(1).map(file => ({
            name: file.file.name,
            contentType: file.file.type,
            url: file.preview || '',
            transcription: file.transcription,
            videoThumbnail: file.videoThumbnail,
            videoDuration: file.videoDuration,
          }))
        ]

        // CRITICAL FIX: Use setTimeout to defer state update and avoid flushSync error
        setTimeout(() => {
          setMessageAttachments(prev => ({
            ...prev,
            [tempId]: attachmentsToSet
          }))

          // Also set first message attachments as a fallback
          setFirstMessageAttachments(attachmentsToSet)
        }, 0)

        console.log('[SUBMIT] Pre-set attachments with setTimeout for temp ID:', tempId)

        // Also update the parent immediately
        onMessagesChange?.(messages || [], {
          ...messageAttachments,
          [tempId]: attachmentsToSet
        })
      }
    } else if (pendingAttachmentRef.current) {
      console.log('Using existing pendingAttachmentRef from social media download:', pendingAttachmentRef.current)
      // Create backup for existing pending attachments
      pendingAttachmentBackupRef.current = { ...pendingAttachmentRef.current };
    }

    // Track which files are being sent
    if (allFiles.length > 0) {
      allFiles.forEach(file => {
        sentFilesRef.current.add(file.file.name)
      })
      console.log('[SUBMIT] Tracked sent files:', Array.from(sentFilesRef.current))
    }

    // Prepend "deep research on" if in deep research mode
    const trimmedInput = input.trim()
    if (isDeepResearchMode && trimmedInput) {
      console.log('[SUBMIT] Deep research mode active, prepending trigger')
      handleInputChange({ target: { value: `deep research on ${trimmedInput}` } } as React.ChangeEvent<HTMLInputElement>)

      // Use setTimeout to ensure the input change is processed before submitting
      // Reset deep research mode AFTER the submission completes
      setTimeout(() => {
        originalHandleSubmit(e)
        // Reset deep research mode after successful submission
        setIsDeepResearchMode(false)
      }, 10)
      return
    }

    // Only call originalHandleSubmit if we have a valid message or pending attachments
    if (input.trim() || selectedFile || selectedFiles.length > 0 || pendingAttachmentRef.current) {
      lastSubmitTimeRef.current = Date.now()
      console.log('[SUBMIT] Calling originalHandleSubmit at:', lastSubmitTimeRef.current)

      // Final debug log before submission
      if (selectedFile?.file.type.startsWith('video/') || selectedFiles.some(f => f.file.type.startsWith('video/')) || pendingAttachmentRef.current?.contentType?.startsWith('video/')) {
        console.log('[VIDEO DEBUG] Final state before submission:')
        console.log('[VIDEO DEBUG] Input:', input)
        console.log('[VIDEO DEBUG] pendingAttachmentRef:', pendingAttachmentRef.current)
        console.log('[VIDEO DEBUG] Has video in pendingAttachment:', pendingAttachmentRef.current?.contentType?.startsWith('video/'))
        console.log('[VIDEO DEBUG] Additional video files:', pendingAttachmentRef.current?.additionalFiles?.filter(f => f.contentType?.startsWith('video/')))
      }

      originalHandleSubmit(e)
    }

    // Don't clear files immediately - let the useEffect handle it after message is processed
    // The files will be cleared when pendingAttachmentRef.current is processed and cleared
  }, [input, selectedFile, selectedFiles, originalHandleSubmit, handleInputChange, chatId, messages, messageAttachments, onMessagesChange, isDeepResearchMode, setIsDeepResearchMode])

  // Store handleSubmit in ref to avoid temporal dead zone issues
  handleSubmitRef.current = handleSubmit

  // Auto-hide image options when no files are available - with extended delay
  useEffect(() => {
    if (showImageOptions) {
      const hasImageInSingleFile = selectedFile?.file.type.startsWith("image/")
      const hasImagesInMultipleFiles = selectedFiles.some(f => f.file.type.startsWith('image/'))
      const hasAnyImages = hasImageInSingleFile || hasImagesInMultipleFiles

      if (!hasAnyImages) {
        console.log('[useEffect] No images found but showImageOptions is true, will hide after extended delay');
        // Add a longer delay before hiding to give users time to interact
        const hideTimeout = setTimeout(() => {
          // Check if files are being uploaded
          if (isUploading || uploadStatus === 'uploading' || uploadStatus === 'analyzing') {
            console.log('[useEffect] Files are being processed, keeping options visible');
            return;
          }

          // Check if minimum display time hasn't passed
          const timeSinceShown = Date.now() - optionsShownAt;
          const minDisplayTime = 5000; // 5 seconds minimum display time
          if (timeSinceShown < minDisplayTime) {
            console.log('[useEffect] Options shown recently, extending display time');
            setTimeout(() => {
              if (!selectedFile?.file.type.startsWith("image/") &&
                  !selectedFiles.some(f => f.file.type.startsWith('image/'))) {
                setShowImageOptions(false);
              }
            }, minDisplayTime - timeSinceShown);
            return;
          }

          // Double-check that files haven't been added in the meantime
          const stillNoImages = !selectedFile?.file.type.startsWith("image/") &&
                               !selectedFiles.some(f => f.file.type.startsWith('image/'))
          if (stillNoImages) {
            console.log('[useEffect] Still no images after extended delay, hiding options');
            setShowImageOptions(false);
          }
        }, 3000); // 3 second delay instead of 1

        return () => clearTimeout(hideTimeout);
      }
    }
  }, [showImageOptions, selectedFile, selectedFiles, isUploading, uploadStatus, optionsShownAt])

  // Simplified video options visibility management
  // Options should remain visible as long as video files are present
  useEffect(() => {
    const hasVideoInSingleFile = selectedFile?.file.type.startsWith("video/")
    const hasVideosInMultipleFiles = selectedFiles.some(f => f.file.type.startsWith('video/'))
    const hasAnyVideos = hasVideoInSingleFile || hasVideosInMultipleFiles

    // Show options when videos are present
    if (hasAnyVideos && !showVideoOptions) {
      console.log('[useEffect] Videos detected, showing options');
      setShowVideoOptions(true);
      setOptionsShownAt(Date.now());
    }
    // Only hide options when there are truly no videos AND we're not in the middle of processing
    else if (!hasAnyVideos && showVideoOptions && !isUploading && uploadStatus !== 'uploading' && uploadStatus !== 'analyzing') {
      // Don't auto-hide - let user actions control visibility
      console.log('[useEffect] No videos present, but keeping options visible until user action');
    }
  }, [selectedFile, selectedFiles, showVideoOptions, isUploading, uploadStatus])

  // Handle follow-up question clicks
  const handleFollowUpClick = useCallback(async (question: string) => {
    // Clear any files to ensure clean search
    clearSelectedFile('follow-up-question')
    clearSelectedFiles('follow-up-question')

    // Add a marker to ensure this triggers web search
    const searchQuestion = `[FORCE_WEB_SEARCH] ${question}`

    // Use append to submit the message directly without updating the input field
    if (append) {
      await append({
        role: 'user',
        content: searchQuestion
      }, {
        body: {
          model: selectedModel,
          imageGenerationModel: currentImageSettings.model, // Add image generation model
          imageEditingModel: imageEditingModel, // Add image editing model
          chatId: chatId,
          // Ensure no file data is sent so search detection works
          fileUri: undefined,
          fileMimeType: undefined,
          multipleFiles: undefined
        }
      })

      // Auto-scroll to bottom after submitting
      setTimeout(() => {
        const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight
        }
      }, 100)
    } else {
      // Fallback if append is not available
      console.warn('Append method not available, using traditional submit')
      handleInputChange({ target: { value: searchQuestion } } as React.ChangeEvent<HTMLInputElement>)
      setTimeout(() => {
        handleSubmit()
        // Auto-scroll to bottom after submitting
        setTimeout(() => {
          const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]')
          if (scrollArea) {
            scrollArea.scrollTop = scrollArea.scrollHeight
          }
        }, 100)
      }, 10)
    }
  }, [append, handleInputChange, handleSubmit, selectedModel, chatId])

  // Handle reverse engineering follow-up actions
  const handleReverseEngineeringAction = useCallback(async (
    action: 'generate-image' | 'animate-image' | 'edit-image' | 'generate-variations',
    prompt: string,
    imageUri?: string
  ) => {
    console.log('[Reverse Engineering Action]', { action, prompt, imageUri })

    switch (action) {
      case 'generate-image':
        // Generate image using the extracted prompt
        if (append) {
          await append({
            role: 'user',
            content: `Generate image: ${prompt}`
          }, {
            body: {
              model: selectedModel,
              imageGenerationModel: currentImageSettings.model,
              imageEditingModel: imageEditingModel,
              chatId: chatId,
              imageSettings: {
                quality: currentImageSettings.quality,
                style: currentImageSettings.style,
                size: currentImageSettings.size
              }
            }
          })
        }
        break

      case 'animate-image':
        // Animate the analyzed image
        if (imageUri && onAnimateImage) {
          // Extract image name from URI or use default
          const imageName = imageUri.split('/').pop() || 'analyzed-image'
          onAnimateImage(imageUri, imageName)
        } else {
          toast.error("No image available to animate")
        }
        break

      case 'edit-image':
        // Edit the analyzed image
        if (imageUri) {
          // Create a mock file object to trigger edit dialog
          const mockFile: FileUpload = {
            file: new File([], 'analyzed-image'),
            preview: imageUri,
            geminiFile: { uri: imageUri, mimeType: 'image/png', name: 'analyzed-image.png' }
          }
          setSelectedFile(mockFile)
          setActionDialog({ isOpen: true, action: 'edit', imageName: 'analyzed-image' })
        } else {
          toast.error("No image available to edit")
        }
        break

      case 'generate-variations':
        // Generate variations using the prompt
        if (append) {
          await append({
            role: 'user',
            content: `Generate 4 variations of this image with different styles: ${prompt}`
          }, {
            body: {
              model: selectedModel,
              imageGenerationModel: currentImageSettings.model,
              imageEditingModel: imageEditingModel,
              chatId: chatId,
              imageSettings: {
                quality: currentImageSettings.quality,
                style: currentImageSettings.style,
                size: currentImageSettings.size
              }
            }
          })
        }
        break
    }

    // Auto-scroll to bottom after action
    setTimeout(() => {
      const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight
      }
    }, 100)
  }, [append, selectedModel, currentImageSettings, imageEditingModel, chatId, onAnimateImage])

  // Handle prompt enhancement
  const handleEnhancePrompt = useCallback((originalPrompt: string, enhancedPrompt: string) => {
    console.log('[Chat Interface] Prompt enhanced:', { originalPrompt, enhancedPrompt })
    toast.success('Prompt enhanced successfully!')
  }, [])

  // Handle deep research mode toggle
  const handleDeepResearch = useCallback(() => {
    setIsDeepResearchMode(prev => !prev)
    if (!isDeepResearchMode) {
      // Activating deep research mode
      toast.info('Deep Research Mode Active', {
        description: 'Your next message will trigger comprehensive research with Perplexity Sonar',
        duration: 5000
      })
      // Show the deep research panel immediately
      setShowDeepResearchPanel(true)
    } else {
      // Deactivating deep research mode
      toast.info('Deep Research Mode Deactivated', {
        description: 'Regular chat mode restored'
      })
    }
  }, [isDeepResearchMode])

  // Handle edit dialog confirmation
  const handleEditConfirm = useCallback(async (prompt: string) => {
    if (!selectedFile || !selectedFile.geminiFile) return;

    // For uploaded images, we'll use image generation with the edit prompt
    // This avoids the Gemini URI access limitation
    try {
      toast.info("Processing your edit request...", {
        description: "I'll create a new image based on your changes"
      });

      // Create a prompt that will trigger image generation
      const editPrompt = `Based on the uploaded image, generate an image with these modifications: ${prompt}. The new image should match the original style and composition, only applying the requested changes.`;

      // Set the input with the edit prompt
      handleInputChange({ target: { value: editPrompt } } as React.ChangeEvent<HTMLInputElement>)

      // Submit with the image still attached
      setTimeout(() => {
        console.log('[handleEditConfirm] Submitting with file:', selectedFile?.file?.name)
        handleSubmitRef.current?.() // Use ref to avoid initialization issues
      }, 100)

      // Don't clear the file here - let handleSubmit do it after submission

    } catch (error) {
      console.error('Image editing error:', error);
      toast.error("Edit Error", {
        description: error instanceof Error ? error.message : "Failed to process edit request"
      });
    }
  }, [selectedFile, handleInputChange]);

  // Handle animate dialog confirmation
  const handleAnimateConfirm = useCallback((prompt: string) => {
    if (!selectedFile) return;

    // Store the aspect ratio for video generation
    if (selectedFile.aspectRatio?.videoAspectRatio && typeof window !== 'undefined') {
      localStorage.setItem('videoGenerationAspectRatio', selectedFile.aspectRatio.videoAspectRatio);
    }

    // Submit with animation prompt
    handleInputChange({ target: { value: `animate this image: ${prompt}` } } as React.ChangeEvent<HTMLInputElement>)
    setTimeout(() => {
      const event = new Event('submit', { bubbles: true, cancelable: true }) as any
      event.preventDefault = () => {}
      originalHandleSubmit(event)
    }, 100)
  }, [handleInputChange, originalHandleSubmit, selectedFile, videoAspectRatio]);

  // Handle video generation from modal
  const handleVideoGeneration = useCallback(async (options: VideoGenerationOptions) => {
    try {
      console.log('[Video Generation] Starting with options:', options);

      // Close the modal
      setShowVideoModal(false);

      // Construct the prompt based on workflow
      let videoPrompt = '';

      if (options.workflow === 'studio') {
      }

      // For quick workflow, submit as a chat message
      if (options.startImage) {
        // If we have an image, it's an animation request
        videoPrompt = `animate this image: ${options.prompt}`;
      } else {
        // Text-to-video request
        videoPrompt = `create a video of ${options.prompt}`;
      }

      // Add backend hint if not default
      if (options.backend === 'huggingface') {
        videoPrompt += ' using huggingface';
      }

      // Add duration hint if not default
      if (options.duration === 10) {
        videoPrompt += ' 10 second video';
      } else if (options.duration === 8) {
        videoPrompt += ' 8 second video';
      }

      // Add aspect ratio hint if not default
      if (options.aspectRatio === '9:16') {
        videoPrompt += ' in portrait mode';
      } else if (options.aspectRatio === '1:1') {
        videoPrompt += ' in square format';
      }

      // Store video generation settings
      if (typeof window !== 'undefined') {
        if (options.aspectRatio) {
          localStorage.setItem('videoGenerationAspectRatio', options.aspectRatio);
        }
        if (options.backend) {
          localStorage.setItem('videoGenerationBackend', options.backend);
        }
      }

      // Submit the request
      handleInputChange({ target: { value: videoPrompt } } as React.ChangeEvent<HTMLInputElement>);

      setTimeout(() => {
        const event = new Event('submit', { bubbles: true, cancelable: true }) as any;
        event.preventDefault = () => {};
        originalHandleSubmit(event);
      }, 100);

    } catch (error) {
      console.error('[Video Generation] Error:', error);
      toast.error("Video Generation Error", {
        description: error instanceof Error ? error.message : "Failed to start video generation"
      });
    }
  }, [handleInputChange, originalHandleSubmit]);

  // Handle video generation from reverse engineering prompts
  const handleReverseEngineeringVideoGeneration = useCallback(async (prompt: string) => {
    try {
      console.log('[Reverse Engineering Video] Starting generation with prompt:', prompt);

      // Create video generation options with default settings
      const options: VideoGenerationOptions = {
        prompt: prompt,
        workflow: 'quick',
        backend: videoBackend,
        duration: videoDuration,
        aspectRatio: videoAspectRatio
      };

      // Use the existing video generation handler
      await handleVideoGeneration(options);

    } catch (error) {
      console.error('[Reverse Engineering Video] Error:', error);
      throw error; // Re-throw to be handled by the CopyablePrompt component
    }
  }, [handleVideoGeneration, videoBackend, videoDuration, videoAspectRatio]);

  // Handle image option selection (from chat message)
  const handleChatImageOptionSelect = useCallback((optionId: string, imageUri: string) => {
    console.log('[handleChatImageOptionSelect] Selected option:', optionId, 'for image:', imageUri);

    switch (optionId) {
      case 'analyze':
        // Submit analyze request with detailed prompt
        handleInputChange({ target: { value: 'Analyze this image and provide a detailed analysis' } } as React.ChangeEvent<HTMLInputElement>)
        setTimeout(() => {
          const event = new Event('submit', { bubbles: true, cancelable: true }) as any
          event.preventDefault = () => {}
          originalHandleSubmit(event)
        }, 100)
        break;

      case 'edit':
        // Handle edit option for chat message images using imageUri parameter
        if (imageUri) {
          // Create a GeneratedImage object from the chat image URI
          const uploadedImage: GeneratedImage = {
            id: generateImageId(),
            url: imageUri,
            prompt: `Chat Image: ${imageUri.split('/').pop() || 'image'}`,
            timestamp: new Date(),
            quality: imageQuality,
            style: currentImageSettings.style,
            size: currentImageSettings.size,
            model: 'uploaded',
            isUploaded: true,
            isGenerating: false,
            // Store the original image URI as geminiUri for reference
            geminiUri: imageUri
          }

          console.log('[handleChatImageOptionSelect] Creating image for edit:', {
            id: uploadedImage.id,
            url: uploadedImage.url.substring(0, 100) + '...',
            prompt: uploadedImage.prompt
          })

          // Add to gallery
          onGeneratedImagesChange?.([...generatedImages, uploadedImage])

          // Request auto-open of edit modal
          onEditImageRequested?.(uploadedImage.id)

          // Switch to Images tab
          onImageGenerationStart?.()

          toast.success("Image Added to Gallery", {
            description: "Opening edit dialog...",
            duration: 2000
          })
        } else {
          console.error('[handleChatImageOptionSelect] No imageUri provided for edit option')
          toast.error("No image available to edit", {
            description: "Image URI is missing",
            duration: 3000
          })
        }
        break;

      case 'animate':
        // Submit animate request
        handleInputChange({ target: { value: 'animate this image' } } as React.ChangeEvent<HTMLInputElement>)
        setTimeout(() => {
          const event = new Event('submit', { bubbles: true, cancelable: true }) as any
          event.preventDefault = () => {}
          originalHandleSubmit(event)
        }, 100)
        break;
    }
  }, [handleInputChange, originalHandleSubmit, imageQuality, currentImageSettings.style, currentImageSettings.size, onGeneratedImagesChange, onEditImageRequested, onImageGenerationStart])

  // Handle video option selection (similar to image options)
  const handleChatVideoOptionSelect = useCallback((optionId: string, videoUri: string) => {
    console.log('[ChatInterface] Video option selected:', optionId, videoUri)

    if (optionId === 'analyze') {
      // Use comprehensive analysis prompt with enhanced timestamp requirements
      const analysisPrompt = `Please provide a comprehensive analysis of this entire video from start to finish. Include:

1. **Overview**: Brief summary of the video's purpose and content with total duration

2. **Complete Audio Transcription with Precise Timestamps**:
   - Provide a COMPLETE word-for-word transcription of ALL spoken content
   - Use precise timestamps in [MM:SS] format for every line of dialogue or narration
   - Format as: [00:15] Speaker A: "exact words spoken here"
   - Identify and differentiate speakers consistently (Speaker A, Speaker B, etc.)
   - Include ALL background audio descriptions with timestamps: [01:23] [Background music begins]
   - Note the language being spoken and any accents or speech patterns
   - Include sound effects, music changes, and audio cues with precise timing
   - DO NOT summarize or paraphrase - transcribe the exact words spoken

3. **Visual Analysis with Timeline**:
   - Describe all scenes in chronological order with corresponding timestamps
   - Note any text, graphics, visual effects, and when they appear/disappear
   - Describe camera movements, transitions, and editing style with timing
   - Note visual cues that correspond to the audio content

4. **Synchronized Audio-Visual Breakdown**:
   - Correlate what is being said with what is happening visually at each timestamp
   - Note how audio and visual elements work together
   - Identify moments where audio and visual don't align (if any)

5. **Technical Aspects**: Video quality, aspect ratio, production value, audio quality

6. **Complete Timeline**: Provide a scene-by-scene breakdown with timestamps

7. **Key Messages & Themes**: Main themes or messages conveyed throughout

8. **Overall Assessment**: Style, effectiveness, and notable features

CRITICAL REQUIREMENTS:
- Generate timestamps through careful frame-by-frame and audio analysis
- Every line of spoken content MUST have a precise timestamp
- Include timestamps for significant audio/visual events
- Ensure complete coverage from 00:00 to the end of the video
- Provide the most detailed and accurate transcription possible

Please ensure you analyze the ENTIRE video duration from beginning to end with precise timing information.`

      handleInputChange({ target: { value: analysisPrompt } } as React.ChangeEvent<HTMLInputElement>)

      setTimeout(() => {
        console.log('[ChatInterface] Submitting video analysis request')
        const event = new Event('submit') as any
        originalHandleSubmit(event)
      }, 100)
    } else if (optionId === 'reverse-engineer') {
      // Use enhanced reverse engineering prompt with transcription
      const reverseEngineerPrompt = `Please reverse engineer this video and provide a comprehensive analysis including:

1. **Complete Audio Transcription with Timestamps**:
   - Provide COMPLETE word-for-word transcription of ALL spoken content
   - Use precise timestamps in [MM:SS] format: [00:15] Speaker A: "exact words"
   - Include all dialogue, narration, voice-overs, and background audio
   - Note speaker identification, tone, pacing, and delivery style
   - Include sound effects, music cues, and audio transitions with timing
   - This will inform the production analysis and recreation guide

2. **Production Breakdown**:
   - Estimated tools and software used for creation (video editing, audio post-production)
   - Camera/recording equipment likely used (based on video and audio quality)
   - Editing techniques and transitions employed (with reference to timeline)
   - Visual effects and how they were achieved
   - Audio production techniques (mixing, mastering, effects)

3. **Content Structure & Script Analysis**:
   - Script or outline reconstruction based on the timestamped transcription
   - Storytelling techniques used and their timing
   - Information architecture and flow (correlate with transcript timing)
   - Pacing decisions and how they relate to the spoken content
   - Call-to-action placement and delivery style

4. **Technical Recreation Guide**:
   - Step-by-step process to recreate similar content
   - Required skills and tools for both video and audio production
   - Estimated time and resources needed for each production phase
   - Specific techniques for achieving similar audio quality and delivery
   - Script writing approach based on the transcribed content structure

5. **Design Decisions**:
   - Color grading and visual style choices
   - Audio mixing and sound design approach (informed by timestamp analysis)
   - Pacing and rhythm decisions (correlated with speech timing)
   - Visual-audio synchronization techniques

6. **Creation Workflow**:
   - Pre-production planning evident in the video (script preparation, audio planning)
   - Production process insights (recording techniques, equipment setup)
   - Post-production workflow analysis (editing, audio sync, effects timing)

CRITICAL REQUIREMENTS:
- Generate timestamps through careful audio-visual analysis
- The transcription should inform all other analysis sections
- Correlate production insights with specific timestamps from the audio content
- Provide actionable insights that include both visual and audio recreation guidance

Please provide actionable insights that would help someone recreate a similar video with identical production quality and content structure.`

      handleInputChange({ target: { value: reverseEngineerPrompt } } as React.ChangeEvent<HTMLInputElement>)

      setTimeout(() => {
        console.log('[ChatInterface] Submitting video reverse engineering request')
        const event = new Event('submit') as any
        originalHandleSubmit(event)
      }, 100)
    }
  }, [handleInputChange, originalHandleSubmit])

  // Helper function to submit with a specific message
  const submitWithMessage = useCallback((message: string) => {
    // Set the input value
    handleInputChange({ target: { value: message } } as React.ChangeEvent<HTMLInputElement>)

    // We need to wait for React to update the state before submitting
    setTimeout(() => {
      // Double-check file is still selected
      console.log('[submitWithMessage] Submitting with file:', selectedFile?.file?.name)
      console.log('[submitWithMessage] Input value:', input)

      // Call handleSubmit directly
      handleSubmit()
    }, 100)
  }, [handleInputChange, selectedFile, handleSubmit, input])

  // Expose submit function to parent component
  useEffect(() => {
    if (onChatSubmitRef) {
      onChatSubmitRef(submitWithMessage)
    }
  }, [onChatSubmitRef, submitWithMessage])

  const handleToolToggle = useCallback((serverId: string, toolName: string, enabled: boolean) => {
    setEnabledTools(prev => ({
      ...prev,
      [serverId]: {
        ...prev[serverId],
        [toolName]: enabled
      }
    }))
    console.log('Tool toggled:', { serverId, toolName, enabled })
  }, [])

  const handleServerToggle = useCallback((serverId: string, enabled: boolean) => {
    setEnabledServers(prev => ({
      ...prev,
      [serverId]: enabled
    }))
    console.log('Server toggled:', { serverId, enabled })
  }, [])

  // Check messages for API key requests
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      // Check for API key request pattern: REQUEST_API_KEY:{...}
      const apiKeyMatch = lastMessage.content.match(/REQUEST_API_KEY:({[^}]+})/)
      if (apiKeyMatch) {
        try {
          const requestData = JSON.parse(apiKeyMatch[1])
          setApiKeyRequest({
            isOpen: true,
            serverName: requestData.server,
            serverInfo: requestData.info
          })
        } catch (e) {
          console.error('Failed to parse API key request:', e)
        }
      }
    }
  }, [messages])

  // Get video progress store functions
  const { addVideo, completeVideo, failVideo } = useVideoProgressStore()

  // Check messages for video generation markers
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    console.log('[VIDEO DEBUG] Checking last message:', {
      hasMessage: !!lastMessage,
      role: lastMessage?.role,
      contentLength: lastMessage?.content?.length,
      containsMarker: lastMessage?.content?.includes('[VIDEO_GENERATION_STARTED]')
    })
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      // Debug: Log message content to check for video markers
      if (lastMessage.content.includes('VIDEO_GENERATION')) {
        console.log('[Chat Interface] Message contains VIDEO_GENERATION. Content preview:', lastMessage.content.substring(0, 500))
      }

      // Check for VIDEO_GENERATION_STARTED pattern
      const videoMatch = lastMessage.content.match(/\[VIDEO_GENERATION_STARTED\]([\s\S]*?)\[\/VIDEO_GENERATION_STARTED\]/)
      if (videoMatch) {
        try {
          const videoData = JSON.parse(videoMatch[1])
          console.log('[Chat Interface] Successfully parsed video generation data:', videoData)

          // Create a new video entry
          const newVideo: GeneratedVideo = {
            id: videoData.id,
            prompt: videoData.prompt,
            url: videoData.url || '',
            duration: videoData.duration,
            aspectRatio: videoData.aspectRatio,
            model: videoData.model,
            status: videoData.status === 'succeeded' ? 'completed' : 'generating',
            createdAt: new Date()
          }

          if (onGeneratedVideosChange) {
            // Check if video already exists
            const existingVideoIndex = (generatedVideos || []).findIndex(v => v.id === newVideo.id)
            if (existingVideoIndex === -1) {
              // Add new video
              console.log('[VIDEO DEBUG] Adding new video and switching tab:', newVideo.id)
              onGeneratedVideosChange([...(generatedVideos || []), newVideo])

              // Add video to progress store
              addVideo(newVideo.id, newVideo.prompt)

              // Switch to video tab when new video generation starts
              if (onVideoGenerationStart) {
                console.log('[VIDEO DEBUG] Calling onVideoGenerationStart')
                onVideoGenerationStart()
              } else {
                console.log('[VIDEO DEBUG] onVideoGenerationStart is not defined!')
              }
            } else if (videoData.status === 'succeeded' && generatedVideos[existingVideoIndex].status === 'generating') {
              // Update existing video with completed status
              const updatedVideos = [...generatedVideos]
              updatedVideos[existingVideoIndex] = newVideo
              onGeneratedVideosChange(updatedVideos)

              // Mark video as complete in progress store
              completeVideo(newVideo.id)
            }
          }

          // If video is generating, start polling
          if (videoData.status !== 'succeeded' && !videoData.url) {
            const pollStatus = async () => {
              try {
                const statusResponse = await fetch(`/api/generate-video?id=${videoData.id}`)
                const status = await statusResponse.json()

                if (status.status === 'succeeded' && status.output) {
                  // Update video with completed URL
                  if (onGeneratedVideosChange) {
                    const updatedVideos = (generatedVideos || []).map(v =>
                      v.id === videoData.id
                        ? { ...v, url: status.output, status: 'completed' as const, thumbnailUrl: status.thumbnailUrl }
                        : v
                    )
                    onGeneratedVideosChange(updatedVideos)
                  }

                  // Mark video as complete in progress store
                  completeVideo(videoData.id)
                } else if (status.status === 'failed') {
                  // Update video with failed status
                  if (onGeneratedVideosChange) {
                    const updatedVideos = (generatedVideos || []).map(v =>
                      v.id === videoData.id
                        ? { ...v, status: 'failed' as const, error: status.error || 'Generation failed' }
                        : v
                    )
                    onGeneratedVideosChange(updatedVideos)
                  }
                  // Mark video as failed in progress store
                  failVideo(videoData.id, status.error || 'Generation failed')
                } else {
                  // Continue polling
                  setTimeout(pollStatus, 5000)
                }
              } catch (error) {
                console.error('Polling error:', error)
              }
            }

            // Start polling after a delay
            setTimeout(pollStatus, 5000)
          }
        } catch (e) {
          console.error('Failed to parse video generation data:', e)
        }
      }
    }
  }, [messages, onGeneratedVideosChange, generatedVideos, onVideoGenerationStart, addVideo, completeVideo, failVideo]);

  // Monitor messages for TTS data
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]

    }
  }, [messages, onGeneratedAudioChange])

  // Track placeholder IDs to replace them with actual images
  const placeholderIdsRef = useRef<Map<string, string>>(new Map())

  // Create placeholder when user submits an image generation request
  useEffect(() => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()

    if (lastUserMessage) {
      // Check if the user message is an image generation request and we haven't created a placeholder yet
      if (isImageGenerationRequest(lastUserMessage.content) &&
          !placeholderIdsRef.current.has(lastUserMessage.id)) {
        console.log('[Chat Interface] Creating placeholder for image generation request')

        // Create a placeholder image
        const placeholderId = generateImageId()
        const placeholderImage: GeneratedImage = {
          id: placeholderId,
          url: '', // Empty URL while generating
          prompt: lastUserMessage.content,
          timestamp: new Date(),
          quality: 'standard',
          model: 'pending',
          isGenerating: true,
          generationStartTime: new Date(),
        }

        // Store the mapping
        placeholderIdsRef.current.set(lastUserMessage.id, placeholderId)

        // Add placeholder to gallery
        onGeneratedImagesChange?.([...generatedImages, placeholderImage])

        // Switch to Images tab
        onImageGenerationStart?.()
        console.log('[Chat Interface] Placeholder created and Images tab should switch')
      }
    }
  }, [messages, onGeneratedImagesChange, onImageGenerationStart])

  // Check messages for image generation markers (both IMAGE_GENERATION_COMPLETED and IMAGE_EDITING_COMPLETED)
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    console.log('[Chat Interface] Checking last message for image markers:', {
      hasLastMessage: !!lastMessage,
      role: lastMessage?.role,
      contentLength: lastMessage?.content?.length,
      contentPreview: lastMessage?.content?.substring(0, 100),
      hasImageMarker: lastMessage?.content?.includes('IMAGE_GENERATION_COMPLETED')
    })
    if (lastMessage?.role === 'assistant' && lastMessage.content) {
      // Check for IMAGE_GENERATION_COMPLETED pattern (for standard image generation)
      // Handle both single-block and chunked transmission
      let imageGenMatch = lastMessage.content.match(/\[IMAGE_GENERATION_COMPLETED\]([\s\S]*?)\[\/IMAGE_GENERATION_COMPLETED\]/)

      // If no complete match found, check if we have chunked data
      if (!imageGenMatch && lastMessage.content.includes('[IMAGE_GENERATION_COMPLETED]')) {
        console.log('[Chat Interface] Found incomplete IMAGE_GENERATION_COMPLETED marker, attempting to reconstruct from chunks')

        // Try to reconstruct the JSON from chunked data
        const startMarker = '[IMAGE_GENERATION_COMPLETED]'
        const endMarker = '[/IMAGE_GENERATION_COMPLETED]'

        const startIndex = lastMessage.content.indexOf(startMarker)
        const endIndex = lastMessage.content.indexOf(endMarker)

        if (startIndex !== -1) {
          if (endIndex !== -1) {
            // We have both markers, extract the content
            const jsonContent = lastMessage.content.substring(startIndex + startMarker.length, endIndex)
            imageGenMatch = [lastMessage.content, jsonContent]
          } else {
            // We only have the start marker, the data might be incomplete
            console.log('[Chat Interface] Incomplete image data - missing end marker')
            return // Wait for more data
          }
        }
      }

      if (imageGenMatch) {
        console.log('[Chat Interface] Found IMAGE_GENERATION_COMPLETED marker, raw content length:', imageGenMatch[1]?.length)
        try {
          // Clean up the JSON content before parsing - remove leading/trailing whitespace and newlines
          let rawJsonContent = imageGenMatch[1]
          if (rawJsonContent) {
            rawJsonContent = rawJsonContent.trim()
            // Remove any leading newlines or whitespace
            rawJsonContent = rawJsonContent.replace(/^\s*\n+/, '')
          }
          console.log('[Chat Interface] Cleaned JSON content preview:', rawJsonContent.substring(0, 200) + '...')

          const imageData = JSON.parse(rawJsonContent)
          console.log('[Chat Interface] Successfully parsed IMAGE_GENERATION_COMPLETED data:', imageData)

          if (imageData.success && imageData.images && imageData.images.length > 0) {
            // Image processing is now handled through the new notification system

            // Check if this is the new notification format (with image IDs) or old format (with full data)
            if (imageData.images && imageData.images[0] && imageData.images[0].id) {
              // New format: images are already saved, we just need to fetch them
              console.log('[Chat Interface] Received image notification for', imageData.imageCount, 'images')

              // Create a unique key for this notification to prevent duplicate processing
              const notificationKey = `${lastMessage.id}-${imageData.images.map((img: any) => img.id).join(',')}`

              // Check if we've already processed this notification
              if (processedImageNotificationsRef.current.has(notificationKey)) {
                console.log('[Chat Interface] Skipping duplicate image notification:', notificationKey)
                return
              }

              // Mark this notification as processed
              processedImageNotificationsRef.current.add(notificationKey)

              // Fetch the actual image data from the API (async)
              fetch('/api/images?limit=10')
                .then(response => response.json())
                .then(data => {
                  if (data.images && data.images.length > 0) {
                    // Find the newly generated images by matching IDs
                    const newImageIds = imageData.images.map((img: any) => img.id)
                    const newImages = data.images.filter((img: any) =>
                      newImageIds.includes(img.id) ||
                      newImageIds.includes(img.metadata?.localId)
                    )

                    console.log('[Chat Interface] Found', newImages.length, 'new images from API')

                    if (newImages.length > 0) {
                      // Convert API format to local format
                      const convertedImages = newImages.map((img: any) => ({
                        id: img.id || img.metadata?.localId || generateImageId(),
                        prompt: img.prompt || 'Generated image',
                        url: img.url,
                        timestamp: new Date(img.created_at || img.timestamp),
                        quality: img.quality || 'standard',
                        model: img.model || 'unknown',
                        style: img.style || 'vivid',
                        size: img.size || '1024x1024',
                        isGenerating: false
                      }))

                      // Replace placeholder if it exists, otherwise add new images
                      if (onGeneratedImagesChange) {
                        // Check if we have a placeholder to replace
                        const lastUserMessage = messages.filter(m => m.role === 'user').pop()
                        const placeholderId = lastUserMessage ? placeholderIdsRef.current.get(lastUserMessage.id) : null

                        let updatedImages
                        if (placeholderId) {
                          // Replace the placeholder with the actual image
                          updatedImages = generatedImages.map(img =>
                            img.id === placeholderId ? { ...convertedImages[0], id: placeholderId } : img
                          )
                          // Add any additional images beyond the first one
                          if (convertedImages.length > 1) {
                            updatedImages = [...updatedImages, ...convertedImages.slice(1)]
                          }
                          console.log('[Chat Interface] Replaced placeholder with actual image:', placeholderId)
                        } else {
                          // No placeholder, just add new images
                          updatedImages = [...generatedImages, ...convertedImages]
                        }
                        if (placeholderId) {
                          // Replace the placeholder with the actual image
                          const updated = generatedImages.map(img =>
                            img.id === placeholderId ? { ...convertedImages[0], id: placeholderId } : img
                          )
                          // Add any additional images beyond the first one
                          if (convertedImages.length > 1) {
                            onGeneratedImagesChange([...updated, ...convertedImages.slice(1)])
                          } else {
                            onGeneratedImagesChange(updated)
                          }
                        } else {
                          // No placeholder, just add new images
                          onGeneratedImagesChange([...generatedImages, ...convertedImages])
                        }
                      }

                      // Show success message
                      toast.success(`Generated ${convertedImages.length} image${convertedImages.length > 1 ? 's' : ''}!`, {
                        description: "Images are now available in the Images tab",
                        duration: 3000
                      })
                    }
                  } else {
                    console.log('[Chat Interface] No images found in API response')
                  }
                })
                .catch(fetchError => {
                  console.error('[Chat Interface] Failed to fetch images from API:', fetchError)
                  toast.error("Images were generated but couldn't be loaded", {
                    description: "Please refresh the page to see your images",
                    duration: 5000
                  })
                })
            } else {
              // Old format: process images directly (fallback)
              console.log('[Chat Interface] Processing images in old format')
              const newImages = imageData.images.map((img: any) => ({
                id: generateImageId(),
                prompt: imageData.prompt || img.revisedPrompt || 'Generated image',
                url: img.originalUrl || img.url,
                timestamp: new Date(),
                quality: imageData.metadata?.model === 'gpt-image-1' ? 'hd' : 'standard',
                model: imageData.metadata?.model || 'unknown',
                style: imageData.metadata?.style || 'vivid',
                size: imageData.metadata?.size || '1024x1024',
                isGenerating: false
              }))

              // Replace placeholder if it exists, otherwise add new images
              if (onGeneratedImagesChange) {
                // Check if we have a placeholder to replace
                const lastUserMessage = messages.filter(m => m.role === 'user').pop()
                const placeholderId = lastUserMessage ? placeholderIdsRef.current.get(lastUserMessage.id) : null

                let updatedImages
                if (placeholderId) {
                  // Replace the placeholder with the actual image
                  updatedImages = generatedImages.map(img =>
                    img.id === placeholderId ? { ...newImages[0], id: placeholderId } : img
                  )
                  // Add any additional images beyond the first one
                  if (newImages.length > 1) {
                    updatedImages = [...updatedImages, ...newImages.slice(1)]
                  }
                  console.log('[Chat Interface] Replaced placeholder with actual image (old format):', placeholderId)
                } else {
                  // No placeholder, just add new images
                  updatedImages = [...generatedImages, ...newImages]
                }
                if (placeholderId) {
                  // Replace the placeholder with the actual image
                  const updated = generatedImages.map(img =>
                    img.id === placeholderId ? { ...newImages[0], id: placeholderId } : img
                  )
                  // Add any additional images beyond the first one
                  if (newImages.length > 1) {
                    onGeneratedImagesChange([...updated, ...newImages.slice(1)])
                  } else {
                    onGeneratedImagesChange(updated)
                  }
                } else {
                  // No placeholder, just add new images
                  onGeneratedImagesChange([...generatedImages, ...newImages])
                }
              }

              // Show success message
              toast.success(`Generated ${newImages.length} image${newImages.length > 1 ? 's' : ''}!`, {
                description: "Images are now available in the Images tab",
                duration: 3000
              })
            }

            // Note: Image processing is now handled above in the new notification format
            // This section is kept for any remaining cleanup but should not be reached
            console.log('[Chat Interface] Image processing completed')
          }
        } catch (e) {
          console.error('[Chat Interface] Failed to parse image generation data:', e)
          console.error('[Chat Interface] Raw marker content that failed to parse:', imageGenMatch[1])

          // Show user-friendly error
          toast.error("Image generation completed but failed to display", {
            description: "The image was generated but couldn't be added to the gallery. Please try again.",
            duration: 5000
          })
        }
      }

      // Check for IMAGE_EDITING_COMPLETED pattern (already handled elsewhere but included for completeness)
      const imageEditMatch = lastMessage.content.match(/\[IMAGE_EDITING_COMPLETED\]([\s\S]*?)\[\/IMAGE_EDITING_COMPLETED\]/)
      if (imageEditMatch) {
        try {
          const imageData = JSON.parse(imageEditMatch[1])
          console.log('[Chat Interface] Found IMAGE_EDITING_COMPLETED data:', imageData)

          if (imageData.success && imageData.images && imageData.images.length > 0) {
            // Process edited image
            const editedImage = {
              id: generateImageId(),
              prompt: imageData.prompt || 'Edited image',
              url: imageData.images[0].url,
              timestamp: new Date(),
              quality: 'hd' as const,
              model: 'gpt-image-1',
              isGenerating: false,
              originalImageId: imageData.originalImageId
            }

            // Add edited image to the gallery
            onGeneratedImagesChange?.([...generatedImages, editedImage])

            // Switch to images tab
            onImageGenerationStart?.()

            // Show success notification
            toast.success("Image edited successfully!", {
              duration: 3000
            })
          }
        } catch (e) {
          console.error('Failed to parse image editing data:', e)
        }
      }
    }
  }, [messages, onGeneratedImagesChange, onImageGenerationStart])


  // Handle editing image from file preview modal
  const handleEditImageFromModal = useCallback((imageUrl: string, imageName: string) => {
    // Create a temporary generated image to add to the gallery
    const tempImage: GeneratedImage = {
      id: generateImageId(),
      prompt: `Edit of ${imageName}`,
      url: imageUrl,
      timestamp: new Date(),
      quality: 'hd',
      model: 'uploaded',
      isGenerating: false,
    }

    // Add to generated images
    if (onGeneratedImagesChange) {
      onGeneratedImagesChange([...generatedImages, tempImage])
    }

    // Switch to Images tab
    if (onImageGenerationStart) {
      onImageGenerationStart()
    }

    // Request auto-open of edit modal after a small delay
    setTimeout(() => {
      if (onEditImageRequested) {
        onEditImageRequested(tempImage.id)
      }
    }, 100)

    toast.success("Image Added to Gallery", {
      description: "Opening edit dialog...",
      duration: 2000
    })
  }, [onGeneratedImagesChange, onImageGenerationStart, onEditImageRequested])

  // Handle multi-image edit completion
  const handleMultiImageEditComplete = useCallback((editedImage: GeneratedImage) => {
    console.log('[ChatInterface] Multi-image edit completed:', editedImage.id)

    // Add the edited image to the gallery
    if (onGeneratedImagesChange) {
      onGeneratedImagesChange([...generatedImages, editedImage])
    }

    // Switch to Images tab
    if (onImageGenerationStart) {
      onImageGenerationStart()
    }

    // Clear the uploaded files since they've been processed
    clearSelectedFile('multi-image-edit-complete')
    clearSelectedFiles('multi-image-edit-complete')
    setShowImageOptions(false)

    // Close the modal
    setMultiImageEditModal({ isOpen: false, images: [] })

    toast.success("Multi-image edit completed!", {
      description: "The edited image has been added to your gallery",
      duration: 3000
    })
  }, [onGeneratedImagesChange, onImageGenerationStart])

  const handleApiKeySubmit = useCallback((apiKey: string) => {
    // Send the API key back to the assistant
    const maskedKey = apiKey.length > 8
      ? apiKey.substring(0, 4) + '•'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4)
      : '•'.repeat(apiKey.length)

    // Create a message with the API key
    const apiKeyMessage = `API_KEY_PROVIDED:${JSON.stringify({
      server: apiKeyRequest.serverName,
      apiKey: apiKey,
      masked: maskedKey
    })}`

    // Send as a new message
    if (originalHandleSubmit) {
      // Create a synthetic form event
      const syntheticEvent = {
        preventDefault: () => {},
        target: {}
      } as React.FormEvent<HTMLFormElement>

      // Temporarily set the input value
      handleInputChange({ target: { value: apiKeyMessage } } as React.ChangeEvent<HTMLInputElement>)

      // Submit the message
      setTimeout(() => {
        originalHandleSubmit(syntheticEvent)
      }, 0)
    }

    // Close the dialog
    setApiKeyRequest({ isOpen: false, serverName: '' })
  }, [apiKeyRequest.serverName, originalHandleSubmit, handleInputChange])

  return (
    <div className="flex flex-col h-full border-r border-[#333333] bg-[#2B2B2B]">
      <div className="p-4 border-b border-[#333333] bg-[#2B2B2B]">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">AI Assistant</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              data-testid="settings-button"
              onClick={() => setShowImageSettings(true)}
              className="text-gray-400 hover:text-white"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-500 font-medium">Error: {error.message}</p>
            <p className="text-xs text-red-400 mt-1">The assistant will continue to work in local mode.</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col space-y-4">
          {useMemo(() =>
            messages.map((message, index) => {
          // Get attachments from state
          let attachments = messageAttachments[message.id];

          // ENHANCED ATTACHMENT HANDLING: Check multiple sources for attachments
          if (!attachments && message.role === 'user') {
            // Get all user messages for proper comparison
            const userMessages = messages.filter(m => m.role === 'user');
            const lastUserMessage = userMessages[userMessages.length - 1];
            const isLastUserMessage = lastUserMessage && message.id === lastUserMessage.id;

            // For the first user message (after welcome), also check if it's early in the conversation
            const isFirstUserMessage = userMessages.length === 1 && message.id === userMessages[0].id;

            // Check if this message was just created (within 2 seconds of submission)
            const messageCreatedRecently = lastSubmitTimeRef.current > 0 &&
              (Date.now() - lastSubmitTimeRef.current < 2000);

            console.log('[RENDER] Checking message:', {
              id: message.id,
              role: message.role,
              index: index,
              totalMessages: messages.length,
              isLastUserMessage,
              isFirstUserMessage,
              messageCreatedRecently,
              hasPendingRef: !!pendingAttachmentRef.current,
              hasBackupRef: !!pendingAttachmentBackupRef.current,
              hasAttachmentsInState: !!messageAttachments[message.id],
              hasFirstMessageAttachments: !!firstMessageAttachments,
              userMessageCount: userMessages.length,
              allMessageIds: messages.map(m => m.id),
              attachmentKeys: Object.keys(messageAttachments)
            });

            // Check if we should use pending attachments or first message fallback
            // Prioritize first message attachments for the very first user message
            if ((isFirstUserMessage || (userMessages.length === 1 && messageCreatedRecently)) &&
                firstMessageAttachments && !attachments) {
              // Use first message attachments as fallback for race condition
              console.log('[RENDER] Using firstMessageAttachments fallback for first user message');
              attachments = firstMessageAttachments;

              // Update state to persist the association
              if (!messageAttachments[message.id]) {
                // Schedule state update for after render
                setTimeout(() => {
                  setMessageAttachments(prev => ({
                    ...prev,
                    [message.id]: firstMessageAttachments
                  }));

                  // Clear first message attachments after successful use
                  setTimeout(() => {
                    setFirstMessageAttachments(null);
                  }, 100);
                }, 0);
              }
            } else if ((isLastUserMessage || isFirstUserMessage) &&
                (pendingAttachmentRef.current || pendingAttachmentBackupRef.current)) {

              const pendingAttachment = pendingAttachmentRef.current || pendingAttachmentBackupRef.current;
              console.log('[RENDER] Using pending attachments for message:', message.id, pendingAttachment);

              const tempAttachments: any[] = [];

              // Add the primary attachment
              tempAttachments.push({
                name: pendingAttachment.name,
                contentType: pendingAttachment.contentType,
                url: pendingAttachment.url,
                transcription: pendingAttachment.transcription,
                videoThumbnail: pendingAttachment.videoThumbnail,
                videoDuration: pendingAttachment.videoDuration
              });

              // Add additional files if they exist
              if (pendingAttachment.additionalFiles && pendingAttachment.additionalFiles.length > 0) {
                tempAttachments.push(...pendingAttachment.additionalFiles);
              }

              attachments = tempAttachments;

              // Update messageAttachments state to persist this association
              if (!messageAttachments[message.id] && !attachmentsDisplayedRef.current.has(message.id)) {
                console.log('[RENDER] Setting attachments in state for message:', {
                  messageId: message.id,
                  attachmentCount: tempAttachments.length,
                  attachmentNames: tempAttachments.map(a => a.name),
                  isFirstUserMessage,
                  isLastUserMessage
                });

                // Schedule state update for after render
                setTimeout(() => {
                  setMessageAttachments(prev => ({
                    ...prev,
                    [message.id]: tempAttachments
                  }));
                }, 0);

                // Mark as displayed
                attachmentsDisplayedRef.current.add(message.id);

                // Clear pending attachments after a delay to ensure they're used
                setTimeout(() => {
                  if (attachmentsDisplayedRef.current.has(message.id)) {
                    console.log('[RENDER] Clearing pending attachments after successful display for message:', message.id);
                    pendingAttachmentRef.current = null;
                    pendingAttachmentBackupRef.current = null;
                    clearSelectedFile('render-attachments-displayed');
                    clearSelectedFiles('render-attachments-displayed');
                    // Also clear first message attachments if this was first message
                    if (isFirstUserMessage) {
                      setFirstMessageAttachments(null);
                    }
                  }
                }, 500);
              }
            }
          }

          console.log('[RENDER] Final render for message:', {
            id: message.id,
            role: message.role,
            attachmentCount: attachments?.length || 0,
            hasAttachments: !!attachments
          });

          // Remove transcription from assistant messages for display
          let displayContent = message.content;
          if (message.role === 'assistant' && hasTranscription(message.content)) {
            displayContent = removeTranscriptionFromResponse(message.content);
          }

          // Remove the force web search marker from user messages
          if (message.role === 'user' && displayContent.startsWith('[FORCE_WEB_SEARCH]')) {
            displayContent = displayContent.replace('[FORCE_WEB_SEARCH]', '').trim();
          }

          return (
            <ChatMessage
              key={message.id}
              message={{
                id: message.id,
                role: message.role,
                content: displayContent,
                createdAt: message.createdAt,
                experimental_attachments: attachments,
                toolCalls: message.toolCalls,
              }}
              mcpToolExecuting={mcpToolExecuting}
              onAnimateImage={onAnimateImage}
              onEditImage={handleEditImageFromModal}
              onImageOptionSelect={handleChatImageOptionSelect}
              onVideoOptionSelect={handleChatVideoOptionSelect}
              onMultiImageOptionSelect={handleMultiImageOptionSelect}
              onFollowUpClick={handleFollowUpClick}
              onReverseEngineeringAction={handleReverseEngineeringAction}
              onGenerateVideo={handleReverseEngineeringVideoGeneration}
            />
          );
        }), [messages, messageAttachments, firstMessageAttachments, mcpToolExecuting, onAnimateImage, handleEditImageFromModal, handleChatImageOptionSelect, handleChatVideoOptionSelect, handleMultiImageOptionSelect, handleFollowUpClick, handleReverseEngineeringAction, handleReverseEngineeringVideoGeneration])}
          {/* Render local messages (for image generation feedback) - REMOVED */}
          {/* localMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={{
                id: message.id,
                role: message.role as "user" | "assistant" | "system",
                content: message.content,
                createdAt: new Date(),
              }}
              onAnimateImage={onAnimateImage}
              onEditImage={handleEditImageFromModal}
              onImageOptionSelect={handleChatImageOptionSelect}
              onVideoOptionSelect={handleChatVideoOptionSelect}
              onMultiImageOptionSelect={handleMultiImageOptionSelect}
              onFollowUpClick={handleFollowUpClick}
            />
          ))} */}

          {/* Web Search Indicator */}
          <WebSearchIndicator
            isSearching={isSearchingWeb}
            searchQuery={webSearchQuery}
          />

          {isLoading && (() => {
            // Check if the last user message is an image generation request
            const lastUserMessage = messages.filter(m => m.role === 'user').pop()
            const isImageGen = lastUserMessage && isImageGenerationRequest(lastUserMessage.content)

            return (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-4 py-3 bg-[#3C3C3C]">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-1">
                      <div className={`w-2 h-2 ${isSearchingWeb ? 'bg-blue-400' : isImageGen ? 'bg-purple-400' : 'bg-white'} rounded-full animate-bounce`} />
                      <div
                        className={`w-2 h-2 ${isSearchingWeb ? 'bg-blue-400' : isImageGen ? 'bg-purple-400' : 'bg-white'} rounded-full animate-bounce [animation-delay:0.1s]`}
                      />
                      <div
                        className={`w-2 h-2 ${isSearchingWeb ? 'bg-blue-400' : isImageGen ? 'bg-purple-400' : 'bg-white'} rounded-full animate-bounce [animation-delay:0.2s]`}
                      />
                    </div>
                    <span className="text-sm text-[#B0B0B0]">
                      {isSearchingWeb ? '🔍 Searching the web...' :
                       isImageGen ? '🎨 Generating image...' :
                       'Agent is thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </ScrollArea>

      {/* Deep Research Panel */}
      {showDeepResearchPanel && (
        <DeepResearchPanel
          onClose={() => {
            setShowDeepResearchPanel(false)
            // Also deactivate deep research mode if it's still active
            if (isDeepResearchMode) {
              setIsDeepResearchMode(false)
            }
          }}
          className="border-t border-[#333333]"
        />
      )}

      <div className="border-t border-[#333333]">
        <AnimatePresence>
          <UploadProgress
            progress={uploadProgress}
            status={uploadStatus}
            fileName={selectedFile?.file.name}
            fileSize={selectedFile?.file.size}
          />
        </AnimatePresence>
        <div className="p-4 relative">
          <InlineImageOptions
            isVisible={(() => {
              // Only show if we have showImageOptions true AND we have actual images
              if (!showImageOptions) return false;

              // Check if we have any images (single file or multiple files)
              const hasImageInSingleFile = selectedFile?.file.type.startsWith("image/")
              const hasImagesInMultipleFiles = selectedFiles.some(f => f.file.type.startsWith('image/'))
              const hasAnyImages = hasImageInSingleFile || hasImagesInMultipleFiles

              return hasAnyImages;
            })()}
            onOptionSelect={handleInlineImageOptionSelect}
            showMultiEdit={(() => {
              // Count total images
              let imageCount = 0
              if (selectedFile?.file.type.startsWith('image/')) imageCount++
              imageCount += selectedFiles.filter(f => f.file.type.startsWith('image/')).length
              return imageCount >= 2
            })()}
          />
          <InlineVideoOptions
            isVisible={(() => {
              // Only show if we have showVideoOptions true AND we have actual videos
              if (!showVideoOptions) return false;

              // Check if we have any videos (single file or multiple files)
              const hasVideoInSingleFile = selectedFile?.file.type.startsWith("video/")
              const hasVideosInMultipleFiles = selectedFiles.some(f => f.file.type.startsWith('video/'))
              const hasAnyVideos = hasVideoInSingleFile || hasVideosInMultipleFiles

              return hasAnyVideos;
            })()}
            onOptionSelect={handleInlineVideoOptionSelect}
          />
          <AI_Prompt
            value={input}
            onChange={(value: string) => handleInputChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>)}
            onSubmit={handleSubmit}
            onStop={stop}
            disabled={isLoading}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            onFileSelect={handleFileSelect}
            onFilesSelect={handleFilesSelect}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            onFileRemove={handleFileRemove}
            onFilesRemove={handleFilesRemove}
            onAllFilesRemove={handleAllFilesRemove}
            onToolToggle={handleToolToggle}
            onServerToggle={handleServerToggle}
            onFileClick={handleFileClick}
            onEnhancePrompt={handleEnhancePrompt}
            onDeepResearch={handleDeepResearch}
            isDeepResearchMode={isDeepResearchMode}
            placeholder={isDeepResearchMode ? "Ask your research question... (Deep Research Mode Active)" : undefined}
          />
        </div>
      </div>


      <SettingsDialog
        open={showImageSettings}
        onOpenChange={handleSettingsClose}
        imageGenerationModel={currentImageSettings.model}
        onImageGenerationModelChange={(model: string) => updateImageSettings({ model })}
        imageEditingModel={currentImageSettings.editingModel}
        onImageEditingModelChange={(model: string) => updateImageSettings({ editingModel: model })}
        imageQuality={imageQuality}
        onImageQualityChange={updateImageQuality}
        imageStyle={currentImageSettings.style}
        onImageStyleChange={(style) => updateImageSettings({ style })}
        imageSize={currentImageSettings.size}
        onImageSizeChange={(size) => updateImageSettings({ size })}
        videoModel={videoModel}
        onVideoModelChange={(model) => updateVideoSettings({ model })}
        videoDuration={videoDuration}
        onVideoDurationChange={(duration) => updateVideoSettings({ duration })}
        videoAspectRatio={videoAspectRatio}
        onVideoAspectRatioChange={(aspectRatio) => updateVideoSettings({ aspectRatio })}
        videoBackend={videoBackend}
        onVideoBackendChange={(backend) => updateVideoSettings({ backend })}
        videoTier={videoTier}
        onVideoTierChange={(tier) => updateVideoSettings({ tier })}
        autoDetectAspectRatio={autoDetectAspectRatio}
        onAutoDetectAspectRatioChange={(autoDetectAspectRatio) => updateVideoSettings({ autoDetectAspectRatio })}
      />

      <SecureApiKeyInput
        isOpen={apiKeyRequest.isOpen}
        onClose={() => setApiKeyRequest({ isOpen: false, serverName: '' })}
        onSubmit={handleApiKeySubmit}
        serverName={apiKeyRequest.serverName}
        serverInfo={apiKeyRequest.serverInfo}
      />

      <ImageActionDialog
        isOpen={actionDialog.isOpen}
        onClose={() => setActionDialog({ isOpen: false, action: null, imageName: '' })}
        onConfirm={actionDialog.action === 'edit' ? handleEditConfirm : handleAnimateConfirm}
        action={actionDialog.action || 'edit'}
        imageName={actionDialog.imageName}
      />

      <MultiImageEditModal
        isOpen={multiImageEditModal.isOpen}
        onClose={() => setMultiImageEditModal({ isOpen: false, images: [] })}
        images={multiImageEditModal.images}
        onEditComplete={handleMultiImageEditComplete}
      />

      <FilePreviewModal
        isOpen={filePreviewModal.isOpen}
        onClose={() => setFilePreviewModal({ isOpen: false, file: { name: '', url: '', contentType: '' }, options: [] })}
        file={filePreviewModal.file}
        availableOptions={filePreviewModal.options}
        onAnalyze={(_fileName, _contentType) => handleFilePreviewOptionSelect('analyze')}
        onEdit={(url, name) => {
          // Set the file as selected and trigger edit
          const mockFile = {
            file: { name, type: filePreviewModal.file.contentType, size: 0 },
            preview: url,
            geminiFile: { uri: url }
          };
          setSelectedFile(mockFile as any);
          handleImageOptionSelect('edit');
        }}
        onAnimate={(url, name) => {
          // Set the file as selected and trigger animate
          const mockFile = {
            file: { name, type: filePreviewModal.file.contentType, size: 0 },
            preview: url,
            geminiFile: { uri: url }
          };
          setSelectedFile(mockFile as any);
          handleImageOptionSelect('animate');
        }}
      />

      <VideoGenerationModal
        open={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onGenerate={handleVideoGeneration}
        initialPrompt={videoModalConfig.prompt || ''}
        initialImage={videoModalConfig.image}
        suggestedWorkflow={videoModalConfig.suggestedWorkflow}
      />
    </div>
  )
}
