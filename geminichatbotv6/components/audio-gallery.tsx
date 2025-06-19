"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Volume2, Mic, Plus } from "lucide-react"
import { AudioPlayerCard } from "./audio-player-card"
import { deleteAudio as deletePersistedAudio } from "@/lib/audio-persistence"

export interface GeneratedAudio {
  id: string
  text: string
  script?: string
  audioBase64: string
  mimeType: string
  timestamp: number
  duration?: number
  voice?: string
  voiceId?: string
  voiceName?: string
  isMultiSpeaker?: boolean
  provider?: string
  isGenerating?: boolean
  progress?: number
  estimatedDuration?: string
  error?: string
  status?: 'pending' | 'generating' | 'completed' | 'failed'
}

interface AudioGalleryProps {
  audios: GeneratedAudio[]
  onAudiosChange?: (audios: GeneratedAudio[]) => void
}


export function AudioGallery({ audios, onAudiosChange }: AudioGalleryProps) {
  const handleDelete = async (audioId: string) => {
    if (onAudiosChange) {
      const updatedAudios = audios.filter(a => a.id !== audioId)
      onAudiosChange(updatedAudios)
      
      // Also delete from IndexedDB
      const success = await deletePersistedAudio(audioId)
      if (!success) {
        console.warn('[AudioGallery] Failed to delete audio from IndexedDB')
      }
    }
  }

  if (audios.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#2B2B2B] flex items-center justify-center mb-6">
            <Volume2 className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Audio Gallery</h3>
          <p className="text-[#B0B0B0] max-w-md">
            Audio files will appear here when generated.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">Generated Audio</h3>
      </div>
      <div className="space-y-4">
        {audios.map((audio) => (
          <AudioPlayerCard
            key={audio.id}
            id={audio.id}
            audioBase64={audio.audioBase64}
            mimeType={audio.mimeType}
            text={audio.script || audio.text}
            voiceName={audio.voiceName || "Eva"}
            timestamp={audio.timestamp}
            duration={audio.duration}
            isGenerating={audio.isGenerating || false}
            generationProgress={audio.progress}
            provider={audio.provider}
            onDelete={() => handleDelete(audio.id)}
            error={audio.error}
            script={audio.script}
            onRetry={() => {
              // Retry logic would be implemented here
              console.log('[AudioGallery] Retry requested for audio:', audio.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}