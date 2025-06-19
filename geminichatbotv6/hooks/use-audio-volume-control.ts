import { useRef, useCallback } from 'react'

export function useAudioVolumeControl(audioRef: React.RefObject<HTMLAudioElement>) {
  const originalPauseRef = useRef<(() => void) | null>(null)
  const isAdjustingVolumeRef = useRef(false)
  
  // Log that hook is initialized
  console.log('[useAudioVolumeControl] Hook initialized')
  
  const startVolumeAdjustment = useCallback(() => {
    console.log('[useAudioVolumeControl] Starting volume adjustment')
    isAdjustingVolumeRef.current = true
    
    if (audioRef.current && !audioRef.current.paused) {
      console.log('[useAudioVolumeControl] Audio is playing, intercepting pause')
      // Store the original pause method
      if (!originalPauseRef.current) {
        originalPauseRef.current = audioRef.current.pause.bind(audioRef.current)
      }
      
      // Override the pause method to prevent pausing during volume adjustment
      audioRef.current.pause = function() {
        console.log('[useAudioVolumeControl] Pause intercepted during volume adjustment')
        // Do nothing - prevent pause
      }
    }
  }, [audioRef])
  
  const endVolumeAdjustment = useCallback(() => {
    console.log('[useAudioVolumeControl] Ending volume adjustment')
    
    // Restore the original pause method after a short delay
    setTimeout(() => {
      isAdjustingVolumeRef.current = false
      
      if (audioRef.current && originalPauseRef.current) {
        audioRef.current.pause = originalPauseRef.current
        originalPauseRef.current = null
      }
    }, 200)
  }, [audioRef])
  
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused
      audioRef.current.volume = volume
      
      // Ensure audio continues playing if it was playing
      if (wasPlaying && audioRef.current.paused) {
        console.log('[useAudioVolumeControl] Resuming playback after volume change')
        audioRef.current.play().catch(err => {
          console.error('[useAudioVolumeControl] Failed to resume playback:', err)
        })
      }
    }
  }, [audioRef])
  
  return {
    startVolumeAdjustment,
    endVolumeAdjustment,
    setVolume,
    isAdjustingVolume: isAdjustingVolumeRef
  }
}
