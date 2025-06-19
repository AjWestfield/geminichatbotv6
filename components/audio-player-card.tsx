import React, { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AudioSlider } from "@/components/ui/audio-slider"
import { AudioVolumeSlider } from "@/components/ui/audio-volume-slider"
import { Progress } from "@/components/ui/progress"
import { ChevronDown, ChevronUp, Clock, Download, Loader2, Pause, Play, SkipBack, SkipForward, Trash2, Volume2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
  generateWordTimestamps,
  getCurrentWordIndex,
  formatTimestamp,
  generateTimestampMarkers,
  type AudioSyncData
} from "@/lib/audio-sync-utils"
import { useWebAudioVolume } from "@/hooks/use-web-audio-volume"

interface AudioPlayerCardProps {
  id: string
  audioBase64?: string
  mimeType?: string
  text: string
  voiceName: string
  timestamp: number
  duration?: number
  isGenerating: boolean
  generationProgress?: number
  provider?: string
  onDelete?: () => void
  onRetry?: () => void
  error?: string
  script?: string
}

export function AudioPlayerCard({
  id,
  audioBase64,
  mimeType = "audio/mpeg",
  text,
  voiceName,
  timestamp,
  duration: initialDuration,
  isGenerating,
  generationProgress = 0,
  provider = "default",
  onDelete,
  onRetry,
  error,
  script
}: AudioPlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [showTranscript, setShowTranscript] = useState(true)
  const [syncData, setSyncData] = useState<AudioSyncData | null>(null)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(true)
  const [audioError, setAudioError] = useState<string | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [isSeeking, setIsSeeking] = useState(false)
  const [displayTime, setDisplayTime] = useState(0) // Separate display time for smooth UI during seeking
  const wasPlayingBeforeSeek = useRef(false) // Track playback state before seeking
  const [volume, setVolumeState] = useState(() => {
    // Load saved volume from localStorage
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('audioPlayerVolume')
      return savedVolume ? parseFloat(savedVolume) : 1
    }
    return 1
  })

  // Initialize Web Audio volume control
  const { setVolume, isWebAudioActive, initializeOnInteraction } = useWebAudioVolume(audioRef)

  // Create audio URL from base64
  const audioUrl = audioBase64 ? `data:${mimeType};base64,${audioBase64}` : null

  // Sync display time with current time when not seeking
  useEffect(() => {
    if (!isSeeking) {
      setDisplayTime(currentTime)
    }
  }, [currentTime, isSeeking])

  // Initialize audio element with improved timing
  useEffect(() => {
    if (audioUrl && audioRef.current && !isGenerating) {
      const audio = audioRef.current

      const handleLoadedMetadata = () => {
        setIsLoading(false)
        const audioDuration = audio.duration
        if (!isNaN(audioDuration) && isFinite(audioDuration) && audioDuration > 0) {
          setDuration(audioDuration)

          // Generate sync data with voice-specific adjustments
          const generatedSyncData = generateWordTimestamps(text, audioDuration)

          // Apply voice-specific timing adjustments
          if (voiceName.toLowerCase() === 'eva') {
            // Eva tends to speak slightly faster with shorter pauses
            generatedSyncData.words.forEach(word => {
              word.startTime *= 0.95
              word.endTime *= 0.95
            })
          } else if (voiceName.toLowerCase() === 'will') {
            // Will has a more deliberate pace
            generatedSyncData.words.forEach(word => {
              word.startTime *= 1.02
              word.endTime *= 1.02
            })
          }

          setSyncData(generatedSyncData)
        }
      }

      const handleError = () => {
        setIsLoading(false)
        setAudioError("Failed to load audio")
      }

      const handleCanPlay = () => {
        setIsLoading(false)
      }

      // Pre-load audio to reduce latency
      audio.preload = 'auto'

      // Handle seeking events for smoother experience
      const handleSeeking = () => {
        // Audio is seeking, prevent pause events
        if (!audio.paused && wasPlayingBeforeSeek.current === false) {
          wasPlayingBeforeSeek.current = true
        }
      }

      const handleSeeked = () => {
        // Seeking completed, ensure playback continues if it was playing
        if (syncData) {
          const wordIndex = getCurrentWordIndex(syncData.words, audio.currentTime + 0.1)
          setCurrentWordIndex(wordIndex)
        }

        // Force resume if it was playing before seek
        if (wasPlayingBeforeSeek.current && audio.paused) {
          audio.play().catch(err => {
            console.error('[AudioPlayerCard] Auto-resume after browser seek:', err)
          })
        }
      }

      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('error', handleError)
      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('seeking', handleSeeking)
      audio.addEventListener('seeked', handleSeeked)
      audio.src = audioUrl

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('error', handleError)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('seeking', handleSeeking)
        audio.removeEventListener('seeked', handleSeeked)
      }
    }
  }, [audioUrl, text, isGenerating, voiceName])

  // Update playback time for word highlighting with improved responsiveness
  useEffect(() => {
    if (isPlaying && audioRef.current && syncData && !isSeeking) {
      let lastUpdateTime = 0
      const updateInterval = 50 // Update every 50ms for smoother highlighting

      const updateTime = () => {
        if (audioRef.current && syncData && !isSeeking) {
          const currentAudioTime = audioRef.current.currentTime
          const now = performance.now()

          // Only update if enough time has passed to avoid excessive updates
          if (now - lastUpdateTime >= updateInterval) {
            setCurrentTime(currentAudioTime)

            // Add a small look-ahead buffer (100ms) so words highlight slightly early
            // This compensates for any processing delay and feels more natural
            const bufferedTime = currentAudioTime + 0.1

            // Find the word that should be highlighted
            const wordIndex = getCurrentWordIndex(syncData.words, bufferedTime)

            if (wordIndex !== currentWordIndex) {
              setCurrentWordIndex(wordIndex)

              // Smooth scroll to highlighted word with debouncing
              if (transcriptRef.current && wordIndex >= 0) {
                const wordElement = transcriptRef.current.querySelector(`[data-word-index="${wordIndex}"]`)
                if (wordElement) {
                  // Check if element is already visible to avoid unnecessary scrolling
                  const container = transcriptRef.current
                  const elementRect = wordElement.getBoundingClientRect()
                  const containerRect = container.getBoundingClientRect()

                  const isVisible =
                    elementRect.top >= containerRect.top &&
                    elementRect.bottom <= containerRect.bottom

                  if (!isVisible) {
                    wordElement.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    })
                  }
                }
              }
            }

            lastUpdateTime = now
          }
        }

        if (isPlaying && !isSeeking) {
          animationFrameRef.current = requestAnimationFrame(updateTime)
        }
      }

      // Start the update loop
      animationFrameRef.current = requestAnimationFrame(updateTime)

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isPlaying, syncData, currentWordIndex, isSeeking])

  // Playback controls
  const togglePlayPause = () => {
    if (audioRef.current && !isLoading && !audioError && !isGenerating) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        // Initialize Web Audio on first play (requires user interaction)
        initializeOnInteraction()

        audioRef.current.play().catch(err => {
          console.error('[AudioPlayerCard] Play error:', err)
          setAudioError('Failed to play audio')
        })
        setIsPlaying(true)
      }
    }
  }

  const seekTo = (time: number, resumePlayback: boolean = false) => {
    if (audioRef.current) {
      const wasPlaying = resumePlayback || isPlaying || !audioRef.current.paused

      // Store the playback state before seeking
      const shouldResume = wasPlaying

      // Update the current time
      audioRef.current.currentTime = time
      setCurrentTime(time)

      // Force resume playback if it was playing
      if (shouldResume) {
        // Use a small timeout to ensure the seek completes first
        setTimeout(() => {
          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(err => {
              console.error('[AudioPlayerCard] Resume after seek error:', err)
            })
            setIsPlaying(true)
          }
        }, 10)
      }
    }
  }

  const skipBack = () => seekTo(Math.max(0, currentTime - 10), true)
  const skipForward = () => seekTo(Math.min(duration, currentTime + 10), true)

  // Handle slider drag (visual only, no audio seeking)
  const handleSeekChange = (value: number[]) => {
    const newTime = value[0]

    // On first drag, store the playback state
    if (!isSeeking && audioRef.current) {
      wasPlayingBeforeSeek.current = !audioRef.current.paused
    }

    setIsSeeking(true)
    setDisplayTime(newTime) // Update display only
  }

  // Handle slider release (actual audio seeking)
  const handleSeekCommit = (value: number[]) => {
    const newTime = value[0]

    if (audioRef.current) {
      // Use the stored playback state from before seeking started
      const shouldResume = wasPlayingBeforeSeek.current

      // Perform the actual seek
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
      setDisplayTime(newTime)

      // Resume playback if it was playing before
      if (shouldResume) {
        // Ensure audio resumes immediately
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true)
            console.log('[AudioPlayerCard] Playback resumed successfully')
          })
          .catch(err => {
            console.error('[AudioPlayerCard] Failed to resume:', err)
            // Retry with interaction context
            setIsPlaying(false)
          })
      }
    }

    setIsSeeking(false)
    wasPlayingBeforeSeek.current = false // Reset the flag
  }

  // Download audio
  const handleDownload = async () => {
    if (!audioBase64) return

    try {
      const date = new Date(timestamp).toISOString().split('T')[0]
      const cleanVoiceName = voiceName.toLowerCase().replace(/\s+/g, '-')
      const filename = `tts_${cleanVoiceName}_${date}_${id.slice(-8)}.mp3`

      // Convert base64 to blob
      const byteCharacters = atob(audioBase64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

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
      console.error('[AudioPlayerCard] Download error:', error)
    }
  }

  // Generate timestamp markers for "jump to" feature
  const timestampMarkers = syncData ? generateTimestampMarkers(syncData.words, 10) : []

  // Handle word click to jump to position
  const handleWordClick = (wordIndex: number) => {
    if (syncData && audioRef.current) {
      const word = syncData.words[wordIndex]
      if (word) {
        seekTo(word.startTime, true) // Always resume playback when clicking a word
      }
    }
  }

  // Handle volume change with throttling
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0]
    setVolumeState(newVolume)
    setVolume(newVolume)
  }, [setVolume])

  // Throttled localStorage save for volume
  const saveVolumeToStorage = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null
      return (volume: number) => {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('audioPlayerVolume', volume.toString())
          }
        }, 500)
      }
    })(),
    []
  )

  // Save volume to localStorage when volume changes (throttled)
  useEffect(() => {
    saveVolumeToStorage(volume)
  }, [volume, saveVolumeToStorage])

  // Apply initial volume when audio is ready
  useEffect(() => {
    if (audioRef.current && !isGenerating && audioUrl) {
      // Set initial volume
      setVolume(volume)
    }
  }, [audioUrl, isGenerating, volume, setVolume])

  // Calculate which word should be highlighted based on display time during seeking
  const highlightWordIndex = isSeeking && syncData
    ? getCurrentWordIndex(syncData.words, displayTime + 0.1)
    : currentWordIndex

  return (
    <Card className="bg-[#2B2B2B] border-[#333333] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-white mb-1">
              {isGenerating ? "Generating Audio" : "Audio Ready"}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{voiceName}</span>
              <span>•</span>
              <span>{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
              {provider === "wavespeed" && (
                <>
                  <span>•</span>
                  <span className="text-blue-400">WaveSpeed Dia TTS</span>
                </>
              )}
              {script && script.includes('[S2]') && (
                <>
                  <span>•</span>
                  <span className="text-purple-400">Multi-Speaker</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isGenerating && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="h-8 w-8 text-gray-400 hover:text-white"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 text-gray-400 hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Generation Progress or Error */}
        {error ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-red-400 mb-2">Failed to generate audio</p>
              <p className="text-xs text-gray-400 mb-3">{error}</p>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="border-red-500/20 hover:bg-red-500/10"
                >
                  <Loader2 className="w-4 h-4 mr-2" />
                  Retry Generation
                </Button>
              )}
            </div>
          </div>
        ) : isGenerating ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-sm text-gray-300">Processing with WaveSpeed Dia TTS</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Progress</span>
                <span className="text-gray-400">{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="h-2 bg-gray-700" />
              {generationProgress < 30 && (
                <p className="text-xs text-gray-500">Initializing WaveSpeed API...</p>
              )}
              {generationProgress >= 30 && generationProgress < 70 && (
                <p className="text-xs text-gray-500">Generating speech synthesis...</p>
              )}
              {generationProgress >= 70 && (
                <p className="text-xs text-gray-500">Finalizing audio...</p>
              )}
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{text}</p>
          </div>
        ) : (
          <>
            {/* Audio Player Controls */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <AudioSlider
                  value={[displayTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeekChange}
                  onValueCommit={handleSeekCommit}
                  className="cursor-pointer"
                  disabled={isLoading || !!audioError}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{formatTimestamp(displayTime)}</span>
                  <span>{formatTimestamp(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipBack}
                    className="h-8 w-8"
                    disabled={isLoading || !!audioError}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="default"
                    size="icon"
                    onClick={togglePlayPause}
                    className="h-10 w-10"
                    disabled={isLoading || !!audioError}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={skipForward}
                    className="h-8 w-8"
                    disabled={isLoading || !!audioError}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-2" title={`Volume: ${Math.round(volume * 100)}% (${isWebAudioActive ? 'Web Audio' : 'Native'})`}>
                  <Volume2 className="h-4 w-4 text-gray-400" />
                  <div className="w-24">
                    <AudioVolumeSlider
                      value={[volume]}
                      max={1}
                      step={0.01}
                      onValueChange={handleVolumeChange}
                      className="cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-gray-500 min-w-[35px]">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {audioError && (
                <div className="text-sm text-red-400 text-center py-2">
                  {audioError}
                </div>
              )}
            </div>

            {/* Transcript Section */}
            <div className="mt-6 border-t border-gray-700 pt-4">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <h4 className="text-sm font-medium text-gray-300">Transcript</h4>
                {showTranscript ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {showTranscript && (
                <div className="space-y-4">
                  {/* Transcript with word highlighting */}
                  <div
                    ref={transcriptRef}
                    className="max-h-40 overflow-y-auto p-3 bg-[#1C1C1C] rounded-lg text-sm leading-relaxed"
                  >
                    {syncData ? (
                      <p>
                        {syncData.words.map((wordData, index) => (
                          <span
                            key={index}
                            data-word-index={index}
                            onClick={() => handleWordClick(index)}
                            className={`inline-block px-0.5 cursor-pointer hover:bg-gray-700 hover:rounded will-change-transform ${
                              index === highlightWordIndex
                                ? 'bg-blue-500/90 text-white rounded px-1.5 py-0.5 font-medium transform scale-105'
                                : index < highlightWordIndex
                                ? 'text-gray-500 opacity-70'
                                : 'text-gray-300'
                            }`}
                          >
                            {wordData.word}
                            {index < syncData.words.length - 1 && ' '}
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-gray-300 whitespace-pre-wrap">{text}</p>
                    )}
                  </div>

                  {/* Jump to timestamps */}
                  {timestampMarkers.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-gray-400">Jump to</h5>
                      <div className="flex flex-wrap gap-2">
                        {timestampMarkers.map((marker, index) => (
                          <button
                            key={index}
                            onClick={() => seekTo(marker.time, true)}
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 transition-colors ${
                              displayTime >= marker.time &&
                              (index === timestampMarkers.length - 1 || displayTime < timestampMarkers[index + 1]?.time)
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'text-gray-400'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(marker.time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && !isGenerating && (
        <audio
          ref={audioRef}
          onLoadedData={(e) => {
            console.log('[AudioPlayerCard] Audio loaded, setting initial volume:', volume)
            // Ensure volume is set when audio loads
            if (e.currentTarget) {
              setVolume(volume)
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onPause={(e) => {
            // Check if pause was triggered by user action vs browser/system
            const activeElement = document.activeElement
            const isVolumeSlider = activeElement?.closest('[role="slider"]') !== null

            console.log('[AudioPlayerCard] Pause event triggered', {
              isSeeking: isSeeking,
              isVolumeSlider: isVolumeSlider,
              wasPlayingBeforeSeek: wasPlayingBeforeSeek.current,
              activeElement: activeElement?.tagName
            })

            // Don't update playing state if we're seeking or adjusting volume
            if (!isSeeking && !isVolumeSlider) {
              setIsPlaying(false)
            }
          }}
          onPlay={() => setIsPlaying(true)}
          // Prevent interruptions from focus events
          onFocus={(e) => {
            e.currentTarget.blur()
          }}
        />
      )}
    </Card>
  )
}
