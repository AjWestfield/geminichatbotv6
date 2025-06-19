"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Loader2, Mic, Music, Volume2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface AudioGenerationProgressProps {
  text: string
  voiceName?: string
  isMultiSpeaker?: boolean
  actualProgress?: number
  status?: string
  estimatedDuration?: number
}

export function AudioGenerationProgress({ 
  text, 
  voiceName = "default",
  isMultiSpeaker = false,
  actualProgress,
  status: propStatus,
  estimatedDuration
}: AudioGenerationProgressProps) {
  const [progress, setProgress] = useState(actualProgress || 0)
  const [status, setStatus] = useState(propStatus || "Initializing...")

  useEffect(() => {
    // If we have actual progress, use it
    if (actualProgress !== undefined) {
      setProgress(actualProgress)
    }
    if (propStatus) {
      setStatus(propStatus)
    }
  }, [actualProgress, propStatus])

  useEffect(() => {
    // Only simulate progress if we don't have actual progress
    if (actualProgress !== undefined) return

    const stages = [
      { progress: 10, status: "Initializing WaveSpeed Dia TTS...", duration: 500 },
      { progress: 25, status: "Processing text and audio tags...", duration: 800 },
      { progress: 40, status: isMultiSpeaker ? "Setting up multiple speakers..." : `Loading ${voiceName} voice model...`, duration: 1000 },
      { progress: 60, status: "Generating speech synthesis...", duration: 1500 },
      { progress: 80, status: "Optimizing audio quality...", duration: 1000 },
      { progress: 95, status: "Finalizing audio file...", duration: 500 },
      { progress: 100, status: "Complete!", duration: 300 }
    ]

    let currentStage = 0
    
    const updateProgress = () => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage]
        setProgress(stage.progress)
        setStatus(stage.status)
        currentStage++
        
        setTimeout(updateProgress, stage.duration)
      }
    }

    updateProgress()

    return () => {
      currentStage = stages.length // Stop updates on unmount
    }
  }, [voiceName, isMultiSpeaker, actualProgress])

  return (
    <Card className="w-full p-6 bg-[#2B2B2B] border-[#333333]">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-[#3C3C3C] flex items-center justify-center">
            {progress < 100 ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Volume2 className="h-6 w-6 text-white" />
            )}
          </div>
          {isMultiSpeaker && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#4C4C4C] flex items-center justify-center">
              <Music className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">
            {isMultiSpeaker ? "Generating Multi-Speaker Dialogue" : "Generating Audio"}
          </h3>
          <p className="text-[#B0B0B0] text-sm mb-3 line-clamp-2">
            {text}
          </p>
          
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#B0B0B0]">{status}</p>
              <p className="text-xs text-[#B0B0B0]">{progress}%</p>
            </div>
          </div>
          
          {voiceName && voiceName !== "default" && (
            <div className="mt-3 flex items-center gap-2">
              <Mic className="h-3 w-3 text-[#B0B0B0]" />
              <p className="text-xs text-[#B0B0B0]">
                Voice: {voiceName} {isMultiSpeaker && "& others"}
              </p>
            </div>
          )}
          
          {estimatedDuration && progress < 100 && (
            <div className="mt-2">
              <p className="text-xs text-[#B0B0B0]">
                Estimated time: {Math.ceil(estimatedDuration / 1000)}s remaining
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}