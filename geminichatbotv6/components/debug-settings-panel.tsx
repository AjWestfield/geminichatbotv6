'use client'

import React, { useEffect, useState } from 'react'

export function DebugSettingsPanel() {
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if debug mode is enabled
    const debugMode = localStorage.getItem('debugSettings') === 'true'
    setIsVisible(debugMode)

    if (!debugMode) return

    const updateSettings = () => {
      const allSettings: Record<string, any> = {}
      
      // Get all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key)
          allSettings[key] = value
        }
      }
      
      setSettings(allSettings)
    }

    // Initial update
    updateSettings()

    // Listen for storage events
    window.addEventListener('storage', updateSettings)

    // Poll for changes (for same-window updates)
    const interval = setInterval(updateSettings, 1000)

    return () => {
      window.removeEventListener('storage', updateSettings)
      clearInterval(interval)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-md">
      <div className="bg-black/90 backdrop-blur-sm border border-green-500/50 rounded-lg p-4 text-xs font-mono">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-green-400 font-bold">🐛 Settings Debug Panel</h3>
          <button
            onClick={() => {
              localStorage.removeItem('debugSettings')
              setIsVisible(false)
            }}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <div className="text-blue-400">Image Settings:</div>
          <div className="pl-2 text-gray-300">
            <div>Model: <span className="text-yellow-300">{settings.imageGenerationModel || 'not set'}</span></div>
            <div>Edit Model: <span className="text-yellow-300">{settings.imageEditingModel || 'not set'}</span></div>
            <div>Style: <span className="text-yellow-300">{settings.imageStyle || 'not set'}</span></div>
            <div>Size: <span className="text-yellow-300">{settings.imageSize || 'not set'}</span></div>
            <div>Quality: <span className="text-yellow-300">{settings.imageQuality || 'not set'}</span></div>
          </div>
          
          <div className="text-blue-400 mt-2">Video Settings:</div>
          <div className="pl-2 text-gray-300">
            <div>Model: <span className="text-yellow-300">{settings.videoModel || 'not set'}</span></div>
            <div>Duration: <span className="text-yellow-300">{settings.videoDuration || 'not set'}</span></div>
            <div>Aspect: <span className="text-yellow-300">{settings.videoAspectRatio || 'not set'}</span></div>
          </div>
          
          <div className="text-blue-400 mt-2">Chat Settings:</div>
          <div className="pl-2 text-gray-300">
            <div>Model: <span className="text-yellow-300">{settings.selectedModel || 'not set'}</span></div>
          </div>
          
          <div className="text-green-400 mt-3 text-[10px]">
            Last Update: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to enable debug mode from console
if (typeof window !== 'undefined') {
  (window as any).enableSettingsDebug = () => {
    localStorage.setItem('debugSettings', 'true')
    window.location.reload()
  }
  
  (window as any).disableSettingsDebug = () => {
    localStorage.removeItem('debugSettings')
    window.location.reload()
  }
}