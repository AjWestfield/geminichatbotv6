"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle, Brain, Search, Shield, Sparkles, FileText } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface DeepResearchProgressProps {
  phase: string
  progress: number
  topic?: string
  depth?: 'surface' | 'moderate' | 'deep'
}

const phaseIcons: Record<string, React.ElementType> = {
  initializing: Loader2,
  gathering_context: Search,
  deep_analysis: Brain,
  cross_validation: Shield,
  synthesizing: Sparkles,
  finalizing: FileText
}

const phaseLabels: Record<string, string> = {
  initializing: "Initializing Research",
  gathering_context: "Gathering Context",
  deep_analysis: "Deep Analysis",
  cross_validation: "Cross Validation",
  synthesizing: "Synthesizing Insights",
  finalizing: "Finalizing Report"
}

const phaseDescriptions: Record<string, string> = {
  initializing: "Setting up deep research parameters...",
  gathering_context: "Searching across multiple sources for relevant information...",
  deep_analysis: "Analyzing findings in depth and exploring connections...",
  cross_validation: "Verifying information across different sources...",
  synthesizing: "Combining insights into coherent findings...",
  finalizing: "Preparing comprehensive research results..."
}

export function DeepResearchProgress({ phase, progress, topic, depth }: DeepResearchProgressProps) {
  const Icon = phaseIcons[phase] || Loader2
  const label = phaseLabels[phase] || "Processing"
  const description = phaseDescriptions[phase] || "Working on your request..."
  
  const depthColors = {
    surface: "bg-blue-500",
    moderate: "bg-purple-500",
    deep: "bg-gradient-to-r from-purple-600 to-pink-600"
  }
  
  const depthLabels = {
    surface: "Quick Research",
    moderate: "Standard Research",
    deep: "Deep Research"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full p-4 rounded-lg bg-[#2B2B2B] border border-[#3C3C3C]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-2 py-1 rounded text-xs font-medium text-white",
            depth ? depthColors[depth] : depthColors.deep
          )}>
            {depth ? depthLabels[depth] : depthLabels.deep}
          </div>
          {topic && (
            <span className="text-sm text-gray-400 truncate max-w-[200px]">
              {topic}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
      </div>

      {/* Current Phase */}
      <div className="flex items-center gap-3 mb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ duration: 0.3 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
            <div className="relative bg-[#1C1C1C] p-2 rounded-full">
              <Icon className={cn(
                "w-5 h-5",
                phase === 'finalizing' ? "text-green-400" : "text-purple-400",
                phase !== 'finalizing' && "animate-pulse"
              )} />
            </div>
          </motion.div>
        </AnimatePresence>
        
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white mb-1">{label}</h4>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress 
        value={progress} 
        className="h-2 bg-[#1C1C1C]"
        indicatorClassName={cn(
          "transition-all duration-500",
          depth === 'deep' ? "bg-gradient-to-r from-purple-600 to-pink-600" :
          depth === 'moderate' ? "bg-purple-500" : "bg-blue-500"
        )}
      />

      {/* Phase Timeline */}
      <div className="mt-4 flex items-center justify-between">
        {Object.entries(phaseLabels).map(([key, _], index, array) => {
          const isCompleted = Object.keys(phaseLabels).indexOf(phase) > index
          const isCurrent = key === phase
          const PhaseIcon = phaseIcons[key]
          
          return (
            <React.Fragment key={key}>
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300",
                  isCompleted ? "bg-green-500/20" :
                  isCurrent ? "bg-purple-500/20 ring-2 ring-purple-500/50" :
                  "bg-[#1C1C1C]"
                )}>
                  {isCompleted ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <PhaseIcon className={cn(
                      "w-3 h-3",
                      isCurrent ? "text-purple-400" : "text-gray-600"
                    )} />
                  )}
                </div>
              </div>
              
              {index < array.length - 1 && (
                <div className={cn(
                  "flex-1 h-[2px] transition-all duration-500",
                  isCompleted ? "bg-green-500/30" : "bg-[#1C1C1C]"
                )} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Estimated Time */}
      {phase !== 'finalizing' && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            Estimated time remaining: {
              phase === 'initializing' ? "calculating..." :
              progress < 30 ? "2-3 minutes" :
              progress < 60 ? "1-2 minutes" :
              progress < 90 ? "less than a minute" :
              "almost done..."
            }
          </p>
        </div>
      )}
    </motion.div>
  )
}