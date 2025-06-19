'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface ImageGenerationSettings {
  model: string
  editingModel: string
  style: 'vivid' | 'natural'
  size: '1024x1024' | '1792x1024' | '1024x1536'
  quality: 'standard' | 'hd'
}

interface VideoGenerationSettings {
  model: 'standard' | 'pro' | 'fast'
  duration: 5 | 10
  aspectRatio: '16:9' | '9:16' | '1:1'
  backend: 'replicate' | 'huggingface'
  tier: 'fast' | 'quality'
  autoDetectAspectRatio: boolean
}

interface ChatSettings {
  model: string
}

interface SettingsContextType {
  // Loading state
  isLoading: boolean

  // Image settings
  imageSettings: ImageGenerationSettings
  updateImageSettings: (settings: Partial<ImageGenerationSettings>) => void

  // Video settings
  videoSettings: VideoGenerationSettings
  updateVideoSettings: (settings: Partial<VideoGenerationSettings>) => void

  // Chat settings
  chatSettings: ChatSettings
  updateChatSettings: (settings: Partial<ChatSettings>) => void

  // Settings change events
  onSettingsChange: (callback: () => void) => () => void
}

const defaultImageSettings: ImageGenerationSettings = {
  model: 'flux-kontext-pro',
  editingModel: 'flux-kontext-pro',
  style: 'vivid',
  size: '1024x1024',
  quality: 'standard'
}

const defaultVideoSettings: VideoGenerationSettings = {
  model: 'standard',
  duration: 5,
  aspectRatio: '16:9',
  backend: 'replicate',
  tier: 'fast',
  autoDetectAspectRatio: true
}

