"use client"

import { useState, useEffect, useCallback, useRef, startTransition } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import ChatInterface from "@/components/chat-interface"
import CanvasView from "@/components/canvas-view"
import ResizablePanels from "@/components/resizable-panels"
import { GeneratedImage, loadGeneratedImages, saveGeneratedImages } from "@/lib/image-utils"
import { convertStoredImageToGenerated } from "@/lib/convert-image-types"
import { SettingsDebugPanel } from "@/components/settings-debug-panel"
import { GeneratedVideo } from "@/lib/video-generation-types"
import { useMCPInitialization } from "@/hooks/use-mcp-initialization"
import { AnimateImageModal } from "@/components/animate-image-modal"
import { useToast } from "@/hooks/use-toast"
import { useVideoProgressStore } from "@/lib/stores/video-progress-store"
import { useMultiVideoPolling } from "@/hooks/use-video-polling"
import { detectImageAspectRatio } from "@/lib/image-utils"
import { useChatPersistence } from "@/hooks/use-chat-persistence"
import { PersistenceNotification } from "@/components/persistence-notification"
import { addVideoToLocalStorage, loadVideosFromLocalStorage, type StoredVideo, saveVideosToLocalStorage, removeVideoFromLocalStorage } from "@/lib/video-storage"
import { deduplicateVideos, mergeVideos, updateVideo, removeVideo } from "@/lib/video-utils"
import { debugVideos } from "@/lib/debug-videos"
import { hasValidPermanentUrl, logVideoValidation } from "@/lib/video-validation"
import { addToDeletedVideos, filterOutDeletedVideos } from "@/lib/deleted-videos-tracker"
import { generateChatTitle } from "@/lib/chat-naming"
import { isPersistenceConfigured } from "@/lib/database/supabase"
import { type GeneratedAudio } from "@/components/audio-gallery"
import { loadAudios, saveAudio } from "@/lib/audio-persistence"
import { updateCanvasState } from "@/lib/services/chat-persistence"
import { useSettings } from "@/lib/contexts/settings-context"

