"use client"

import type React from "react"

import { ArrowRight, Bot, Check, ChevronDown, Paperclip, Square, X, FileAudio, Image as ImageIcon, Video, Sparkles, Wand2, RotateCcw, RotateCw, RefreshCw, Microscope } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useRef, useCallback, useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatFileSize, formatDuration, formatVideoDuration } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MCPToolsPopup } from "@/components/mcp/mcp-tools-popup"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
  onEnhancedChange?: (isEnhanced: boolean) => void
}

function useAutoResizeTextarea({ minHeight, maxHeight, onEnhancedChange }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean, options?: { expand?: boolean; preserveHeight?: boolean }) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        // Reset to non-enhanced mode
        onEnhancedChange?.(false)
        return
      }

      // If preserveHeight is true, don't change the current height
      if (options?.preserveHeight) {
        return
      }

      // If expand is explicitly true, ignore maxHeight and expand to fit full content
      if (options?.expand === true) {
        console.log('[Height Adjustment] Expanding text area for enhanced content')
        textarea.style.height = `${minHeight}px`

        // Use a higher limit for enhanced content (800px) to show full enhanced prompts
        const enhancedMaxHeight = 800
        const expandedHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, enhancedMaxHeight))

        console.log('[Height Adjustment] Expansion details:', {
          scrollHeight: textarea.scrollHeight,
          enhancedMaxHeight,
          expandedHeight,
          currentHeight: textarea.style.height
        })

        textarea.style.height = `${expandedHeight}px`

        // Notify that we're in enhanced mode
        onEnhancedChange?.(true)
        return
      }

      // If expand is explicitly false, maintain a reasonable height without auto-expansion
      if (options?.expand === false) {
        const currentHeight = parseInt(textarea.style.height) || minHeight
        const reasonableHeight = Math.min(currentHeight, minHeight + 100) // Allow some growth but limit it
        textarea.style.height = `${reasonableHeight}px`

        // Notify that we're no longer in enhanced mode
        onEnhancedChange?.(false)
        return
      }

      // Default behavior: auto-resize to fit content with normal maxHeight
      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY))
      textarea.style.height = `${newHeight}px`

      // Notify that we're in normal (non-enhanced) mode
      onEnhancedChange?.(false)
    },
    [minHeight, maxHeight, onEnhancedChange],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

const OPENAI_ICON = (
  <>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 256 260"
      aria-label="OpenAI Icon"
      className="w-4 h-4"
    >
      <title>OpenAI Icon</title>
      <path
        fill="#FFFFFF"
        d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.530c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"
      />
    </svg>
  </>
)

interface AIPromptProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e?: React.FormEvent) => void
  onStop?: () => void
  disabled?: boolean
  selectedModel?: string
  onModelChange?: (model: string) => void
  onFileSelect?: (file: File) => void
  onFilesSelect?: (files: File[]) => void
  selectedFile?: {
    file: File
    preview?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
    }
    videoThumbnail?: string // Add this
    videoDuration?: number // Add this
  } | null
  selectedFiles?: Array<{
    file: File
    preview?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
    }
    videoThumbnail?: string
    videoDuration?: number
  }>
  onFileRemove?: () => void
  onFilesRemove?: (index: number) => void
  onAllFilesRemove?: () => void
  onGenerateImage?: () => void // Add this for quick image generation
  onToolToggle?: (serverId: string, toolName: string, enabled: boolean) => void
  onServerToggle?: (serverId: string, enabled: boolean) => void
  onPaste?: (e: React.ClipboardEvent) => void
  placeholder?: string
  onFileClick?: (file: { file: File; preview?: string }, index?: number) => void
  onEnhancePrompt?: (originalPrompt: string, enhancedPrompt: string) => void
  onDeepResearch?: () => void
  isDeepResearchMode?: boolean
}

