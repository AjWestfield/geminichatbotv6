"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Sparkles, RotateCcw, RotateCw, RefreshCw } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"

interface PromptEnhancerProps {
  value: string
  onChange: (value: string) => void
  model?: string
  context?: "chat" | "image-edit" | "video" | "audio" | "multi-image"
  disabled?: boolean
  className?: string
  placeholder?: string
  onReset?: () => void
}

export function PromptEnhancer({
  value,
  onChange,
  model = "gemini",
  context = "chat",
  disabled = false,
  className,
  onReset
}: PromptEnhancerProps) {
  const { toast } = useToast()
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [hasEnhanced, setHasEnhanced] = useState(false)

  // Initialize history with current value when it changes externally
  useEffect(() => {
    if (value && history.length === 0) {
      setHistory([value])
      setHistoryIndex(0)
    }
  }, [value, history.length])

  // Add to history
  const addToHistory = useCallback((text: string) => {
    // If we're not at the end of history, slice off the future
    const newHistory = historyIndex >= 0 ? history.slice(0, historyIndex + 1) : []
    newHistory.push(text)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setHasEnhanced(true)
  }, [history, historyIndex])

  // Enhance prompt
  const handleEnhance = useCallback(async (regenerate = false) => {
    if (!value.trim() || isEnhancing || disabled) return

    setIsEnhancing(true)
    const promptToEnhance = regenerate && historyIndex > 0 ? history[0] : value.trim()

    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptToEnhance,
          model: model,
          context: context,
          regenerate: regenerate
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.enhancedPrompt) {
        onChange(data.enhancedPrompt)
        addToHistory(data.enhancedPrompt)
        
        toast({
          title: regenerate ? "Regenerated Enhancement" : "Prompt Enhanced",
          description: `Enhanced with ${data.model || model}`,
          duration: 2000,
        })
      } else {
        throw new Error(data.error || 'Failed to enhance prompt')
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error)
      toast({
        title: "Enhancement Failed",
        description: error instanceof Error ? error.message : "Failed to enhance prompt",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsEnhancing(false)
    }
  }, [value, isEnhancing, disabled, model, context, onChange, addToHistory, toast, history, historyIndex])

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && !disabled) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
      
      toast({
        title: "Undone",
        description: "Reverted to previous version",
        duration: 1500,
      })
    }
  }, [historyIndex, history, onChange, disabled, toast])

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && !disabled) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
      
      toast({
        title: "Redone",
        description: "Restored next version",
        duration: 1500,
      })
    }
  }, [historyIndex, history, onChange, disabled, toast])

  // Regenerate (new enhancement)
  const handleRegenerate = useCallback(() => {
    if (hasEnhanced && !isEnhancing && !disabled) {
      handleEnhance(true)
    }
  }, [hasEnhanced, isEnhancing, disabled, handleEnhance])

  // Reset enhancement state
  const resetState = useCallback(() => {
    setHistory([])
    setHistoryIndex(-1)
    setIsEnhancing(false)
    setHasEnhanced(false)
    onReset?.()
  }, [onReset])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return

      // Ctrl/Cmd + E: Enhance
      if (e.key === 'e' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        handleEnhance()
      }
      // Ctrl/Cmd + Z: Undo (only if enhancement history exists)
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasEnhanced) {
        e.preventDefault()
        handleUndo()
      }
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo (only if enhancement history exists)
      else if (((e.key === 'y' && (e.ctrlKey || e.metaKey)) || 
                (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) && hasEnhanced) {
        e.preventDefault()
        handleRedo()
      }
      // Ctrl/Cmd + R: Regenerate (only if enhancement history exists)
      else if (e.key === 'r' && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasEnhanced) {
        e.preventDefault()
        handleRegenerate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, handleEnhance, handleUndo, handleRedo, handleRegenerate, hasEnhanced])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1
  const canEnhance = value.trim().length > 0
  const canRegenerate = hasEnhanced

  return (
    <div className={cn("flex items-center gap-1 p-1 bg-[#2B2B2B] rounded-lg border border-[#333333]", className)}>
      <TooltipProvider>
        {/* Enhance Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEnhance()}
              disabled={!canEnhance || isEnhancing || disabled}
              className={cn(
                "gap-2 text-xs",
                canEnhance && !disabled
                  ? "text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                  : "text-gray-500"
              )}
            >
              <Sparkles className={cn("w-4 h-4", isEnhancing && "animate-spin")} />
              Enhance
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enhance prompt with AI</p>
            <p className="text-xs opacity-75">Ctrl+E</p>
          </TooltipContent>
        </Tooltip>

        {/* Enhancement history buttons - only visible after enhancement */}
        <AnimatePresence>
          {hasEnhanced && (
            <motion.div
              className="flex items-center gap-1"
              initial={{ opacity: 0, x: -10, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* Undo Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={!canUndo || disabled}
                    className={cn(
                      "gap-2 text-xs",
                      canUndo && !disabled
                        ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        : "text-gray-500"
                    )}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo last change</p>
                  <p className="text-xs opacity-75">Ctrl+Z</p>
                </TooltipContent>
              </Tooltip>

              {/* Redo Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    disabled={!canRedo || disabled}
                    className={cn(
                      "gap-2 text-xs",
                      canRedo && !disabled
                        ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        : "text-gray-500"
                    )}
                  >
                    <RotateCw className="w-4 h-4" />
                    Redo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Redo last change</p>
                  <p className="text-xs opacity-75">Ctrl+Y</p>
                </TooltipContent>
              </Tooltip>

              {/* Regenerate Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={!canRegenerate || isEnhancing || disabled}
                    className={cn(
                      "gap-2 text-xs",
                      canRegenerate && !disabled
                        ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        : "text-gray-500"
                    )}
                  >
                    <RefreshCw className={cn("w-4 h-4", isEnhancing && "animate-spin")} />
                    New
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate new enhancement</p>
                  <p className="text-xs opacity-75">Ctrl+R</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </TooltipProvider>
    </div>
  )
}