export default function Home() {
  // Get settings from context
  const { imageSettings, updateImageSettings } = useSettings()
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([])
  const [activeCanvasTab, setActiveCanvasTab] = useState("preview")
  const [animatingImage, setAnimatingImage] = useState<GeneratedImage | null>(null)
  const [videoPollingPairs, setVideoPollingPairs] = useState<Array<{ videoId: string; predictionId: string }>>([])
  const [autoOpenEditImageId, setAutoOpenEditImageId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash")
  const [loadedMessages, setLoadedMessages] = useState<any[] | undefined>(undefined)
  const [loadedMessageAttachments, setLoadedMessageAttachments] = useState<Record<string, any[]>>({})
  const [chatLoading, setChatLoading] = useState(false)
  const [chatKey, setChatKey] = useState(0) // Add key to force chat reset
  const [canvasState, setCanvasState] = useState<any>(null)
  // Remove local state for imageEditingModel - will use SettingsContext instead

  // Removed imageEditingModel localStorage effect - handled by SettingsContext

  const { toast } = useToast()
  const { addVideo, completeVideo, failVideo, getAllGeneratingVideos } = useVideoProgressStore()

  // Chat persistence
  const {
    currentChatId,
    setCurrentChatId,
    chats,
    createNewChat,
    saveMessages,
    saveImage: saveImageToDB,
    saveVideo: saveVideoToDB,
    deleteVideo: deleteVideoFromDB,
    loadChat,
    loadAllImages,
    loadAllVideos,
    refreshChats,
    updateChatTitle,
  } = useChatPersistence()

  // Store reference to chat interface submit function
  const chatSubmitRef = useRef<((message: string) => void) | null>(null)
  const messagesRef = useRef<any[]>([])
  const lastMessageSaveTimeRef = useRef<number>(0)
  const lastSavedMessageContentRef = useRef<string>('')
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const savedImageIdsRef = useRef<Set<string>>(new Set())
  const sidebarRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Add a lock to prevent concurrent saves
  const imageSaveLockRef = useRef<Set<string>>(new Set())

  // Video generation settings (load from localStorage)
  const [videoSettings, setVideoSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('videoGenerationSettings')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    return {
      model: 'standard',
      duration: 5,
      aspectRatio: '16:9',
      autoDetectAspectRatio: true
    }
  })

  // Initialize MCP state once at the app root
  useMCPInitialization()

  // Load images from database on mount
  useEffect(() => {
    const loadPersistedImages = async () => {
      console.log('[PAGE] Starting to load persisted images...')

      const isPersistenceEnabled = isPersistenceConfigured()
      console.log('[PAGE] Persistence enabled:', isPersistenceEnabled)

      // Load from database
      const dbImages = await loadAllImages()
      console.log('[PAGE] Database images loaded:', {
        total: dbImages.length,
        edited: dbImages.filter((img: GeneratedImage) => img.originalImageId).length,
        models: [...new Set(dbImages.map((img: GeneratedImage) => img.model))],
        ids: dbImages.map((img: GeneratedImage) => ({ id: img.id, originalImageId: img.originalImageId }))
      })

      // Convert database images to proper format using the conversion function
      // This ensures all metadata fields (including multi-edit fields) are properly mapped
      const formattedDbImages = dbImages.map(convertStoredImageToGenerated);

      // Load from localStorage
      const localImages = loadGeneratedImages()
      console.log('[PAGE] LocalStorage images loaded:', {
        total: localImages.length,
        edited: localImages.filter((img: GeneratedImage) => img.originalImageId).length,
        ids: localImages.map((img: GeneratedImage) => ({ id: img.id, originalImageId: img.originalImageId }))
      })

      let finalImages: GeneratedImage[] = []

      if (isPersistenceEnabled && dbImages.length > 0) {
        // When persistence is enabled and we have database images,
        // treat database as the source of truth

        // Create a set of database image IDs for quick lookup
        const dbImageIds = new Set(formattedDbImages.map((img: GeneratedImage) => img.id))

        // Only include localStorage images that are NOT in the database
        // These are likely new images that haven't been saved yet
        const unsavedLocalImages = localImages.filter((localImg: GeneratedImage) =>
          !dbImageIds.has(localImg.id)
        )

        console.log('[PAGE] Unsaved local images:', unsavedLocalImages.length)

        // Combine database images with unsaved local images
        finalImages = [...formattedDbImages, ...unsavedLocalImages]

        // Clean up localStorage - remove images that exist in database
        const imagesToKeep = localImages.filter((img: GeneratedImage) =>
          !dbImageIds.has(img.id)
        )

        if (imagesToKeep.length !== localImages.length) {
          console.log('[PAGE] Cleaning up localStorage, removing', localImages.length - imagesToKeep.length, 'images that exist in database')
          saveGeneratedImages(imagesToKeep)
        }

        // Mark all database images as saved
        formattedDbImages.forEach((img: GeneratedImage) => {
          savedImageIdsRef.current.add(img.id)
        })

      } else if (!isPersistenceEnabled) {
        // When persistence is not enabled, use localStorage only
        finalImages = localImages
        console.log('[PAGE] Using localStorage only (persistence not configured)')

      } else {
        // Persistence is enabled but no database images - use localStorage
        finalImages = localImages
        console.log('[PAGE] No database images found, using localStorage')
      }

      console.log('[PAGE] Final images to display:', {
        total: finalImages.length,
        fromDb: dbImages.length,
        fromLocal: finalImages.length - dbImages.length
      })

      if (finalImages.length > 0) {
        setGeneratedImages(finalImages)
        console.log('[PAGE] Set generated images state with', finalImages.length, 'images')
        // Force switch to images tab to verify they're loaded
        setTimeout(() => {
          console.log('[PAGE] Switching to images tab to display loaded images')
          setActiveCanvasTab('images')
        }, 1000)
      }
    }
    loadPersistedImages()
  }, [loadAllImages])

  // Load persisted audios on mount
  useEffect(() => {
    const loadPersistedAudios = async () => {
      console.log('[PAGE] Starting to load persisted audios...')

      try {
        const persistedAudios = await loadAudios()
        console.log('[PAGE] Loaded', persistedAudios.length, 'audios from IndexedDB')

        if (persistedAudios.length > 0) {
          setGeneratedAudios(persistedAudios)
        }
      } catch (error) {
        console.error('[PAGE] Failed to load persisted audios:', error)
      }
    }
    loadPersistedAudios()
  }, [])

  // Load videos from database and local storage on mount
  useEffect(() => {
    const loadPersistedVideos = async () => {
      // Load from database first
      const dbVideos = await loadAllVideos()
      // Load from local storage as backup
      const localVideos = loadVideosFromLocalStorage()

      // Combine and deduplicate videos
      const allVideos = mergeVideos(dbVideos, localVideos)
      
      // Filter out any videos that were explicitly deleted
      const filteredVideos = filterOutDeletedVideos(allVideos)

      if (filteredVideos.length > 0) {
        console.log('[PAGE] Loaded', filteredVideos.length, 'videos (', dbVideos.length, 'from DB,', localVideos.length, 'from local)')
        if (filteredVideos.length < allVideos.length) {
          console.log('[PAGE] Filtered out', allVideos.length - filteredVideos.length, 'deleted videos')
        }
        setGeneratedVideos(filteredVideos)
      } else if (allVideos.length > 0) {
        console.log('[PAGE] All videos were filtered out as deleted')
      }
    }
    loadPersistedVideos()
  }, [loadAllVideos])

  // Clear autoOpenEditImageId after it's been used
  useEffect(() => {
    if (autoOpenEditImageId) {
      console.log('[PAGE] autoOpenEditImageId set to:', autoOpenEditImageId)
      console.log('[PAGE] Current images count:', generatedImages.length)
      console.log('[PAGE] Images:', generatedImages.map(img => ({ 
        id: img.id, 
        model: img.model, 
        isUploaded: img.isUploaded,
        prompt: img.prompt?.substring(0, 30)
      })))
      
      // Longer timeout to ensure all state updates complete
      const timer = setTimeout(() => {
        console.log('[PAGE] Clearing autoOpenEditImageId after delay')
        setAutoOpenEditImageId(null)
      }, 3000) // Increased from 1000ms to 3000ms for better reliability
      
      return () => clearTimeout(timer)
    }
  }, [autoOpenEditImageId, generatedImages.length])

  // Handle chat selection from sidebar
  const handleChatSelect = useCallback(async (chatId: string) => {
    // Prevent selecting the same chat that's already loaded
    if (currentChatId === chatId && !chatLoading) {
      console.log('[PAGE] Chat already selected:', chatId)
      return
    }
    
    console.log('[PAGE] Selecting chat:', chatId)
    setChatLoading(true)

    try {
      const chatData = await loadChat(chatId)
      if (chatData && chatData.messages) {
        console.log('[PAGE] Loaded chat data:', {
          chatId: chatData.chat.id,
          title: chatData.chat.title,
          messageCount: chatData.messages.length
        })

        // Convert database messages to chat interface format and extract attachments
        const formattedMessages = chatData.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(msg.created_at),
          // Ensure attachments are properly formatted
          experimental_attachments: msg.attachments || [],
          // Preserve any metadata in the message
          metadata: msg.metadata || {}
        }))

        // Extract attachments from messages to reconstruct messageAttachments state
        const extractedAttachments: Record<string, any[]> = {}
        chatData.messages.forEach((msg: any) => {
          if (msg.attachments && msg.attachments.length > 0) {
            // Process attachments to handle invalid blob URLs
            const processedAttachments = msg.attachments.map((attachment: any) => {
              // Check if the URL is a blob URL
              if (attachment.url && attachment.url.startsWith('blob:')) {
                console.log('[PAGE] Found blob URL in attachment, skipping:', attachment.name)
                // Return attachment without URL to prevent errors
                return {
                  ...attachment,
                  url: undefined,
                  error: 'Blob URL expired - file needs to be re-uploaded'
                }
              }
              return attachment
            })
            
            extractedAttachments[msg.id] = processedAttachments
            console.log('[PAGE] Found attachments for message:', msg.id, 'count:', processedAttachments.length)
          }
        })

        console.log('[PAGE] Extracted attachments from', Object.keys(extractedAttachments).length, 'messages')

        // Batch all state updates to prevent multiple re-renders
        startTransition(() => {
          // Load images from the chat
          if (chatData.images && chatData.images.length > 0) {
            setGeneratedImages(chatData.images)
          }

          // Load videos from the chat
          if (chatData.videos && chatData.videos.length > 0) {
            setGeneratedVideos(prev => mergeVideos(prev, chatData.videos))
          }

          // Load canvas state from the chat
          if (chatData.canvasState) {
            console.log('[PAGE] Loading canvas state:', chatData.canvasState)
            setCanvasState(chatData.canvasState)
          } else {
            setCanvasState(null)
          }

          // Set the current chat ID before setting messages
          setCurrentChatId(chatId)

          // Force chat interface to reset with new messages
          setChatKey(prev => prev + 1)

          // Set the loaded messages and attachments
          setLoadedMessages(formattedMessages)
          setLoadedMessageAttachments(extractedAttachments)
          setSelectedModel(chatData.chat.model || selectedModel)
        })

        // Check if this chat has "New Chat" title and update it
        if (chatData.chat.title === 'New Chat' && formattedMessages.length > 0) {
          console.log('[PAGE] Loaded chat has "New Chat" title, checking if we should update it')
          const userMessages = formattedMessages.filter((m: any) => m.role === 'user')

          if (userMessages.length > 0) {
            console.log('[PAGE] Found', userMessages.length, 'user messages, generating new title')
            const newTitle = generateChatTitle(userMessages.slice(-5), 50)
            console.log('[PAGE] Generated title for loaded chat:', newTitle)

            // Update the title
            const updated = await updateChatTitle(chatId, newTitle)
            if (updated) {
              console.log('[PAGE] Successfully updated loaded chat title to:', newTitle)
              await refreshChats()
            }
          }
        }
      } else {
        console.error('[PAGE] Failed to load chat data')
      }
    } catch (error) {
      console.error('[PAGE] Error loading chat:', error)
    } finally {
      setChatLoading(false)
    }
  }, [loadChat, selectedModel, setCurrentChatId, updateChatTitle, refreshChats])

  // Handle new chat creation
  const handleNewChat = useCallback(() => {
    console.log('[PAGE] Creating new chat...')
    setCurrentChatId(null)
    setLoadedMessages([]) // Set to empty array instead of undefined to force reset
    setLoadedMessageAttachments({}) // Clear loaded attachments
    setCanvasState(null) // Clear canvas state
    // Clear message refs to ensure fresh state
    messagesRef.current = []
    lastMessageSaveTimeRef.current = 0
    lastSavedMessageContentRef.current = ''
    // Force chat interface to reset by changing key
    setChatKey(prev => prev + 1)
    // Don't clear images/videos - they should persist across chat sessions
    console.log('[PAGE] New chat initiated - messages cleared, keeping persisted images and videos')
  }, [setCurrentChatId])

  // Add refs for debouncing and streaming detection
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedMessagesRef = useRef<string>('')
  const isStreamingRef = useRef<boolean>(false)
  const messageAttachmentsRef = useRef<Record<string, any[]>>({})

  // Handle messages update from ChatInterface
  const handleMessagesUpdate = useCallback(async (messages: any[], attachments?: Record<string, any[]>) => {
    messagesRef.current = messages
    
    // Update attachments ref if provided
    if (attachments) {
      messageAttachmentsRef.current = attachments
      console.log('[PAGE] Updated messageAttachments:', Object.keys(attachments).length, 'messages with attachments')
    }

    // Reduce console logging to prevent spam during streaming
    // Only log significant events
    const userMessages = messages.filter(m => m.role === 'user' && m.id !== 'welcome-message')
    if (userMessages.length === 0) {
      return
    }

    // Skip if this is just a data injection update
    const lastMessage = messages[messages.length - 1]
    const hasOnlyDataInjection = lastMessage?.content && (
      lastMessage.content.includes('[TTS_GENERATION_STARTED]') ||
      lastMessage.content.includes('[VIDEO_GENERATION_STARTED]') ||
      lastMessage.content.includes('[IMAGE_EDITING_COMPLETED]') ||
      lastMessage.content.includes('**Sources:**') ||
      lastMessage.content.includes('[Source Name](') ||
      lastMessage.content.includes('Citations:')
    )

    if (hasOnlyDataInjection) {
      console.log('[PAGE] Skipping message save - data injection detected')
      return
    }

    // Detect if AI is currently streaming based on the last message
    const isAssistantStreaming = lastMessage?.role === 'assistant' &&
      !lastMessage?.content?.includes('[DONE]') && // Some APIs send a done marker
      messages.length > 0

    // If streaming, mark it and debounce saves
    if (isAssistantStreaming) {
      isStreamingRef.current = true

      // Clear any existing save timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Set a new timeout to save after streaming stops (2 seconds of no updates)
      saveTimeoutRef.current = setTimeout(async () => {
        console.log('[PAGE] Streaming appears to have stopped, saving messages...')
        isStreamingRef.current = false
        await performMessageSave()
      }, 2000)

      return // Don't save while streaming
    }

    // If we get here and were streaming, the stream has ended
    if (isStreamingRef.current && lastMessage?.role === 'user') {
      isStreamingRef.current = false
      // Clear any pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }

    // For user messages, save immediately
    if (lastMessage?.role === 'user') {
      await performMessageSave()
    }

    // Helper function to actually save messages
    async function performMessageSave() {
      // Create a simple hash of messages to detect duplicates
      const messagesHash = JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })))

      // Skip if we've already saved these exact messages
      if (messagesHash === lastSavedMessagesRef.current) {
        console.log('[PAGE] Skipping duplicate message save')
        return
      }

      lastSavedMessagesRef.current = messagesHash

      try {
        // If we don't have a chat ID yet and this is the first user message, create a chat
        if (!currentChatId && userMessages.length >= 1) {
          console.log('[PAGE] Creating new chat for first user message')
          console.log('[PAGE] Current attachments:', messageAttachmentsRef.current)

          // Store the messages before creating the chat to preserve them
          const messagesToPreserve = [...messages]
          


          // Save messages will create the chat with a good title
          const result = await saveMessages(messages, selectedModel, messageAttachmentsRef.current)

          if (result && result.success && result.chatId) {
            console.log('[PAGE] Chat created with ID:', result.chatId)

            // Update loaded messages to preserve the current messages
            setLoadedMessages(messagesToPreserve)

            // Set the current chat ID - this will cause a re-render
            setCurrentChatId(result.chatId)

            // Refresh chats with debounce to prevent rapid updates
            // Clear any pending refresh
            if (sidebarRefreshTimeoutRef.current) {
              clearTimeout(sidebarRefreshTimeoutRef.current)
            }
            // Schedule a new refresh with a small delay
            sidebarRefreshTimeoutRef.current = setTimeout(() => {
              console.log('[PAGE] Triggering sidebar refresh')
              setSidebarRefreshKey(prev => prev + 1)
              sidebarRefreshTimeoutRef.current = null
            }, 300)
          }
        } else if (currentChatId) {
          // For existing chats, just save the messages
          console.log('[PAGE] Saving messages to existing chat:', currentChatId)
          await saveMessages(messages, selectedModel, messageAttachmentsRef.current)

          // Also refresh chats to update timestamps with debounce
          // Clear any pending refresh
          if (sidebarRefreshTimeoutRef.current) {
            clearTimeout(sidebarRefreshTimeoutRef.current)
          }
          // Schedule a new refresh with a small delay
          sidebarRefreshTimeoutRef.current = setTimeout(() => {
            setSidebarRefreshKey(prev => prev + 1)
            sidebarRefreshTimeoutRef.current = null
          }, 300)
        }
      } catch (error) {
        console.error('[PAGE] Error saving messages:', error)
      }
    }
  }, [currentChatId, selectedModel, saveMessages, refreshChats, setCurrentChatId])

  // Cleanup effect for message save timeout
  useEffect(() => {
    return () => {
      // Clear any pending save timeout on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [])

  // Track saved image and video IDs to prevent duplicates
  const savedVideoIdsRef = useRef<Set<string>>(new Set())

  // Enhanced image generation callback that saves to DB
  const handleGeneratedImagesChange = useCallback(async (images: GeneratedImage[]) => {
    // Note: We've simplified this to only accept arrays, not callbacks
    // This prevents issues with stale closures

    // Defensive programming: ensure images is always an array
    const safeImages = Array.isArray(images) ? images : []

    console.log('[DEBUG] handleGeneratedImagesChange called:', {
      imageCount: safeImages.length,
      activeTab: activeCanvasTab,
      firstImage: safeImages[0] ? {
        id: safeImages[0].id,
        isGenerating: safeImages[0].isGenerating,
        model: safeImages[0].model,
        prompt: safeImages[0].prompt?.substring(0, 50)
      } : null
    })
    console.log('[PAGE] handleGeneratedImagesChange called with', safeImages.length, 'images')

    // Only update state if images have actually changed
    setGeneratedImages(prevImages => {
      // Defensive check for prevImages
      const safePrevImages = Array.isArray(prevImages) ? prevImages : []

      // Check if the images are actually different
      const hasChanges = safeImages.length !== safePrevImages.length ||
        safeImages.some((img, index) => {
          const prevImg = safePrevImages.find(p => p.id === img.id)
          if (!prevImg) return true
          return img.url !== prevImg.url ||
                 img.isGenerating !== prevImg.isGenerating ||
                 img.prompt !== prevImg.prompt
        })

      if (!hasChanges) {
        console.log('[PAGE] No actual changes in images, skipping state update')
        return safePrevImages
      }

      return safeImages
    })

    // Switch to images tab when new images are generated
    if (safeImages.length > 0) {
      console.log('[PAGE] Switching to images tab to show new images')
      setActiveCanvasTab('images')
      
      // Save to localStorage for persistence when database is not configured
      // or as a backup for database-saved images
      saveGeneratedImages(safeImages)
      console.log('[PAGE] Saved images to localStorage')
    }

    // Clean up savedImageIdsRef by removing IDs that are no longer in the images array
    const currentImageIds = new Set(safeImages.map(img => img.id))
    savedImageIdsRef.current.forEach(savedId => {
      if (!currentImageIds.has(savedId)) {
        console.log('[PAGE] Removing deleted image from saved set:', savedId)
        savedImageIdsRef.current.delete(savedId)
      }
    })

    // Save all new images to database (not just the last one)
    for (const image of safeImages) {
      // Debug logging
      console.log('[PAGE] Processing image for save:', {
        id: image.id,
        isGenerating: image.isGenerating,
        originalImageId: image.originalImageId,
        isEdited: !!image.originalImageId,
        alreadySaved: savedImageIdsRef.current.has(image.id),
        isLocked: imageSaveLockRef.current.has(image.id)
      })

      // Save if: image is complete OR it's an edited image (even if marked as generating)
      if (image && (!image.isGenerating || image.originalImageId)) {
        // Check if we've already saved this image to prevent duplicates
        if (savedImageIdsRef.current.has(image.id)) {
          console.log('[PAGE] Image already saved, skipping:', image.id)
          continue
        }
        
        // Check if this image is currently being saved (prevent concurrent saves)
        if (imageSaveLockRef.current.has(image.id)) {
          console.log('[PAGE] Image save already in progress, skipping:', image.id)
          continue
        }

        // Skip saving if this image already has a database ID (UUID format)
        // This prevents duplicate saves when images come from chat notifications
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(image.id)
        if (isUUID) {
          console.log('[PAGE] Image already has database ID, skipping save:', image.id)
          savedImageIdsRef.current.add(image.id) // Mark as processed to prevent future attempts
          continue
        }

        console.log('[PAGE] Saving image to database:', {
          id: image.id,
          model: image.model,
          isUploaded: image.isUploaded,
          isGenerating: image.isGenerating,
          originalImageId: image.originalImageId,
          prompt: image.prompt
        })

        // Lock this image to prevent concurrent saves
        imageSaveLockRef.current.add(image.id)
        
        // Mark as saved before the async operation to prevent race conditions
        savedImageIdsRef.current.add(image.id)

        const saved = await saveImageToDB(image)
        
        // Release the lock
        imageSaveLockRef.current.delete(image.id)
        
        if (saved) {
          console.log('[PAGE] Image saved successfully:', image.id, 'DB ID:', saved.id)

          // If this was an edited image with a data URL, update it with the blob URL
          if (image.url.startsWith('data:') && saved.url && !saved.url.startsWith('data:')) {
            console.log('[PAGE] Updating edited image with blob URL from database')
            setGeneratedImages(prev => {
              const safePrev = Array.isArray(prev) ? prev : []
              return safePrev.map(img =>
                img.id === image.id ? { ...img, url: saved.url } : img
              )
            })
          }
        } else {
          console.log('[PAGE] Failed to save image:', image.id)
          // Remove from saved set if save failed
          savedImageIdsRef.current.delete(image.id)
        }
      } else {
        console.log('[PAGE] Skipping image save (still generating):', {
          id: image.id,
          isGenerating: image.isGenerating
        })
      }
    }
  }, [saveImageToDB])

  // Enhanced video generation callback that saves to DB
  const handleGeneratedVideosChange = useCallback(async (videos: GeneratedVideo[]) => {
    console.log('[PAGE] handleGeneratedVideosChange called with', videos.length, 'videos')
    
    // Deduplicate videos before setting state
    const dedupedVideos = deduplicateVideos(videos)
    setGeneratedVideos(dedupedVideos)
    
    // Only save to localStorage videos with valid URLs
    saveVideosToLocalStorage(dedupedVideos)
    
    // Debug logging
    if (dedupedVideos.length > 0) {
      debugVideos(dedupedVideos)
      logVideoValidation(dedupedVideos)
    }

    // Save all new completed videos to database (not just the last one)
    for (const video of videos) {
      if (video && video.status === 'completed' && !video.url.startsWith('blob:')) {
        // Check if we've already saved this video to prevent duplicates
        if (savedVideoIdsRef.current.has(video.id)) {
          continue
        }

        console.log('[PAGE] Saving video to database:', {
          id: video.id,
          model: video.model,
          status: video.status,
          prompt: video.prompt,
          duration: video.duration
        })

        // Mark as saved before the async operation to prevent race conditions
        savedVideoIdsRef.current.add(video.id)

        const saved = await saveVideoToDB(video)
        if (saved) {
          console.log('[PAGE] Video saved successfully:', video.id)
        } else {
          console.log('[PAGE] Failed to save video:', video.id)
          // Remove from saved set if save failed
          savedVideoIdsRef.current.delete(video.id)
        }
      }
    }
  }, [saveVideoToDB])

  // Debounced auto tab switching with toast notification
  const lastSwitchTimeRef = useRef<number>(0)
  const switchToVideoTab = useCallback((reason: string) => {
    const now = Date.now()

    // Prevent multiple switches within 2 seconds
    if (now - lastSwitchTimeRef.current < 2000) {
      console.log(`[PAGE] Debouncing tab switch request: ${reason}`)
      return
    }

    // Only switch if we're not already on video tab
    if (activeCanvasTab === "video") {
      console.log(`[PAGE] Already on video tab, skipping switch: ${reason}`)
      return
    }

    lastSwitchTimeRef.current = now
    console.log(`[PAGE] Switching to video tab: ${reason}`)
    setActiveCanvasTab("video")

    toast({
      title: "Switched to Video tab",
      description: reason,
      duration: 3000
    })
  }, [toast, activeCanvasTab])

  // Enhanced video completion handler with database persistence
  const handleVideoComplete = useCallback(async (completedVideo: GeneratedVideo) => {
    console.log('[PAGE] Video generation completed:', completedVideo.id, 'URL:', completedVideo.url)

    // Validate that the video has a permanent URL
    if (!hasValidPermanentUrl(completedVideo)) {
      console.error('[PAGE] Completed video has invalid URL:', completedVideo.url)
      toast({
        title: "Video generation issue",
        description: "The video was generated but the URL is invalid. Please try again.",
        variant: "destructive",
        duration: 7000
      })
      
      // Mark as failed in the UI
      setGeneratedVideos(prev => updateVideo(prev, completedVideo.id, { 
        status: 'failed' as const, 
        error: 'Invalid video URL received' 
      }))
      return
    }

    // Add completion timestamp
    const completedVideoWithTimestamp = {
      ...completedVideo,
      status: 'completed' as const,
      completedAt: new Date()
    }

    // Update the video in the list
    setGeneratedVideos(prev => updateVideo(prev, completedVideo.id, completedVideoWithTimestamp))

    // Remove from polling pairs
    setVideoPollingPairs(prev => prev.filter(pair => pair.videoId !== completedVideo.id))

    // Save completed video to database and local storage
    if (!savedVideoIdsRef.current.has(completedVideo.id)) {
      console.log('[PAGE] Saving completed video:', completedVideo.id)
      savedVideoIdsRef.current.add(completedVideo.id)

      // Save to database
      const saved = await saveVideoToDB(completedVideoWithTimestamp)
      if (saved) {
        console.log('[PAGE] Video saved to database successfully:', completedVideo.id)
      } else {
        console.log('[PAGE] Failed to save video to database:', completedVideo.id)
      }

      // Always save to local storage as backup
      const storedVideo: StoredVideo = {
        ...completedVideoWithTimestamp,
        chatId: currentChatId || undefined
      }
      const localSaved = addVideoToLocalStorage(storedVideo)
      if (localSaved) {
        console.log('[PAGE] Video saved to local storage successfully:', completedVideo.id)
      } else {
        console.log('[PAGE] Failed to save video to local storage:', completedVideo.id)
      }

      // Only remove from saved set if both saves failed
      if (!saved && !localSaved) {
        savedVideoIdsRef.current.delete(completedVideo.id)
      }
    }

    // Show success notification
    toast({
      title: "Video generated!",
      description: `"${completedVideo.prompt}" is ready to view.`,
      duration: 5000
    })

    // Update browser tab title
    if (typeof window !== 'undefined') {
      document.title = "✅ Video Ready - Gemini Chatbot"
      setTimeout(() => {
        document.title = "Gemini Chatbot"
      }, 3000)
    }
  }, [toast, saveVideoToDB])

  // Enhanced video error handler
  const handleVideoError = useCallback((videoId: string, error: string) => {
    console.log('[PAGE] Video generation failed:', videoId, error)

    // Update the video in the list
    setGeneratedVideos(prev => updateVideo(prev, videoId, { status: 'failed' as const, error }))

    // Remove from polling pairs
    setVideoPollingPairs(prev => prev.filter(pair => pair.videoId !== videoId))

    // Show error notification
    toast({
      title: "Video generation failed",
      description: error,
      variant: "destructive",
      duration: 7000
    })
  }, [toast])

  // Setup multi-video polling
  useMultiVideoPolling(videoPollingPairs, {
    onComplete: handleVideoComplete,
    onError: handleVideoError,
    pollInterval: 8000,
    maxPollTime: 600000 // 10 minutes
  })

  // Update browser tab title with progress
  useEffect(() => {
    const generatingVideos = getAllGeneratingVideos()

    if (generatingVideos.length > 0) {
      const avgProgress = Math.round(
        generatingVideos.reduce((sum, video) => sum + video.progress, 0) / generatingVideos.length
      )
      document.title = `🎬 ${avgProgress}% - Generating ${generatingVideos.length} video${generatingVideos.length > 1 ? 's' : ''}`
    } else {
      document.title = "Gemini Chatbot"
    }
  }, [getAllGeneratingVideos])

  // Cleanup effect for sidebar refresh timeout
  useEffect(() => {
    return () => {
      if (sidebarRefreshTimeoutRef.current) {
        clearTimeout(sidebarRefreshTimeoutRef.current)
      }
    }
  }, [])

  // Handle animate image action
  const handleAnimateImage = useCallback((imageUrlOrImage: string | GeneratedImage, imageName?: string) => {
    // Handle both formats - from chat interface (url, name) and from image gallery (GeneratedImage)
    if (typeof imageUrlOrImage === 'string') {
      // From chat interface - create a GeneratedImage object
      if (!imageUrlOrImage || imageUrlOrImage.trim() === '') {
        console.error('[PAGE] Cannot animate image: URL is empty')
        toast({
          title: "Cannot animate image",
          description: "Image URL is missing or invalid",
          variant: "destructive",
          duration: 3000
        })
        return
      }
      setAnimatingImage({
        id: `img-${Date.now()}`,
        url: imageUrlOrImage,
        prompt: imageName || 'Animated image',
        timestamp: new Date(),
        quality: 'hd',
        size: '1024x1024',
        model: 'gpt-image-1'
      })
    } else {
      // From image gallery - validate the GeneratedImage has a URL
      if (!imageUrlOrImage.url || imageUrlOrImage.url.trim() === '') {
        console.error('[PAGE] Cannot animate image: GeneratedImage has no URL', imageUrlOrImage)
        toast({
          title: "Cannot animate image",
          description: "This image cannot be animated because it has no valid URL",
          variant: "destructive",
          duration: 3000
        })
        return
      }
      // Ensure the image is not still generating
      if (imageUrlOrImage.isGenerating) {
        console.error('[PAGE] Cannot animate image: Image is still generating')
        toast({
          title: "Image still generating",
          description: "Please wait for the image to finish generating before animating",
          variant: "destructive",
          duration: 3000
        })
        return
      }
      setAnimatingImage(imageUrlOrImage)
    }
    switchToVideoTab("Ready to animate your image")
  }, [switchToVideoTab, toast])

  // Enhanced video animation handler
  const handleAnimate = useCallback(async (params: {
    prompt: string
    duration: 5 | 10
    aspectRatio: "16:9" | "9:16" | "1:1"
    negativePrompt?: string
    model?: 'standard' | 'pro'
  }) => {
    if (!animatingImage) return

    try {
      // Create a new video entry with generating status
      const newVideo: GeneratedVideo = {
        id: `video-${Date.now()}`,
        prompt: params.prompt,
        url: '',
        duration: params.duration,
        aspectRatio: params.aspectRatio,
        model: params.model || videoSettings.model,
        sourceImage: animatingImage.url,
        status: 'generating',
        createdAt: new Date()
      }

      // Add video to list immediately
      setGeneratedVideos(prev => [...prev, newVideo])
      setAnimatingImage(null)

      // Switch to video tab
      switchToVideoTab("Video generation started")

      // Add to progress store with duration for better time estimation
      addVideo(newVideo.id, params.prompt, params.duration)

      // Call the API with progress tracking enabled
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          duration: params.duration,
          aspectRatio: params.aspectRatio,
          negativePrompt: params.negativePrompt,
          startImage: animatingImage.url,
          model: params.model || videoSettings.model,
          enableProgressTracking: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start video generation')
      }

      const result = await response.json()
      console.log('[PAGE] Video generation API response:', result)

      // Handle immediate completion (rare, but possible)
      if (result.status === 'succeeded' && result.url) {
        handleVideoComplete({
          ...newVideo,
          url: result.url,
          status: 'completed'
        })
        return
      }

      // Handle prediction-based generation (most common)
      if (result.enablePolling && result.predictionId) {
        console.log('[PAGE] Starting polling for video:', newVideo.id, 'prediction:', result.predictionId)

        // Add to polling pairs for real-time progress tracking
        setVideoPollingPairs(prev => [...prev, {
          videoId: newVideo.id,
          predictionId: result.predictionId
        }])
      } else {
        // Handle any other status
        console.warn('[PAGE] Unexpected API response format:', result)
        failVideo(newVideo.id, 'Unexpected response from video generation API')
      }

    } catch (error) {
      console.error('[PAGE] Video generation error:', error)

      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"

      // Update video status
      setGeneratedVideos(prev => prev.map(v =>
        v.id.startsWith('video-') && v.status === 'generating'
          ? { ...v, status: 'failed' as const, error: errorMessage }
          : v
      ))

      toast({
        title: "Failed to start video generation",
        description: errorMessage,
        variant: "destructive",
        duration: 7000
      })
    }
  }, [animatingImage, videoSettings, switchToVideoTab, addVideo, handleVideoComplete, failVideo, toast])

  // Handle video deletion
  const handleVideoDelete = useCallback(async (videoId: string) => {
    console.log('[PAGE] Deleting video:', videoId)
    
    // Add to deleted videos tracker FIRST
    addToDeletedVideos(videoId)
    
    // Remove from state WITHOUT triggering handleGeneratedVideosChange
    setGeneratedVideos(prev => {
      const updated = prev.filter(v => v.id !== videoId)
      console.log('[PAGE] Videos after removal:', updated.length, 'remaining')
      
      // Save directly to localStorage to avoid re-save
      saveVideosToLocalStorage(updated)
      
      return updated
    })

    // Remove from database
    try {
      const dbRemoved = await deleteVideoFromDB(videoId)
      console.log('[PAGE] Removed from database:', dbRemoved)
    } catch (error) {
      console.error('[PAGE] Failed to remove from database:', error)
    }

    toast({
      title: "Video deleted",
      description: "The video has been removed.",
      duration: 3000
    })
  }, [deleteVideoFromDB, toast])

  // Handle video cancellation
  const handleCancelVideo = useCallback(async (videoId: string) => {
    console.log('[PAGE] Canceling video generation:', videoId)

    // Find the prediction ID
    const pollingPair = videoPollingPairs.find(pair => pair.videoId === videoId)

    if (pollingPair) {
      try {
        // Cancel the prediction on Replicate (if supported)
        // For now, we'll just stop polling and mark as failed
        setVideoPollingPairs(prev => prev.filter(pair => pair.videoId !== videoId))
        failVideo(videoId, 'Canceled by user')

        // Update video status
        setGeneratedVideos(prev => updateVideo(prev, videoId, { status: 'failed' as const, error: 'Canceled by user' }))

        toast({
          title: "Video generation canceled",
          description: "The video generation has been stopped.",
          duration: 3000
        })
      } catch (error) {
        console.error('[PAGE] Error canceling video:', error)
      }
    }
  }, [videoPollingPairs, failVideo, toast])

  // Handle audio generation start
  const handleAudioGenerationStart = useCallback((prompt: string, voiceName?: string, estimatedDuration?: string) => {
    console.log('[PAGE] Starting audio generation:', prompt)

    const generatingAudio: GeneratedAudio = {
      id: `audio-${Date.now()}`,
      text: prompt,
      audioBase64: '', // Empty while generating
      mimeType: 'audio/mpeg',
      timestamp: Date.now(),
      voiceName: voiceName || 'Eva',
      isGenerating: true,
      estimatedDuration: estimatedDuration,
      progress: 0,
      provider: 'wavespeed'
    }

    setGeneratedAudios(prev => {
      // Remove any existing placeholders/generating audios
      const withoutPlaceholders = prev.filter(a => !a.isGenerating)
      return [...withoutPlaceholders, generatingAudio]
    })

    // Switch to audio tab to show progress
    setActiveCanvasTab("audio")

    return generatingAudio.id
  }, [])

  // Handle generated audio changes (completed audio)
  const handleGeneratedAudioChange = useCallback((audio: GeneratedAudio) => {
    console.log('[PAGE] Audio generation completed:', {
      id: audio.id,
      voiceName: audio.voiceName,
      hasAudioBase64: !!audio.audioBase64,
      audioBase64Length: audio.audioBase64?.length || 0,
      mimeType: audio.mimeType
    })

    // Check if this is replacing a generating audio or adding a new one
    setGeneratedAudios(prev => {
      // Log current state
      console.log('[PAGE] Current audios:', prev.map(a => ({
        id: a.id,
        isGenerating: a.isGenerating,
        text: a.text?.substring(0, 50)
      })))

      // Find any generating audio (we should only have one at a time)
      const generatingIndex = prev.findIndex(a => a.isGenerating)

      if (generatingIndex >= 0) {
        // Replace the generating audio with the completed one
        console.log('[PAGE] Replacing placeholder audio at index:', generatingIndex)
        const updated = [...prev]
        updated[generatingIndex] = {
          ...audio,
          isGenerating: false
        }
        return updated
      } else {
        // Add as new audio
        console.log('[PAGE] Adding new audio (no placeholder found)')
        return [...prev, audio]
      }
    })

    // Save audio to IndexedDB
    saveAudio(audio).then(success => {
      if (success) {
        console.log('[PAGE] Audio saved to IndexedDB')
      } else {
        console.warn('[PAGE] Failed to save audio to IndexedDB')
      }
    })

    // Show success notification
    toast({
      title: "Audio generated!",
      description: "Your text-to-speech audio is ready to play.",
      duration: 3000
    })
  }, [toast])

  // Handle audio progress updates
  const handleAudioProgressUpdate = useCallback((audioId: string, progress: number) => {
    setGeneratedAudios(prev => prev.map(audio =>
      audio.id === audioId ? { ...audio, progress } : audio
    ))
  }, [])

  // Handle canvas state changes
  const handleCanvasStateChange = useCallback(async (newCanvasState: any) => {
    console.log('[PAGE] Canvas state changed:', newCanvasState)
    setCanvasState(newCanvasState)
    
    // Save to database if we have a current chat
    if (currentChatId && isPersistenceConfigured()) {
      try {
        const success = await updateCanvasState(currentChatId, newCanvasState)
        if (success) {
          console.log('[PAGE] Canvas state saved to database')
        } else {
          console.error('[PAGE] Failed to save canvas state')
        }
      } catch (error) {
        console.error('[PAGE] Error saving canvas state:', error)
      }
    }
  }, [currentChatId])


  return (
    <main className="h-screen bg-[#1E1E1E]">
      <PersistenceNotification />
      <AppSidebar
        currentChatId={currentChatId}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        refreshKey={sidebarRefreshKey}
      />
      <div className="pl-[3.05rem] h-full">
        <ResizablePanels
          leftPanel={
            <ChatInterface
              key={`chat-${chatKey}`}
              onGeneratedImagesChange={handleGeneratedImagesChange}
              generatedImages={generatedImages}
              onImageGenerationStart={() => setActiveCanvasTab("images")}
              onAnimateImage={handleAnimateImage}
              onGeneratedVideosChange={handleGeneratedVideosChange}
              onVideoGenerationStart={() => {
                switchToVideoTab("Video generation started from chat")
              }}
              generatedVideos={generatedVideos}
              onGeneratedAudioChange={handleGeneratedAudioChange}
              onAudioGenerationStart={handleAudioGenerationStart}
              onEditImageRequested={setAutoOpenEditImageId}
              onChatSubmitRef={(submitFn) => { chatSubmitRef.current = submitFn }}
              onMessagesChange={handleMessagesUpdate}
              onModelChange={setSelectedModel}
              selectedModel={selectedModel}
              initialMessages={loadedMessages}
              initialMessageAttachments={loadedMessageAttachments}
              chatId={currentChatId}
              onResetChat={() => {
                setLoadedMessages(undefined)
                setLoadedMessageAttachments({})
              }}
              onImageEditingModelChange={(model) => updateImageSettings({ editingModel: model })}
              initialImageEditingModel={imageSettings.editingModel}
            />
          }
          rightPanel={
            <CanvasView
              generatedImages={generatedImages}
              onImagesChange={handleGeneratedImagesChange}
              generatedVideos={generatedVideos}
              onVideosChange={handleGeneratedVideosChange}
              generatedAudios={generatedAudios}
              onAudiosChange={setGeneratedAudios}
              onAnimateImage={handleAnimateImage}
              activeTab={activeCanvasTab}
              onTabChange={setActiveCanvasTab}
              onCancelVideo={handleCancelVideo}
              onVideoDelete={handleVideoDelete}
              autoOpenEditImageId={autoOpenEditImageId}
              imageEditingModel={imageSettings.editingModel}
              chatId={currentChatId}
              canvasState={canvasState}
              onCanvasStateChange={handleCanvasStateChange}
            />
          }
          defaultLeftWidth={600}
          minLeftWidth={360}
          maxLeftWidth={800}
        />
      </div>

      {/* Animate Image Modal */}
      <AnimateImageModal
        isOpen={!!animatingImage}
        onClose={() => setAnimatingImage(null)}
        imageUrl={animatingImage?.url || ''}
        imageName={animatingImage?.prompt}
        onAnimate={handleAnimate}
        defaultModel={videoSettings.model}
        defaultDuration={videoSettings.duration}
        defaultAspectRatio={videoSettings.aspectRatio}
        enableAutoDetection={videoSettings.autoDetectAspectRatio}
      />
    </main>
  )
}
