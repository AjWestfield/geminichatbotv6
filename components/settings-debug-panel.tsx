'use client'

import { useEffect, useState } from 'react'
import { useSettings } from '@/lib/contexts/settings-context'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SettingsDebugPanel() {
  const [localStorage, setLocalStorage] = useState<Record<string, any>>({})
  const { isLoading, imageSettings, videoSettings, chatSettings } = useSettings()

  useEffect(() => {
    const loadLocalStorage = () => {
      if (typeof window === 'undefined') return
      
      const storage: Record<string, any> = {}
      
      // Load unified settings
      try {
        const imageUnified = window.localStorage.getItem('imageGenerationSettings')
        if (imageUnified) storage.imageGenerationSettings = JSON.parse(imageUnified)
      } catch (e) {
        storage.imageGenerationSettings = 'PARSE_ERROR'
      }
      
      // Load individual keys
      const individualKeys = [
        'imageGenerationModel',
        'imageEditingModel',
        'imageStyle',
        'imageSize',
        'imageQuality',
        'videoModel',
        'videoDuration',
        'videoAspectRatio'
      ]
      
      individualKeys.forEach(key => {
        const value = window.localStorage.getItem(key)
        if (value) storage[key] = value
      })
      
      setLocalStorage(storage)
    }
    
    // Load initially
    loadLocalStorage()
    
    // Listen for storage changes
    const handleStorageChange = () => loadLocalStorage()
    window.addEventListener('storage', handleStorageChange)
    
    // Refresh every 2 seconds
    const interval = setInterval(loadLocalStorage, 2000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 p-4 max-w-md z-50 bg-black/90 backdrop-blur">
      <h3 className="text-sm font-bold mb-2">Settings Debug Panel</h3>
      
      <div className="space-y-2 text-xs">
        <div>
          <Badge variant={isLoading ? "destructive" : "default"}>
            {isLoading ? 'Loading...' : 'Ready'}
          </Badge>
        </div>
        
        <div className="border-t pt-2">
          <p className="font-semibold">Context Values:</p>
          <pre className="text-[10px] overflow-auto max-h-32">
            {JSON.stringify({
              image: imageSettings,
              video: videoSettings,
              chat: chatSettings
            }, null, 2)}
          </pre>
        </div>
        
        <div className="border-t pt-2">
          <p className="font-semibold">LocalStorage:</p>
          <pre className="text-[10px] overflow-auto max-h-32">
            {JSON.stringify(localStorage, null, 2)}
          </pre>
        </div>
        
        <div className="border-t pt-2">
          <p className="font-semibold">Sync Status:</p>
          <div className="space-y-1">
            <p>
              Model: {imageSettings.model === localStorage.imageGenerationModel ? 
                <Badge variant="default" className="ml-1">✓ Synced</Badge> : 
                <Badge variant="destructive" className="ml-1">✗ Out of Sync</Badge>
              }
            </p>
            <p>
              Unified vs Individual: {
                localStorage.imageGenerationSettings?.model === localStorage.imageGenerationModel ?
                <Badge variant="default" className="ml-1">✓ Match</Badge> :
                <Badge variant="destructive" className="ml-1">✗ Mismatch</Badge>
              }
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}