export function AI_Prompt({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled = false,
  selectedModel = "gemini-2.0-flash",
  onModelChange,
  onFileSelect,
  onFilesSelect,
  selectedFile,
  selectedFiles,
  onFileRemove,
  onFilesRemove,
  onAllFilesRemove,
  onGenerateImage,
  onToolToggle,
  onServerToggle,
  onPaste,
  placeholder,
  onFileClick,
  onEnhancePrompt,
  onDeepResearch,
  isDeepResearchMode,
}: AIPromptProps) {
  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)

  // Enhancement state
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [hasEnhanced, setHasEnhanced] = useState(false)
  const [isProgrammaticUpdate, setIsProgrammaticUpdate] = useState(false)
  const [isEnhanced, setIsEnhanced] = useState(false)

  // Hooks that depend on state
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 80,
    maxHeight: 500,
    onEnhancedChange: setIsEnhanced,
  })
  const { toast } = useToast()

  const AI_MODELS = ["gemini-2.0-flash", "gemini-2.5-pro-preview-06-05", "gemini-2.5-flash-preview-05-20", "Claude Sonnet 4"]

  const MODEL_ICONS: Record<string, React.ReactNode> = {
    "Claude Opus 4": (
      <>
        <svg
          fill="#FFFFFF"
          fillRule="evenodd"
          className="w-4 h-4"
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
      </>
    ),
    "Claude Sonnet 4": (
      <>
        <svg
          fill="#FFFFFF"
          fillRule="evenodd"
          className="w-4 h-4"
          viewBox="0 0 24 24"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Anthropic Icon</title>
          <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
        </svg>
      </>
    ),
    "gemini-2.5-flash-preview-05-20": (
      <svg height="1em" className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>Gemini</title>
        <defs>
          <linearGradient id="lobe-icons-gemini-fill" x1="0%" x2="68.73%" y1="100%" y2="30.395%">
            <stop offset="0%" stopColor="#1C7DFF" />
            <stop offset="52.021%" stopColor="#1C69FF" />
            <stop offset="100%" stopColor="#F0DCD6" />
          </linearGradient>
        </defs>
        <path
          d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
          fill="url(#lobe-icons-gemini-fill)"
          fillRule="nonzero"
        />
      </svg>
    ),
    "gemini-2.5-pro-preview-06-05": (
      <svg height="1em" className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>Gemini</title>
        <defs>
          <linearGradient id="lobe-icons-gemini-fill-pro" x1="0%" x2="68.73%" y1="100%" y2="30.395%">
            <stop offset="0%" stopColor="#1C7DFF" />
            <stop offset="52.021%" stopColor="#1C69FF" />
            <stop offset="100%" stopColor="#F0DCD6" />
          </linearGradient>
        </defs>
        <path
          d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
          fill="url(#lobe-icons-gemini-fill-pro)"
          fillRule="nonzero"
        />
      </svg>
    ),
    "gemini-2.0-flash": (
      <svg height="1em" className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <title>Gemini</title>
        <defs>
          <linearGradient id="lobe-icons-gemini-fill-flash" x1="0%" x2="68.73%" y1="100%" y2="30.395%">
            <stop offset="0%" stopColor="#1C7DFF" />
            <stop offset="52.021%" stopColor="#1C69FF" />
            <stop offset="100%" stopColor="#F0DCD6" />
          </linearGradient>
        </defs>
        <path
          d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12"
          fill="url(#lobe-icons-gemini-fill-flash)"
          fillRule="nonzero"
        />
      </svg>
    ),
    "GPT-4o": OPENAI_ICON,
    "GPT-4o Mini": OPENAI_ICON,
  }

  // Add to history
  const addToHistory = useCallback((text: string) => {
    console.log('[Prompt Enhancer] Adding to history:', {
      text: text.substring(0, 50) + '...',
      currentHistoryLength: history.length,
      currentHistoryIndex: historyIndex
    })

    // Validate input
    if (!text || typeof text !== 'string') {
      console.error('[Prompt Enhancer] Cannot add invalid text to history:', text)
      return
    }

    if (text.trim().length === 0) {
      console.error('[Prompt Enhancer] Cannot add empty text to history')
      return
    }

    try {
      // Ensure history is a valid array
      const currentHistory = Array.isArray(history) ? history : []

      // Create new history based on current position
      const newHistory = historyIndex >= 0 && historyIndex < currentHistory.length
        ? currentHistory.slice(0, historyIndex + 1)
        : [...currentHistory]

      newHistory.push(text)

      console.log('[Prompt Enhancer] History updated:', {
        oldLength: currentHistory.length,
        newLength: newHistory.length,
        newIndex: newHistory.length - 1
      })

      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      setHasEnhanced(true)
    } catch (error) {
      console.error('[Prompt Enhancer] Error adding to history:', error)
    }
  }, [history, historyIndex])

  // Initialize history with current value
  useEffect(() => {
    console.log('[Prompt Enhancer] History initialization check:', {
      hasValue: !!value,
      valueLength: value?.length || 0,
      historyLength: history.length,
      historyIndex,
      shouldInitialize: value && history.length === 0
    })

    // Initialize history when we have a value but no history
    if (value && value.trim().length > 0 && history.length === 0) {
      console.log('[Prompt Enhancer] Initializing history with value:', value.substring(0, 50) + '...')

      try {
        setHistory([value.trim()])
        setHistoryIndex(0)
        console.log('[Prompt Enhancer] History initialized successfully')
      } catch (error) {
        console.error('[Prompt Enhancer] Error initializing history:', error)
      }
    }
  }, [value, history.length, historyIndex])

  // Define handleEnhancePrompt early so it can be used in handleKeyDown
  const handleEnhancePrompt = useCallback(async (regenerate = false) => {
    console.log('[Prompt Enhancer] Starting enhancement:', {
      value: value.trim(),
      regenerate,
      isEnhancing,
      disabled,
      selectedModel,
      valueLength: value.trim().length
    })

    if (!value.trim() || isEnhancing || disabled || value.trim().length < 2) {
      console.log('[Prompt Enhancer] Enhancement blocked:', {
        noValue: !value.trim(),
        isEnhancing,
        disabled,
        tooShort: value.trim().length < 2
      })

      // Provide user feedback for why enhancement is blocked
      if (toast && !isEnhancing && !disabled) {
        if (!value.trim()) {
          toast({
            title: "Cannot Enhance",
            description: "Please enter a prompt first",
            variant: "destructive",
            duration: 2000,
          })
        } else if (value.trim().length < 2) {
          toast({
            title: "Cannot Enhance",
            description: "Prompt must be at least 2 characters long",
            variant: "destructive",
            duration: 2000,
          })
        }
      }
      return
    }

    setIsEnhancing(true)
    if (!regenerate && !hasEnhanced) {
      setOriginalPrompt(value.trim())
    }

    // For regenerate, always use the original prompt from history if available
    // For regular enhance, use the current value
    const promptToEnhance = regenerate && history.length > 0 && history[0]
      ? history[0]
      : value.trim()

    console.log('[Prompt Enhancer] Sending request:', {
      promptToEnhance,
      model: selectedModel || 'gemini',
      context: 'chat',
      regenerate
    })

    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptToEnhance,
          model: selectedModel || 'gemini',
          context: 'chat',
          regenerate: regenerate
        }),
      })

      console.log('[Prompt Enhancer] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Prompt Enhancer] HTTP error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
      }

      const data = await response.json()
      console.log('[Prompt Enhancer] Response data:', data)

      if (data.success && data.enhancedPrompt) {
        console.log('[Prompt Enhancer] Enhancement successful:', {
          original: data.originalPrompt,
          enhanced: data.enhancedPrompt,
          model: data.model
        })

        // Mark as programmatic update to prevent conflicting adjustHeight calls
        setIsProgrammaticUpdate(true)

        onChange(data.enhancedPrompt)
        addToHistory(data.enhancedPrompt)
        onEnhancePrompt?.(data.originalPrompt, data.enhancedPrompt)

        // Use setTimeout to ensure DOM has updated before adjusting height
        setTimeout(() => {
          console.log('[Prompt Enhancer] Expanding text area after enhancement')
          adjustHeight(false, { expand: true })
          setIsProgrammaticUpdate(false)
        }, 0)

        // Show success feedback with enhanced prompt preview
        if (toast) {
          const previewText = data.enhancedPrompt.length > 100
            ? data.enhancedPrompt.substring(0, 100) + '...'
            : data.enhancedPrompt

          const title = regenerate
            ? "🔄 New Enhancement Generated"
            : "✨ Prompt Enhanced"

          const description = regenerate
            ? `Generated new variation with ${data.model || selectedModel || 'Gemini'}${data.fallback ? ' (fallback)' : ''}`
            : `Enhanced with ${data.model || selectedModel || 'Gemini'}${data.fallback ? ' (fallback)' : ''}`

          console.log('[Prompt Enhancer] Showing success toast:', { title, description })
          toast({
            title,
            description,
            duration: 3000,
          })
        } else {
          console.error('[Prompt Enhancer] Toast function not available for success message')
        }
      } else {
        console.error('[Prompt Enhancer] Enhancement failed:', data)
        throw new Error(data.error || data.details || 'Failed to enhance prompt - no enhanced text returned')
      }
    } catch (error) {
      console.error('[Prompt Enhancer] Error enhancing prompt:', error)

      let errorMessage = regenerate ? 'Failed to regenerate enhancement' : 'Failed to enhance prompt'
      let errorTitle = regenerate ? "🔄 Regeneration Failed" : "❌ Enhancement Failed"

      if (error instanceof Error) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          errorMessage = 'Network error - check your connection'
        } else if (error.message.includes('HTTP 401')) {
          errorMessage = 'Authentication error - check API keys'
        } else if (error.message.includes('HTTP 429')) {
          errorMessage = 'Rate limit exceeded - try again later'
        } else if (error.message.includes('HTTP 500')) {
          errorMessage = 'Server error - try again or use a different model'
        } else {
          errorMessage = error.message
        }
      }

      if (toast) {
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        })
      } else {
        // Fallback alert if toast is not available
        console.error('[Prompt Enhancer] Toast not available, using alert:', errorTitle, errorMessage)
        alert(`${errorTitle}: ${errorMessage}`)
      }
    } finally {
      console.log('[Prompt Enhancer] Enhancement finished, setting isEnhancing to false')
      setIsEnhancing(false)
    }
  }, [value, isEnhancing, disabled, selectedModel, onChange, onEnhancePrompt, adjustHeight, toast, hasEnhanced, history, historyIndex, addToHistory])

  // Undo function
  const handleUndo = useCallback(() => {
    console.log('[Prompt Enhancer] Undo attempt:', {
      historyIndex,
      historyLength: history.length,
      disabled,
      hasValidHistory: history.length > 0,
      currentValue: value?.substring(0, 50) + '...',
      history: history.map(h => h?.substring(0, 30) + '...')
    })

    // Robust validation
    if (disabled) {
      console.log('[Prompt Enhancer] Undo blocked: Component disabled')
      return
    }

    if (historyIndex <= 0) {
      console.log('[Prompt Enhancer] Undo blocked: Already at first version')
      if (toast) {
        toast({
          title: "Cannot Undo",
          description: "Already at the original version",
          variant: "destructive",
          duration: 2000,
        })
      }
      return
    }

    if (!history || history.length === 0) {
      console.log('[Prompt Enhancer] Undo blocked: No history available')
      if (toast) {
        toast({
          title: "Cannot Undo",
          description: "No history available to undo",
          variant: "destructive",
          duration: 2000,
        })
      }
      return
    }

    const newIndex = historyIndex - 1

    // Validate new index bounds
    if (newIndex < 0 || newIndex >= history.length) {
      console.log('[Prompt Enhancer] Undo blocked: Invalid history index')
      if (toast) {
        toast({
          title: "Cannot Undo",
          description: "History state is corrupted",
          variant: "destructive",
          duration: 3000,
        })
      }
      return
    }

    const previousVersion = history[newIndex]

    // Validate the previous version exists and is valid
    if (!previousVersion || typeof previousVersion !== 'string') {
      console.log('[Prompt Enhancer] Undo blocked: Invalid previous version')
      if (toast) {
        toast({
          title: "Cannot Undo",
          description: "Previous version is corrupted",
          variant: "destructive",
          duration: 3000,
        })
      }
      return
    }

    console.log('[Prompt Enhancer] Undo successful:', {
      from: historyIndex,
      to: newIndex,
      previousText: previousVersion.substring(0, 50) + '...'
    })

    // Mark as programmatic update to prevent conflicting adjustHeight calls
    setIsProgrammaticUpdate(true)

    // Update state safely
    setHistoryIndex(newIndex)
    onChange(previousVersion)

    // Use setTimeout to ensure DOM updates, then adjust height without expansion
    setTimeout(() => {
      adjustHeight(false, { expand: false })
      setIsProgrammaticUpdate(false)
    }, 0)

    if (toast) {
      toast({
        title: "✅ Undone",
        description: "Reverted to previous version",
        duration: 1500,
      })
    }
  }, [historyIndex, history, onChange, disabled, toast, adjustHeight])


  // Regenerate function
  const handleRegenerate = useCallback(() => {
    console.log('[Prompt Enhancer] Regenerate attempt:', {
      hasEnhanced,
      isEnhancing,
      disabled,
      historyLength: history.length,
      historyIndex,
      hasOriginalPrompt: !!history[0],
      currentValue: value?.substring(0, 50) + '...'
    })

    try {
      // Robust validation before regenerating
      if (!hasEnhanced) {
        console.log('[Prompt Enhancer] Regenerate blocked: No enhancement history')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "No previous enhancement to regenerate from. Enhance a prompt first.",
            variant: "destructive",
            duration: 3000,
          })
        }
        return
      }

      if (isEnhancing) {
        console.log('[Prompt Enhancer] Regenerate blocked: Already enhancing')
        if (toast) {
          toast({
            title: "Please Wait",
            description: "Already generating enhancement...",
            duration: 2000,
          })
        }
        return
      }

      if (disabled) {
        console.log('[Prompt Enhancer] Regenerate blocked: Component disabled')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "Input is currently disabled",
            variant: "destructive",
            duration: 2000,
          })
        }
        return
      }

      // Validate history array
      if (!Array.isArray(history)) {
        console.log('[Prompt Enhancer] Regenerate blocked: History is not an array')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "History state is corrupted",
            variant: "destructive",
            duration: 3000,
          })
        }
        return
      }

      if (history.length === 0) {
        console.log('[Prompt Enhancer] Regenerate blocked: Empty history')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "No enhancement history found",
            variant: "destructive",
            duration: 3000,
          })
        }
        return
      }

      const originalPrompt = history[0]

      if (!originalPrompt || typeof originalPrompt !== 'string') {
        console.log('[Prompt Enhancer] Regenerate blocked: Invalid original prompt')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "Original prompt not found in history",
            variant: "destructive",
            duration: 3000,
          })
        }
        return
      }

      if (originalPrompt.trim().length < 2) {
        console.log('[Prompt Enhancer] Regenerate blocked: Original prompt too short')
        if (toast) {
          toast({
            title: "Cannot Regenerate",
            description: "Original prompt is too short to enhance",
            variant: "destructive",
            duration: 3000,
          })
        }
        return
      }

      console.log('[Prompt Enhancer] Starting regenerate with prompt:', originalPrompt.substring(0, 100))

      // Call the enhancement function with regenerate=true
      handleEnhancePrompt(true)

    } catch (error) {
      console.error('[Prompt Enhancer] Regenerate error:', error)
      if (toast) {
        toast({
          title: "🔄 Regeneration Error",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
          duration: 5000,
        })
      }
    }
  }, [hasEnhanced, isEnhancing, disabled, handleEnhancePrompt, history, historyIndex, toast, value])

  // Reset enhancement state
  const resetEnhancementState = useCallback(() => {
    console.log('[Prompt Enhancer] Resetting enhancement state')

    try {
      setHasEnhanced(false)
      setHistory([])
      setHistoryIndex(-1)
      setOriginalPrompt(null)
      setIsEnhancing(false)
      setIsEnhanced(false)

      console.log('[Prompt Enhancer] Enhancement state reset successfully')
    } catch (error) {
      console.error('[Prompt Enhancer] Error resetting enhancement state:', error)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit
    if (e.key === "Enter" && !e.shiftKey && value.trim()) {
      e.preventDefault()
      onSubmit()
      adjustHeight(true)
    }

    // Ctrl/Cmd + E to enhance prompt
    if (e.key === "e" && (e.ctrlKey || e.metaKey) && value.trim().length >= 2 && !isEnhancing && !disabled) {
      e.preventDefault()
      handleEnhancePrompt()
    }

    // Ctrl/Cmd + Z: Undo (only if enhancement history exists)
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasEnhanced) {
      e.preventDefault()
      handleUndo()
    }


    // Ctrl/Cmd + Shift + R: Regenerate (only if enhancement history exists)
    if (e.key === "r" && (e.ctrlKey || e.metaKey) && e.shiftKey && hasEnhanced) {
      e.preventDefault()
      handleRegenerate()
    }
  }, [value, onSubmit, adjustHeight, handleEnhancePrompt, isEnhancing, disabled, handleUndo, handleRegenerate, hasEnhanced])

  const handleRevertPrompt = useCallback(() => {
    if (originalPrompt) {
      onChange(originalPrompt)
      setOriginalPrompt(null)
      adjustHeight()
      // Show feedback
      if (toast) {
        toast({
          title: "Reverted to Original",
          description: "Your original prompt has been restored",
          duration: 2000,
        })
      }
    }
  }, [originalPrompt, onChange, adjustHeight, toast])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (!value.trim() || disabled) return

    // Reset enhancement state after successful submit
    resetEnhancementState()

    onSubmit()
    adjustHeight(true)
  }

  // File validation helper
  const isFileSupported = (file: File) => {
    const supportedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/m4a',
      'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'
    ]
    return supportedTypes.includes(file.type)
  }

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth(prev => {
      if (prev === 0) {
        setIsDragOver(true)
      }
      return prev + 1
    })
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth(prev => {
      const newDepth = prev - 1
      if (newDepth === 0) {
        setIsDragOver(false)
      }
      return newDepth
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth(0)
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const supportedFiles = files.filter(file => isFileSupported(file))

    if (supportedFiles.length > 0) {
      if (supportedFiles.length === 1 && onFileSelect) {
        // Handle single file
        onFileSelect(supportedFiles[0])
      } else if (supportedFiles.length > 1 && onFilesSelect) {
        // Handle multiple files
        onFilesSelect(supportedFiles)
      } else if (onFilesSelect) {
        // Fallback to multiple file handler for single file if no single file handler
        onFilesSelect(supportedFiles)
      }
    }
  }, [onFileSelect, onFilesSelect])

  // Paste handler
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Call the parent onPaste handler first if provided
    onPaste?.(e)

    const items = Array.from(e.clipboardData.items)
    const fileItem = items.find(item => item.kind === 'file')

    if (fileItem && onFileSelect) {
      const file = fileItem.getAsFile()
      if (file && isFileSupported(file)) {
        onFileSelect(file)
      }
    }
  }, [onFileSelect, onPaste])

  return (
    <div className="w-full py-4">
      <div
        className={cn(
          "bg-[#2B2B2B] rounded-2xl p-1.5 border transition-all duration-200",
          isDragOver
            ? "border-blue-400 ring-2 ring-blue-400 ring-offset-2 ring-offset-[#1E1E1E] bg-blue-500/5"
            : "border-[#4A4A4A] focus-within:ring-2 focus-within:ring-[#4A4A4A] focus-within:ring-offset-2 focus-within:ring-offset-[#1E1E1E]"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Multiple files preview - show when we have multiple files OR both single and multiple */}
        {(selectedFiles && selectedFiles.length > 0) && (
          <div className="mx-4 mt-2 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#B0B0B0]">
                {/* Count both selectedFile and selectedFiles if both exist */}
                {(selectedFile ? 1 : 0) + selectedFiles.length} file{((selectedFile ? 1 : 0) + selectedFiles.length) > 1 ? 's' : ''} selected
              </span>
              {/* Add clear all button */}
              {onAllFilesRemove && (
                <button
                  type="button"
                  onClick={onAllFilesRemove}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div>
              {/* Responsive grid layout for file thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {/* Show selectedFile first if it exists */}
                {selectedFile && (
                  <div className="bg-[#333333] rounded-lg p-2 relative group">
                    <div
                      className="cursor-pointer hover:bg-[#4A4A4A] rounded p-1 -m-1 transition-colors"
                      onClick={() => onFileClick?.(selectedFile)}
                      title={`${selectedFile.file.name}\nClick to view options`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {/* File thumbnail/icon */}
                        <div className="w-16 h-16 rounded overflow-hidden bg-black/30 flex items-center justify-center flex-shrink-0">
                          {selectedFile.file.type.startsWith("image/") ? (
                            <>
                              {selectedFile.preview ? (
                                <img
                                  src={selectedFile.preview}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-[#B0B0B0]" />
                              )}
                            </>
                          ) : selectedFile.file.type.startsWith("video/") ? (
                            <>
                              {selectedFile.videoThumbnail ? (
                                <div className="relative w-full h-full">
                                  <img
                                    src={selectedFile.videoThumbnail}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Video className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <Video className="w-5 h-5 text-[#B0B0B0]" />
                              )}
                            </>
                          ) : (
                            <FileAudio className="w-5 h-5 text-[#B0B0B0]" />
                          )}
                        </div>
                        {/* File name */}
                        <p className="text-xs text-[#B0B0B0] text-center truncate w-full px-1" title={selectedFile.file.name}>
                          {selectedFile.file.name}
                        </p>
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={onFileRemove}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove file"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}

                {/* Then show all files from selectedFiles */}
                {selectedFiles.map((file, index) => (
                  <div key={index} className="bg-[#333333] rounded-lg p-2 relative group">
                    <div
                      className="cursor-pointer hover:bg-[#4A4A4A] rounded p-1 -m-1 transition-colors"
                      onClick={() => onFileClick?.(file, index)}
                      title={`${file.file.name}\nClick to view options`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {/* File thumbnail/icon */}
                        <div className="w-16 h-16 rounded overflow-hidden bg-black/30 flex items-center justify-center flex-shrink-0">
                          {file.file.type.startsWith("image/") ? (
                            <>
                              {file.preview ? (
                                <img
                                  src={file.preview}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-[#B0B0B0]" />
                              )}
                            </>
                          ) : file.file.type.startsWith("video/") ? (
                            <>
                              {file.videoThumbnail ? (
                                <div className="relative w-full h-full">
                                  <img
                                    src={file.videoThumbnail}
                                    alt="Video thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Video className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              ) : (
                                <Video className="w-5 h-5 text-[#B0B0B0]" />
                              )}
                            </>
                          ) : (
                            <FileAudio className="w-5 h-5 text-[#B0B0B0]" />
                          )}
                        </div>
                        {/* File name */}
                        <p className="text-xs text-[#B0B0B0] text-center truncate w-full px-1" title={file.file.name}>
                          {file.file.name}
                        </p>
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => onFilesRemove?.(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove file"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Single file preview (for backward compatibility) */}
        {selectedFile && (!selectedFiles || selectedFiles.length === 0) && (
          <div className="mx-4 mt-2 mb-2 bg-[#333333] rounded-lg max-w-[350px]">
            <div className="flex items-center gap-2 p-2">
              <div
                className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:bg-[#4A4A4A] rounded p-1 -m-1 transition-colors"
                onClick={() => onFileClick?.(selectedFile)}
                title="Click to view options"
              >
                {selectedFile.file.type.startsWith("image/") ? (
                  <>
                    {selectedFile.preview ? (
                      <img
                        src={selectedFile.preview}
                        alt="Preview"
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-[#B0B0B0]" />
                      </div>
                    )}
                  </>
                ) : selectedFile.file.type.startsWith("video/") ? (
                  <>
                    {selectedFile.videoThumbnail ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={selectedFile.videoThumbnail}
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Video className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
                        <Video className="w-5 h-5 text-[#B0B0B0]" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center flex-shrink-0">
                    <FileAudio className="w-5 h-5 text-[#B0B0B0]" />
                  </div>
                )}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm text-[#B0B0B0] truncate" title={selectedFile.file.name}>
                    {selectedFile.file.name}
                  </p>
                  <p className="text-xs text-[#808080]">
                    {formatFileSize(selectedFile.file.size)}
                    {(selectedFile.file.type === 'image/heic' || selectedFile.file.type === 'image/heif' ||
                      selectedFile.file.name.toLowerCase().endsWith('.heic') ||
                      selectedFile.file.name.toLowerCase().endsWith('.heif')) &&
                      " • HEIC format"}
                    {selectedFile.file.type.startsWith("audio/") && selectedFile.preview && " • Ready to play"}
                    {selectedFile.file.type.startsWith("video/") && selectedFile.videoDuration &&
                      ` • ${formatVideoDuration(selectedFile.videoDuration)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onFileRemove}
                className="p-1 hover:bg-[#4A4A4A] rounded flex-shrink-0"
                aria-label="Remove file"
              >
                <X className="w-4 h-4 text-[#B0B0B0]" />
              </button>
            </div>
            {/* Show transcription preview for audio and video files */}
            {(selectedFile.file.type.startsWith("audio/") || selectedFile.file.type.startsWith("video/")) &&
             selectedFile.transcription && (
              <div className="px-2 pb-2">
                <div className="p-2 bg-black/20 rounded">
                  <p className="text-xs text-gray-400 mb-1">
                    Transcription {selectedFile.transcription.language ? `(${selectedFile.transcription.language})` : ''}
                    {selectedFile.transcription.duration ? ` • ${formatDuration(selectedFile.transcription.duration)}` : ''}
                  </p>
                  <p className="text-xs text-gray-300 italic line-clamp-2">
                    "{selectedFile.transcription.text}"
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <div className="relative flex flex-col">
            <div className={cn(
              "overflow-y-auto transition-all duration-300 ease-out",
              isEnhanced ? "max-h-[800px]" : "max-h-[400px]"
            )}>
              <Textarea
                id="ai-input-15"
                data-testid="chat-input"
                value={value}
                placeholder={placeholder || "What can I do for you?"}
                className={cn(
                  "w-full rounded-xl rounded-b-none px-4 py-3 bg-[#2B2B2B] border-none text-white placeholder:text-[#B0B0B0] resize-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  "min-h-[72px]",
                  "transition-all duration-300 ease-out", // Smooth height transition
                )}
                ref={textareaRef}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onChange={(e) => {
                  onChange(e.target.value)

                  // Only adjust height for user typing, not programmatic updates
                  if (!isProgrammaticUpdate) {
                    adjustHeight()
                  }
                }}
                disabled={disabled}
              />
            </div>

            {/* Drag overlay */}
            {isDragOver && (
              <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center z-50">
                <div className="text-center">
                  <Paperclip className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                  <p className="text-sm font-medium text-blue-400">Drop your file here</p>
                  <p className="text-xs text-blue-300">Images, audio, and video files supported</p>
                </div>
              </div>
            )}

            <div className="h-14 bg-[#2B2B2B] rounded-b-xl flex items-center">
              <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between w-[calc(100%-24px)]">
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 h-8 pl-1 pr-2 text-xs rounded-md text-white bg-[#3C3C3C] hover:bg-[#4A4A4A] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4A4A4A]"
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedModel}
                            initial={{
                              opacity: 0,
                              y: -5,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            exit={{
                              opacity: 0,
                              y: 5,
                            }}
                            transition={{
                              duration: 0.15,
                            }}
                            className="flex items-center gap-1"
                          >
                            {MODEL_ICONS[selectedModel]}
                            {selectedModel}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                          </motion.div>
                        </AnimatePresence>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={cn("min-w-[10rem]", "border-[#333333]", "bg-[#2B2B2B]")}>
                      {AI_MODELS.map((model) => (
                        <DropdownMenuItem
                          key={model}
                          onSelect={() => onModelChange?.(model)}
                          className="flex items-center justify-between gap-2 hover:bg-[#3C3C3C]"
                        >
                          <div className="flex items-center gap-2">
                            {MODEL_ICONS[model] || <Bot className="w-4 h-4 opacity-50" />}
                            <span className="text-white">{model}</span>
                          </div>
                          {selectedModel === model && <Check className="w-4 h-4 text-white" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="h-4 w-px bg-[#333333] mx-0.5" />
                  <label
                    className={cn(
                      "rounded-lg p-2 cursor-pointer",
                      "hover:bg-[#4A4A4A] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4A4A4A]",
                      "text-[#B0B0B0] hover:text-white",
                      selectedFile && "text-white bg-[#4A4A4A]"
                    )}
                    aria-label="Attach file"
                  >
                    <input
                      type="file"
                      className="hidden"
                      id="file-upload-input"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/avif,audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/mp4,audio/m4a,video/mp4,video/mpeg,video/mov,video/avi,video/webm,video/quicktime"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files
                        if (files && files.length > 0) {
                          if (files.length === 1 && onFileSelect) {
                            // Handle single file
                            onFileSelect(files[0])
                          } else if (files.length > 1 && onFilesSelect) {
                            // Handle multiple files
                            const fileArray = Array.from(files)
                            onFilesSelect(fileArray)
                          } else if (onFilesSelect) {
                            // Fallback to multiple file handler for single file if no single file handler
                            const fileArray = Array.from(files)
                            onFilesSelect(fileArray)
                          }
                          // Reset the input so files can be selected again
                          e.target.value = ''
                        }
                      }}
                    />
                    <Paperclip className="w-4 h-4 transition-colors" />
                  </label>
                  <MCPToolsPopup
                    onToolToggle={onToolToggle}
                    onServerToggle={onServerToggle}
                  />
                </div>

                {/* Enhancement controls */}
                <div className="flex items-center gap-2">

                  {/* Enhance button - always visible */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            console.log('[Prompt Enhancer] Button clicked:', {
                              value: value.trim(),
                              valueLength: value.trim().length,
                              isEnhancing,
                              disabled
                            })
                            handleEnhancePrompt()
                          }}
                          disabled={!value.trim() || value.trim().length < 2 || isEnhancing || disabled}
                          className={cn(
                            "rounded-lg p-2 transition-all duration-200 relative group",
                            value.trim() && value.trim().length >= 2 && !disabled && !isEnhancing
                              ? "bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/20 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 cursor-pointer"
                              : "text-[#B0B0B0] hover:text-white hover:bg-[#4A4A4A]",
                            "active:scale-95",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                            isEnhancing && "animate-pulse border-purple-400/50 bg-purple-500/20",
                            "shadow-sm hover:shadow-purple-500/20"
                          )}
                          aria-label={isEnhancing ? "Enhancing prompt..." : "Enhance prompt with AI"}
                        >
                          {isEnhancing && (
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-pulse" />
                          )}
                          <Sparkles className={cn(
                            "w-4 h-4 transition-all duration-200 relative z-10",
                            isEnhancing && "animate-spin text-purple-300",
                            !isEnhancing && value.trim().length >= 2 && "group-hover:scale-110 group-hover:rotate-12"
                          )} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-center">
                          <p className="font-medium">Enhance prompt with AI</p>
                          <p className="text-xs opacity-75 mt-1">Keyboard: Ctrl+E</p>
                          {isEnhancing && <p className="text-xs text-purple-400 mt-1">✨ Enhancing...</p>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Enhancement history buttons - only visible after enhancement */}
                  <AnimatePresence>
                    {hasEnhanced && (
                      <motion.div
                        className="flex items-center gap-2"
                        initial={{ opacity: 0, x: -10, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -10, scale: 0.8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        {/* Undo button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={handleUndo}
                                disabled={historyIndex <= 0 || disabled}
                                className={cn(
                                  "rounded-lg p-2 transition-all duration-200",
                                  historyIndex > 0 && !disabled
                                    ? "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-blue-400 hover:text-blue-300"
                                    : "text-[#B0B0B0] hover:text-white hover:bg-[#4A4A4A]",
                                  "active:scale-95",
                                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                                )}
                                aria-label="Undo last change"
                              >
                                <RotateCcw className="w-4 h-4 transition-colors" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Undo (Ctrl+Z)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>


                        {/* Regenerate button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={!hasEnhanced || isEnhancing || disabled}
                                className={cn(
                                  "rounded-lg p-2 transition-all duration-200 relative group",
                                  hasEnhanced && !disabled && !isEnhancing
                                    ? "bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 hover:text-green-300"
                                    : "text-[#B0B0B0] hover:text-white hover:bg-[#4A4A4A]",
                                  "active:scale-95",
                                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                                  isEnhancing && "animate-pulse border-green-400/50"
                                )}
                                aria-label={isEnhancing ? "Generating new enhancement..." : "Generate new enhancement"}
                              >
                                {isEnhancing && (
                                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 animate-pulse" />
                                )}
                                <RefreshCw className={cn(
                                  "w-4 h-4 transition-all duration-200 relative z-10",
                                  isEnhancing && "animate-spin text-green-300",
                                  !isEnhancing && hasEnhanced && "group-hover:scale-110 group-hover:rotate-180"
                                )} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>New enhancement (Ctrl+Shift+R)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Deep Research button - separated with margin for better spacing */}
                  <div className="ml-2 pl-2 border-l border-[#333333]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onDeepResearch?.()}
                            disabled={disabled}
                            className={cn(
                              "rounded-lg p-2 transition-all duration-200",
                              "hover:bg-[#4A4A4A] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4A4A4A]",
                              isDeepResearchMode
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
                                : "text-[#B0B0B0] hover:text-white",
                              "active:scale-95",
                              "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            )}
                            aria-label={isDeepResearchMode ? "Deep research mode active" : "Enable deep research mode"}
                          >
                            <Microscope className={cn(
                              "w-4 h-4 transition-all duration-200",
                              isDeepResearchMode && "scale-110"
                            )} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isDeepResearchMode ? "Deep research mode active" : "Enable deep research mode"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="send-button"
                  className={cn(
                    "rounded-xl transition-all duration-200 ease-out",
                    "focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0",
                    "active:scale-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
                    disabled
                      ? "bg-white hover:bg-gray-100 px-4 py-2 flex items-center gap-2"
                      : value.trim() || selectedFile || selectedFiles.length > 0
                        ? "bg-white hover:bg-gray-100 p-2"
                        : "bg-[#2B2B2B] hover:bg-[#333333] p-2 border border-[#333333]",
                  )}
                  aria-label={disabled ? "Stop generation" : "Send message"}
                  title={disabled ? "Stop generation" : "Send message"}
                  disabled={!value.trim() && !disabled && !selectedFile && selectedFiles.length === 0}
                  onClick={disabled ? onStop : handleSubmit}
                >
                  {disabled ? (
                    <>
                      <Square className="w-4 h-4 text-black fill-black" />
                      <span className="text-black text-sm font-medium">Stop</span>
                    </>
                  ) : (
                    <ArrowRight
                      className={cn(
                        "w-4 h-4 transition-all duration-200",
                        value.trim() || selectedFile || selectedFiles.length > 0 ? "text-black transform hover:translate-x-0.5" : "text-[#666666]",
                      )}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
