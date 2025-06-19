"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { AudioVolumeSlider } from "@/components/ui/audio-volume-slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Pause, SkipBack, SkipForward, Download, Volume2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { GeneratedAudio } from "./audio-gallery"
import { 
  generateWordTimestamps, 
  getCurrentWordIndex, 
  formatTimestamp,
  generateTimestampMarkers,
  type AudioSyncData
} from "@/lib/audio-sync-utils"
import { useWebAudioVolume } from "@/hooks/use-web-audio-volume"

interface AudioFocusModalProps {
  audio: GeneratedAudio | null
  isOpen: boolean
  onClose: () => void
}

export function AudioFocusModal({ audio, isOpen, onClose }: AudioFocusModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [syncData, setSyncData] = useState<AudioSyncData | null>(null)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const animationFrameRef = useRef<number | null>(null)
  const [volumeState, setVolumeState] = useState(() => {
    // Load saved volume from localStorage
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('audioPlayerVolume')
      return savedVolume ? parseFloat(savedVolume) : 1
    }
    return 1
  })
  
  // Initialize Web Audio volume control
  const { setVolume, isWebAudioActive, initializeOnInteraction } = useWebAudioVolume(audioRef)
  
  // Initialize audio and sync data when modal opens
  useEffect(() => {
    if (isOpen && audio && audioRef.current) {
      console.log('[AudioFocusModal] Initializing audio', {
        audioId: audio.id,
        mimeType: audio.mimeType,
        base64Length: audio.audioBase64?.length || 0,
        hasScript: !!audio.script,
        hasText: !!audio.text
      })
      
      const audioEl = audioRef.current
      setIsLoading(true)
      setAudioError(null)
      setSyncData(null)
      setCurrentTime(0)
      setDuration(0)
      
      try {
        // Validate base64 data
        if (!audio.audioBase64) {
          throw new Error('No audio data available')
        }
        
        // Clean base64 data (remove any whitespace/newlines and data URL prefix if present)
        let cleanBase64 = audio.audioBase64.replace(/\s/g, '')
        
        // Remove data URL prefix if it exists
        const dataUrlPrefix = /^data:audio\/[^;]+;base64,/
        if (dataUrlPrefix.test(cleanBase64)) {
          cleanBase64 = cleanBase64.replace(dataUrlPrefix, '')
        }
        
        // Validate base64 string
        try {
          // Test if base64 is valid by attempting to decode a small portion
          const testDecode = atob(cleanBase64.substring(0, 100))
          console.log('[AudioFocusModal] Base64 validation passed, test decode length:', testDecode.length)
        } catch (e) {
          console.error('[AudioFocusModal] Invalid base64 data:', e)
          console.error('[AudioFocusModal] First 100 chars of base64:', cleanBase64.substring(0, 100))
          throw new Error('Invalid audio data format')
        }
        
        // Create data URL
        const dataUrl = `data:${audio.mimeType || 'audio/mpeg'};base64,${cleanBase64}`
        console.log('[AudioFocusModal] Setting audio source', {
          originalLength: audio.audioBase64.length,
          cleanLength: cleanBase64.length,
          dataUrlLength: dataUrl.length,
          mimeType: audio.mimeType || 'audio/mpeg',
          first50Chars: cleanBase64.substring(0, 50),
          hasDataUrlPrefix: dataUrlPrefix.test(audio.audioBase64)
        })
        
        // Event handlers – create before setting src so we don’t miss early events
        const handleCanPlay = () => {
          console.log('[AudioFocusModal] Audio can play')
          setIsLoading(false)
        }
        
        const handleLoadedMetadata = () => {
          console.log('[AudioFocusModal] Metadata loaded', {
            duration: audioEl.duration,
            readyState: audioEl.readyState
          })
          
          const audioDuration = audioEl.duration
          if (!isNaN(audioDuration) && isFinite(audioDuration) && audioDuration > 0) {
            setDuration(audioDuration)
            
            // Generate sync data from transcript
            const transcript = audio.script || audio.text
            if (transcript) {
              console.log('[AudioFocusModal] Generating word timestamps', {
                transcriptLength: transcript.length,
                duration: audioDuration
              })
              const syncData = generateWordTimestamps(transcript, audioDuration)
              setSyncData(syncData)
              console.log('[AudioFocusModal] Generated sync data', {
                wordCount: syncData.words.length
              })
            }
          } else {
            console.error('[AudioFocusModal] Invalid or zero duration:', audioDuration)
            // Don't set error, just proceed without sync data
            // The transcript will still be shown without highlighting
          }
          setIsLoading(false)
        }
        
        const handleError = (e: Event) => {
          const target = e.target as HTMLAudioElement
          const error = target.error
          let errorMessage = 'Unknown audio error'
          
          if (error) {
            const errorMessages: Record<number, string> = {
              [MediaError.MEDIA_ERR_ABORTED]: 'Audio loading was aborted',
              [MediaError.MEDIA_ERR_NETWORK]: 'Network error while loading audio',
              [MediaError.MEDIA_ERR_DECODE]: 'Audio decoding error',
              [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: 'Audio format not supported'
            }
            errorMessage = errorMessages[error.code] || `Media error code: ${error.code}`
          }
          
          console.error('[AudioFocusModal] Audio error:', errorMessage, error)
          setAudioError(errorMessage)
          setIsLoading(false)
        }
        
        // Attach listeners first
        audioEl.addEventListener('canplay', handleCanPlay)
        audioEl.addEventListener('loadedmetadata', handleLoadedMetadata)
        audioEl.addEventListener('error', handleError)
        
        // Initialize volume with Web Audio
        setVolume(volumeState)
        
        // Now assign source and load
        audioEl.src = dataUrl
        audioEl.load()
        
        // Additional debug listeners
        audioEl.addEventListener('loadstart', () => console.log('[AudioFocusModal] Load started'))
        audioEl.addEventListener('progress', () => console.log('[AudioFocusModal] Loading progress'))
        audioEl.addEventListener('stalled', () => console.log('[AudioFocusModal] Loading stalled'))
        audioEl.addEventListener('suspend', () => console.log('[AudioFocusModal] Loading suspended'))
        audioEl.addEventListener('waiting', () => console.log('[AudioFocusModal] Waiting for data'))
        
        // Fallback timeout to ensure transcript is shown even if audio doesn't load
        const fallbackTimeout = setTimeout(() => {
          if (audioRef.current) {
            const audioEl = audioRef.current
            // Check if audio is still loading
            if (audioEl.readyState < 2) { // HAVE_CURRENT_DATA
              console.log('[AudioFocusModal] Fallback timeout - audio not loaded, showing transcript')
              setIsLoading(false)
              // Try to generate sync data with estimated duration
              const transcript = audio.script || audio.text
              if (transcript) {
                // Estimate duration based on text length (average speaking rate)
                const wordCount = transcript.split(/\s+/).length
                const estimatedDuration = wordCount / 2.5 // 2.5 words per second average
                console.log('[AudioFocusModal] Using estimated duration:', estimatedDuration)
                const estimatedSyncData = generateWordTimestamps(transcript, estimatedDuration)
                setSyncData(estimatedSyncData)
                setDuration(estimatedDuration)
              }
            }
          }
        }, 3000) // 3 second timeout
        
        // Cleanup listeners on unmount or when audio changes
        return () => {
          audioEl.pause()
          audioEl.removeAttribute('src')
          audioEl.load()
          audioEl.removeEventListener('canplay', handleCanPlay)
          audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
          audioEl.removeEventListener('error', handleError)
          // Remove debug listeners
          audioEl.removeEventListener('loadstart', () => {})
          audioEl.removeEventListener('progress', () => {})
          audioEl.removeEventListener('stalled', () => {})
          audioEl.removeEventListener('suspend', () => {})
          audioEl.removeEventListener('waiting', () => {})
          clearTimeout(fallbackTimeout)
        }
      } catch (error) {
        console.error('[AudioFocusModal] Error setting up audio:', error)
        setAudioError('Failed to set up audio: ' + (error as Error).message)
        setIsLoading(false)
      }
    }
  }, [isOpen, audio, volumeState, setVolume])
  
  // Update playback time with animation frame for smooth highlighting
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      const updateTime = () => {
        if (audioRef.current && syncData) {
          const time = audioRef.current.currentTime
          setCurrentTime(time)
          
          // Update current word
          const wordIndex = getCurrentWordIndex(syncData.words, time)
          if (wordIndex !== currentWordIndex) {
            setCurrentWordIndex(wordIndex)
            scrollToWord(wordIndex)
          }
        }
        
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateTime)
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(updateTime)
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isPlaying, syncData, currentWordIndex])
  
  // Scroll to highlighted word
  const scrollToWord = (index: number) => {
    if (transcriptRef.current) {
      const wordElement = transcriptRef.current.querySelector(`[data-word-index="${index}"]`)
      if (wordElement) {
        wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }
  
  // Playback controls
  const togglePlayPause = () => {
    if (audioRef.current && !audioError && !isLoading) {
      const audio = audioRef.current
      if (audio.paused) {
        // Initialize Web Audio on first play (requires user interaction)
        initializeOnInteraction()
        
        audio.play().then(() => setIsPlaying(true)).catch(err => {
          console.error('[AudioFocusModal] Play error:', err)
          setAudioError('Failed to play audio: ' + err.message)
        })
      } else {
        audio.pause()
        setIsPlaying(false)
      }
    }
  }
  
  const seekTo = (time: number) => {
    if (audioRef.current && !audioError) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }
  
  const skipBack = () => seekTo(Math.max(0, currentTime - 10))
  const skipForward = () => seekTo(Math.min(duration, currentTime + 10))
  
  const handleSeek = (value: number[]) => {
    seekTo(value[0])
  }
  
  // Handle audio end
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const handleEnded = () => setIsPlaying(false)
      audio.addEventListener('ended', handleEnded)
      return () => audio.removeEventListener('ended', handleEnded)
    }
  }, [])
  
  // Download audio
  const handleDownload = async () => {
    if (!audio) return
    
    try {
      const date = new Date(audio.timestamp).toISOString().split('T')[0]
      const voiceName = audio.voiceName?.toLowerCase().replace(/\s+/g, '-') || 'audio'
      const filename = `tts_${voiceName}_${date}_${audio.id.slice(-8)}.mp3`
      
      // Convert base64 to blob
      const byteCharacters = atob(audio.audioBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: audio.mimeType || 'audio/mpeg' })
      
      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[AudioFocusModal] Download error:', error)
    }
  }
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolumeState(newVolume)
    setVolume(newVolume)
    
    // Save volume preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('audioPlayerVolume', newVolume.toString())
    }
  }
  
  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setCurrentTime(0)
      setCurrentWordIndex(-1)
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [isOpen])
  
  if (!audio) return null
  
  const timestampMarkers = syncData ? generateTimestampMarkers(syncData.words) : []
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        console.log('[AudioFocusModal] Modal closing, resetting state')
        setIsPlaying(false)
        setCurrentTime(0)
        setCurrentWordIndex(-1)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        onClose()
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold flex items-center justify-between">
            <span>Audio Player</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{audio.voiceName || 'Unknown Voice'}</span>
              <span>•</span>
              <span>{formatDistanceToNow(audio.timestamp, { addSuffix: true })}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* Error display */}
          {audioError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-md text-sm">
              {audioError}
            </div>
          )}
          
          {/* Audio Player Controls */}
          <div className="bg-secondary/20 rounded-lg p-4 space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer"
                disabled={isLoading || !!audioError}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTimestamp(currentTime)}</span>
                <span>{formatTimestamp(duration)}</span>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipBack}
                  className="h-10 w-10"
                  disabled={isLoading || !!audioError}
                >
                  <SkipBack className="h-5 w-5" />
                </Button>
                
                <Button
                  variant="default"
                  size="icon"
                  onClick={togglePlayPause}
                  className="h-12 w-12"
                  disabled={isLoading || !!audioError}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6 ml-0.5" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={skipForward}
                  className="h-10 w-10"
                  disabled={isLoading || !!audioError}
                >
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Volume Control */}
              <div className="flex items-center gap-2" title={`Volume: ${Math.round(volumeState * 100)}% (${isWebAudioActive ? 'Web Audio' : 'Native'})`}>
                <Volume2 className="h-4 w-4 text-gray-400" />
                <div className="w-24">
                  <AudioVolumeSlider
                    value={[volumeState]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="cursor-pointer"
                    disabled={isLoading || !!audioError}
                  />
                </div>
                <span className="text-xs text-gray-500 min-w-[35px]">
                  {Math.round(volumeState * 100)}%
                </span>
              </div>
            </div>
            
            {/* Download Button */}
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
          
          {/* Tabs for Transcript and Timestamps */}
          <Tabs defaultValue="transcript" className="flex-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="timestamps">Timestamps</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="mt-4">
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div ref={transcriptRef} className="text-sm leading-relaxed">
                  {syncData ? (
                    <p>
                      {syncData.words.map((wordData, index) => (
                        <span
                          key={index}
                          data-word-index={index}
                          className={`inline-block px-0.5 transition-all duration-200 ${
                            index === currentWordIndex
                              ? 'bg-primary text-primary-foreground rounded px-1 scale-110'
                              : index < currentWordIndex
                              ? 'opacity-60'
                              : ''
                          }`}
                        >
                          {wordData.word}
                          {index < syncData.words.length - 1 && ' '}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <div>
                      {isLoading && (
                        <p className="text-muted-foreground text-xs mb-2">Audio is loading...</p>
                      )}
                      <p className="whitespace-pre-wrap">
                        {audio.script || audio.text || "No transcript available"}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="timestamps" className="mt-4">
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4 space-y-2">
                  {timestampMarkers.length > 0 ? (
                    timestampMarkers.map((marker, index) => (
                      <button
                        key={index}
                        onClick={() => seekTo(marker.time)}
                        className={`w-full text-left p-2 rounded-md hover:bg-secondary/50 transition-colors ${
                          currentTime >= marker.time && 
                          (index === timestampMarkers.length - 1 || currentTime < timestampMarkers[index + 1]?.time)
                            ? 'bg-secondary'
                            : ''
                        }`}
                        disabled={isLoading || !!audioError}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatTimestamp(marker.time)}
                          </span>
                          <span className="text-sm flex-1">{marker.text}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      {isLoading ? "Loading timestamps..." : "No timestamps available"}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Hidden audio element */}
        <audio 
          ref={audioRef} 
          preload="auto"
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onEnded={() => setIsPlaying(false)}
        />
      </DialogContent>
    </Dialog>
  )
}