const defaultChatSettings: ChatSettings = {
  model: 'gemini-2.5-pro-preview-06-05'
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)

  // Image settings
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(() => {
    if (typeof window !== 'undefined') {
      console.log('[SettingsContext] Initializing image settings...')

      // First try to load from unified settings
      const saved = localStorage.getItem('imageGenerationSettings')
      console.log('[SettingsContext] Unified settings from localStorage:', saved)

      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Validate parsed settings
          if (parsed.model && parsed.style && parsed.size && parsed.quality) {
            console.log('[SettingsContext] Using unified settings:', parsed)
            return {
              model: parsed.model,
              editingModel: parsed.editingModel || parsed.model,
              style: parsed.style,
              size: parsed.size,
              quality: parsed.quality
            }
          }
        } catch (e) {
          console.error('[SettingsContext] Failed to parse image settings:', e)
        }
      }

      // Migration: Load from individual items if unified settings don't exist
      console.log('[SettingsContext] Loading from individual keys...')
      const migratedSettings = {
        model: localStorage.getItem('imageGenerationModel') || defaultImageSettings.model,
        editingModel: localStorage.getItem('imageEditingModel') || defaultImageSettings.editingModel,
        style: (localStorage.getItem('imageStyle') as any) || defaultImageSettings.style,
        size: (localStorage.getItem('imageSize') as any) || defaultImageSettings.size,
        quality: (localStorage.getItem('imageQuality') as any) || defaultImageSettings.quality
      }
      console.log('[SettingsContext] Migrated settings:', migratedSettings)

      // Save migrated settings to unified storage
      localStorage.setItem('imageGenerationSettings', JSON.stringify(migratedSettings))
      console.log('[SettingsContext] Saved migrated settings to unified storage')

      // Keep individual items for backward compatibility with settingsSync
      // This allows both systems to work together

      return migratedSettings
    }
    return defaultImageSettings
  })

  // Video settings
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('videoGenerationSettings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Ensure all required fields are present with defaults
          return {
            model: parsed.model || defaultVideoSettings.model,
            duration: parsed.duration || defaultVideoSettings.duration,
            aspectRatio: parsed.aspectRatio || defaultVideoSettings.aspectRatio,
            backend: parsed.backend || defaultVideoSettings.backend,
            tier: parsed.tier || defaultVideoSettings.tier,
            autoDetectAspectRatio: parsed.autoDetectAspectRatio !== undefined ? parsed.autoDetectAspectRatio : defaultVideoSettings.autoDetectAspectRatio
          }
        } catch (e) {
          console.error('Failed to parse video settings:', e)
        }
      }
      // Fallback to individual items for backward compatibility
      return {
        model: (localStorage.getItem('videoModel') as any) || defaultVideoSettings.model,
        duration: parseInt(localStorage.getItem('videoDuration') || '5') as any || defaultVideoSettings.duration,
        aspectRatio: (localStorage.getItem('videoAspectRatio') as any) || defaultVideoSettings.aspectRatio,
        backend: (localStorage.getItem('videoBackend') as any) || defaultVideoSettings.backend,
        tier: (localStorage.getItem('videoTier') as any) || defaultVideoSettings.tier,
        autoDetectAspectRatio: localStorage.getItem('videoAutoDetectAspectRatio') === 'true' || defaultVideoSettings.autoDetectAspectRatio
      }
    }
    return defaultVideoSettings
  })

  // Chat settings
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSettings')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse chat settings:', e)
        }
      }
      // Fallback
      return {
        model: localStorage.getItem('selectedModel') || defaultChatSettings.model
      }
    }
    return defaultChatSettings
  })

  // Settings change callbacks
  const [changeCallbacks, setChangeCallbacks] = useState<Set<() => void>>(new Set())

  const notifySettingsChange = useCallback(() => {
    changeCallbacks.forEach(callback => callback())
  }, [changeCallbacks])

  const onSettingsChange = useCallback((callback: () => void) => {
    setChangeCallbacks(prev => new Set(prev).add(callback))
    return () => {
      setChangeCallbacks(prev => {
        const next = new Set(prev)
        next.delete(callback)
        return next
      })
    }
  }, [])

  // Update functions
  const updateImageSettings = useCallback((updates: Partial<ImageGenerationSettings>) => {
    console.log('[SettingsContext] updateImageSettings called with:', updates)

    setImageSettings(prev => {
      const newSettings = { ...prev, ...updates }
      console.log('[SettingsContext] New settings will be:', newSettings)

      if (typeof window !== 'undefined') {
        // Save to unified settings
        localStorage.setItem('imageGenerationSettings', JSON.stringify(newSettings))
        console.log('[SettingsContext] Saved to imageGenerationSettings:', JSON.stringify(newSettings))

        // Also save to individual keys for backward compatibility
        if (updates.model !== undefined) {
          localStorage.setItem('imageGenerationModel', updates.model)
          console.log('[SettingsContext] Saved imageGenerationModel:', updates.model)
        }
        if (updates.editingModel !== undefined) {
          localStorage.setItem('imageEditingModel', updates.editingModel)
          console.log('[SettingsContext] Saved imageEditingModel:', updates.editingModel)
        }
        if (updates.style !== undefined) {
          localStorage.setItem('imageStyle', updates.style)
          console.log('[SettingsContext] Saved imageStyle:', updates.style)
        }
        if (updates.size !== undefined) {
          localStorage.setItem('imageSize', updates.size)
          console.log('[SettingsContext] Saved imageSize:', updates.size)
        }
        if (updates.quality !== undefined) {
          localStorage.setItem('imageQuality', updates.quality)
          console.log('[SettingsContext] Saved imageQuality:', updates.quality)
        }
      }
      return newSettings
    })
    notifySettingsChange()
  }, [notifySettingsChange])

  const updateVideoSettings = useCallback((updates: Partial<VideoGenerationSettings>) => {
    setVideoSettings(prev => {
      const newSettings = { ...prev, ...updates }
      if (typeof window !== 'undefined') {
        // Save to unified settings
        localStorage.setItem('videoGenerationSettings', JSON.stringify(newSettings))

        // Also save to individual keys for backward compatibility
        if (updates.model !== undefined) {
          localStorage.setItem('videoModel', updates.model)
        }
        if (updates.duration !== undefined) {
          localStorage.setItem('videoDuration', updates.duration.toString())
        }
        if (updates.aspectRatio !== undefined) {
          localStorage.setItem('videoAspectRatio', updates.aspectRatio)
        }
        if (updates.backend !== undefined) {
          localStorage.setItem('videoBackend', updates.backend)
        }
        if (updates.tier !== undefined) {
          localStorage.setItem('videoTier', updates.tier)
        }
        if (updates.autoDetectAspectRatio !== undefined) {
          localStorage.setItem('videoAutoDetectAspectRatio', updates.autoDetectAspectRatio.toString())
        }
      }
      return newSettings
    })
    notifySettingsChange()
  }, [notifySettingsChange])

  const updateChatSettings = useCallback((updates: Partial<ChatSettings>) => {
    setChatSettings(prev => {
      const newSettings = { ...prev, ...updates }
      if (typeof window !== 'undefined') {
        localStorage.setItem('chatSettings', JSON.stringify(newSettings))
      }
      return newSettings
    })
    notifySettingsChange()
  }, [notifySettingsChange])

  // Debug logging
  useEffect(() => {
    console.log('[Settings Context] Current settings:', {
      image: imageSettings,
      video: videoSettings,
      chat: chatSettings
    })
  }, [imageSettings, videoSettings, chatSettings])

  // Set loading to false after initial mount
  useEffect(() => {
    setIsLoading(false)
    console.log('[SettingsContext] Settings loaded and ready')
  }, [])

  return (
    <SettingsContext.Provider value={{
      isLoading,
      imageSettings,
      updateImageSettings,
      videoSettings,
      updateVideoSettings,
      chatSettings,
      updateChatSettings,
      onSettingsChange
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

// Hook for components that only need image settings
export function useImageSettings() {
  const { imageSettings, updateImageSettings } = useSettings()
  return { settings: imageSettings, updateSettings: updateImageSettings }
}

// Hook for components that only need video settings
export function useVideoSettings() {
  const { videoSettings, updateVideoSettings } = useSettings()
  return { settings: videoSettings, updateSettings: updateVideoSettings }
}

// Hook for components that only need chat settings
export function useChatSettings() {
  const { chatSettings, updateChatSettings } = useSettings()
  return { settings: chatSettings, updateSettings: updateChatSettings }
}
