import { useRef, useCallback, useEffect, useState } from 'react'

// Global audio context to share across all audio elements
let globalAudioContext: AudioContext | null = null
const audioNodeMap = new WeakMap<HTMLAudioElement, { source: MediaElementAudioSourceNode, gainNode: GainNode }>()

export function useWebAudioVolume(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const gainNodeRef = useRef<GainNode | null>(null)
  const volumeRef = useRef<number>(1)
  const [isInitialized, setIsInitialized] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  
  // Initialize Web Audio API
  const initializeWebAudio = useCallback(() => {
    if (!audioRef.current) return false
    
    try {
      // Check if already connected
      const existingNode = audioNodeMap.get(audioRef.current)
      if (existingNode) {
        console.log('[WebAudio] Reusing existing connection')
        gainNodeRef.current = existingNode.gainNode
        setIsInitialized(true)
        return true
      }
      
      // Get or create global audio context
      if (!globalAudioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) {
          console.error('[WebAudio] Web Audio API not supported')
          setUseFallback(true)
          return false
        }
        globalAudioContext = new AudioContextClass()
        console.log('[WebAudio] Created global AudioContext')
      }
      
      // Resume context if suspended (requires user interaction)
      if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
          console.log('[WebAudio] AudioContext resumed')
        })
      }
      
      // Create source node for this audio element
      const source = globalAudioContext.createMediaElementSource(audioRef.current)
      const gainNode = globalAudioContext.createGain()
      
      // Connect: source -> gain -> destination
      source.connect(gainNode)
      gainNode.connect(globalAudioContext.destination)
      
      // Store the nodes
      audioNodeMap.set(audioRef.current, { source, gainNode })
      gainNodeRef.current = gainNode
      
      // Set initial volume
      gainNode.gain.value = volumeRef.current
      
      // IMPORTANT: Keep audio element at full volume when using Web Audio
      audioRef.current.volume = 1
      
      console.log('[WebAudio] Successfully connected audio element')
      setIsInitialized(true)
      
      return true
    } catch (error) {
      console.error('[WebAudio] Initialization error:', error)
      // Fallback to native volume control
      setUseFallback(true)
      return false
    }
  }, [audioRef])
  
  // Set volume using gain node or fallback
  const setVolume = useCallback((volume: number) => {
    volumeRef.current = Math.max(0, Math.min(1, volume))
    
    // If using fallback or Web Audio not initialized, use native volume
    if (useFallback || !isInitialized) {
      if (audioRef.current) {
        // Only set volume if audio element exists and is ready
        try {
          audioRef.current.volume = volumeRef.current
          console.log('[WebAudio] Using native volume control:', volumeRef.current)
        } catch (error) {
          console.error('[WebAudio] Error setting native volume:', error)
        }
      }
      return
    }
    
    // Try to use Web Audio API
    if (gainNodeRef.current && globalAudioContext) {
      try {
        // Use exponential ramping for smoother volume changes
        const currentTime = globalAudioContext.currentTime
        gainNodeRef.current.gain.cancelScheduledValues(currentTime)
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, currentTime)
        
        // Handle volume 0 case for exponential ramp
        if (volumeRef.current === 0) {
          gainNodeRef.current.gain.linearRampToValueAtTime(0, currentTime + 0.03)
        } else {
          gainNodeRef.current.gain.exponentialRampToValueAtTime(
            volumeRef.current,
            currentTime + 0.03
          )
        }
        console.log('[WebAudio] Set Web Audio volume to:', volumeRef.current)
      } catch (error) {
        console.error('[WebAudio] Error setting volume:', error)
        // Fallback to native volume
        if (audioRef.current) {
          try {
            audioRef.current.volume = volumeRef.current
          } catch (e) {
            console.error('[WebAudio] Fallback volume error:', e)
          }
        }
      }
    } else if (audioRef.current) {
      // Fallback if gain node not available
      try {
        audioRef.current.volume = volumeRef.current
        console.log('[WebAudio] Fallback - using native volume:', volumeRef.current)
      } catch (error) {
        console.error('[WebAudio] Error setting fallback volume:', error)
      }
    }
  }, [audioRef, isInitialized, useFallback])
  
  // Initialize on first user interaction (play)
  const initializeOnInteraction = useCallback(() => {
    if (!isInitialized && !useFallback) {
      console.log('[WebAudio] Attempting initialization on user interaction')
      initializeWebAudio()
    }
  }, [isInitialized, useFallback, initializeWebAudio])
  
  // Set initial volume when audio element is ready
  useEffect(() => {
    if (audioRef.current && volumeRef.current !== 1) {
      // If using fallback or not initialized yet, set native volume
      if (useFallback || !isInitialized) {
        audioRef.current.volume = volumeRef.current
      }
    }
  }, [audioRef, useFallback, isInitialized])
  
  return {
    setVolume,
    isInitialized,
    isWebAudioActive: isInitialized && !useFallback,
    initializeOnInteraction,
    useFallback
  }
}
