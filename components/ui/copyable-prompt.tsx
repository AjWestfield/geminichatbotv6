"use client"

import { useState } from "react"
import { Copy, Check, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { FollowUpActions } from "@/components/follow-up-actions"

interface CopyablePromptProps {
  prompt: string
  title?: string
  className?: string
  imageUri?: string
  showFollowUpActions?: boolean
  onFollowUpAction?: (action: 'generate-image' | 'animate-image' | 'edit-image' | 'generate-variations', prompt: string, imageUri?: string) => void
  showVideoGeneration?: boolean
  onGenerateVideo?: (prompt: string) => void
}

export function CopyablePrompt({
  prompt,
  title = "Recreatable Prompt",
  className,
  imageUri,
  showFollowUpActions,
  onFollowUpAction,
  showVideoGeneration = false,
  onGenerateVideo
}: CopyablePromptProps) {
  const [copied, setCopied] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success("Prompt copied to clipboard!", {
        duration: 2000
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy prompt", {
        description: "Please try selecting and copying manually"
      })
    }
  }

  const handleGenerateVideo = async () => {
    if (!onGenerateVideo) return

    setIsGeneratingVideo(true)
    try {
      await onGenerateVideo(prompt)
      toast.success("Video generation started!", {
        description: "Check the Videos tab to see progress"
      })
    } catch (error) {
      toast.error("Failed to start video generation", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      })
    } finally {
      setIsGeneratingVideo(false)
    }
  }

  return (
    <div className={cn("bg-black/20 rounded-lg p-4 my-3 border border-gray-800", className)}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {showVideoGeneration && onGenerateVideo && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo}
            className="h-8 px-3 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300"
          >
            {isGeneratingVideo ? (
              <>
                <Video className="h-4 w-4 mr-1 animate-pulse" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Video className="h-4 w-4 mr-1" />
                Generate Video
              </>
            )}
          </Button>
        )}
      </div>
      <div className="relative group">
        <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-black/30 p-3 pr-10 rounded-md overflow-x-auto">
          {prompt}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-gray-400 hover:text-white transition-all opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          title="Copy prompt"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      {showFollowUpActions && onFollowUpAction && (
        <FollowUpActions
          prompt={prompt}
          imageUri={imageUri}
          onAction={onFollowUpAction}
        />
      )}
    </div>
  )
}
