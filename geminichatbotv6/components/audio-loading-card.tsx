"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, Volume2, Activity } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface AudioLoadingCardProps {
  prompt: string
  voiceName?: string
  isGenerating?: boolean
  estimatedDuration?: string
  progress?: number
  className?: string
  provider?: 'dia' | 'default'
}

export function AudioLoadingCard({
  prompt,
  voiceName = "Eva",
  isGenerating = true,
  estimatedDuration,
  progress = 0,
  className = "",
  provider = 'default'
}: AudioLoadingCardProps) {
  // Calculate progress for animation (if no progress provided, use indeterminate animation)
  const displayProgress = progress > 0 ? progress : undefined

  return (
    <Card className={`bg-[#2B2B2B] border-[#333333] ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Audio Icon with Animation */}
          <div className="flex-shrink-0 mt-1">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center ${
                isGenerating ? 'animate-pulse' : ''
              }`}>
                <Mic className="w-5 h-5 text-blue-400" />
              </div>
              {isGenerating && (
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white truncate">
                {isGenerating ? "Generating Audio..." : "Audio Generated"}
              </h3>
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <Volume2 className="w-3 h-3" />
                <span>{voiceName}</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-3 line-clamp-2">
              {prompt}
            </p>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    {displayProgress ? `${Math.round(displayProgress)}%` : "Processing..."}
                  </span>
                  {estimatedDuration && (
                    <span className="text-gray-400">~{estimatedDuration}</span>
                  )}
                </div>
                <Progress
                  value={displayProgress}
                  className="h-1 bg-gray-700"
                />
              </div>
            )}

            {/* Status Indicators */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                {isGenerating ? (
                  <>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                    <span className="text-xs text-blue-400">Processing with WaveSpeed Dia TTS</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-xs text-green-400">Ready to play</span>
                  </>
                )}
              </div>

              {isGenerating && (
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-gray-400 animate-pulse" />
                  <span className="text-xs text-gray-400">Generating waveform</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
