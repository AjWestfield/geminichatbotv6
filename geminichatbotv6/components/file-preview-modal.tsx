import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileAudio, Download, Music, Video, Play, Sparkles, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration, formatFileSize, formatVideoDuration } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file: {
    name: string
    contentType: string
    url?: string
    prompt?: string
    transcription?: {
      text: string
      language?: string
      duration?: number
      segments?: Array<{
        start: number
        end: number
        text: string
      }>
    }
    videoThumbnail?: string
    videoDuration?: number
  }
  onAnimate?: (imageUrl: string, imageName: string) => void
  onEdit?: (imageUrl: string, imageName: string) => void
  onAnalyze?: (fileName: string, contentType: string) => void
  availableOptions?: ('analyze' | 'edit' | 'animate')[]
}

export function FilePreviewModal({ isOpen, onClose, file, onAnimate, onEdit, onAnalyze, availableOptions = ['analyze'] }: FilePreviewModalProps) {
  const isImage = file.contentType?.startsWith("image/")
  const isAudio = file.contentType?.startsWith("audio/")
  const isVideo = file.contentType?.startsWith("video/")

  const [currentTime, setCurrentTime] = useState(0)
  const [activeSegment, setActiveSegment] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Update active segment based on current playback time
  useEffect(() => {
    if (file.transcription?.segments) {
      const segment = file.transcription.segments.findIndex(
        seg => currentTime >= seg.start && currentTime <= seg.end
      )
      setActiveSegment(segment >= 0 ? segment : null)
    }
  }, [currentTime, file.transcription?.segments])

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
    setCurrentTime(e.currentTarget.currentTime)
  }
  const seekToSegment = (startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime
    } else if (audioRef.current) {
      audioRef.current.currentTime = startTime
    }
  }

  // Debug logging
  useEffect(() => {
    console.log('FilePreviewModal - file data:', {
      name: file.name,
      contentType: file.contentType,
      hasUrl: !!file.url,
      url: file.url,
      hasTranscription: !!file.transcription,
      transcriptionLength: file.transcription?.text?.length || 0,
      segmentCount: file.transcription?.segments?.length || 0,
      videoThumbnail: file.videoThumbnail,
      videoDuration: file.videoDuration
    })
  }, [file])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "bg-[#2B2B2B] border-[#333333] text-white",
        "w-[95vw] max-w-6xl h-[90vh] max-h-[90vh]",
        "sm:w-[90vw] sm:h-[85vh] sm:max-h-[85vh]",
        "md:w-[85vw] md:max-w-4xl",
        "lg:max-w-5xl xl:max-w-6xl",
        "flex flex-col overflow-hidden p-0"
      )}>
        <DialogHeader className="flex-shrink-0 p-3 sm:p-4 pb-2 border-b border-[#333333] file-preview-modal-header">
          <DialogTitle className="text-white flex items-center gap-2 text-sm sm:text-base truncate">
            {isVideo && <Video className="h-4 w-4 flex-shrink-0" />}
            {isAudio && <Music className="h-4 w-4 flex-shrink-0" />}
            <span className="truncate">{file.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 file-preview-modal-content">
          {isImage && file.url && (
            <div className="flex flex-col h-full">
              {/* Image Container - Optimized for better space usage */}
              <div className="flex-1 w-full flex items-center justify-center min-h-0 mb-3">
                <div className="relative w-full h-full max-h-[60vh] sm:max-h-[65vh] lg:max-h-[70vh] xl:max-h-[75vh] overflow-hidden rounded-lg bg-black/20 flex items-center justify-center">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-lg cursor-zoom-in"
                    onClick={(e) => {
                      // Toggle between contain and actual size on click
                      const img = e.currentTarget
                      if (img.style.maxWidth === '100%' || !img.style.maxWidth) {
                        img.style.maxWidth = 'none'
                        img.style.maxHeight = 'none'
                        img.style.cursor = 'zoom-out'
                        // Allow scrolling when zoomed
                        img.parentElement!.style.overflow = 'auto'
                      } else {
                        img.style.maxWidth = '100%'
                        img.style.maxHeight = '100%'
                        img.style.cursor = 'zoom-in'
                        img.parentElement!.style.overflow = 'hidden'
                      }
                    }}
                    title="Click to toggle zoom"
                  />
                </div>
              </div>

              {/* Prompt Text Section - Positioned underneath the image */}
              {file.prompt && (
                <div className="flex-shrink-0 w-full mb-3 px-2">
                  <div className="bg-black/30 rounded-lg p-3 border border-gray-600/30">
                    <h4 className="text-xs font-medium text-gray-400 mb-1">Prompt</h4>
                    <p className="text-sm text-gray-200 leading-relaxed">{file.prompt}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons - More prominent and better organized */}
              <div className="flex-shrink-0 w-full">
                <div className="flex flex-wrap gap-2 justify-center file-preview-modal-buttons">
                  {availableOptions.includes('edit') && onEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500/60 hover:bg-blue-500/20 text-blue-300 hover:text-blue-200 text-xs sm:text-sm font-medium"
                      onClick={() => {
                        if (file.url) {
                          onEdit(file.url, file.name)
                          onClose()
                        }
                      }}
                    >
                      <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Edit Image
                    </Button>
                  )}
                  {availableOptions.includes('animate') && onAnimate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/60 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 text-xs sm:text-sm"
                      onClick={() => {
                        if (file.url) {
                          onAnimate(file.url, file.name)
                          onClose()
                        }
                      }}
                    >
                      <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Animate
                    </Button>
                  )}
                  {availableOptions.includes('analyze') && onAnalyze && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500/60 hover:bg-green-500/20 text-green-300 hover:text-green-200 text-xs sm:text-sm"
                      onClick={() => {
                        onAnalyze(file.name, file.contentType)
                        onClose()
                      }}
                    >
                      <span className="text-sm sm:text-base mr-1 sm:mr-2">🔍</span>
                      Analyze
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-500/60 hover:bg-gray-500/20 text-gray-300 hover:text-gray-200 text-xs sm:text-sm"
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = file.url!
                      a.download = file.name
                      a.click()
                    }}
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )}
          {isVideo && (
            <div className="space-y-3 sm:space-y-4 h-full flex flex-col">
              {/* Video Player Section */}
              {file.url ? (
                <div className="bg-black rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                  <div className="flex-1 min-h-0">
                    <video
                      ref={videoRef}
                      controls
                      className="w-full h-full max-h-[40vh] sm:max-h-[45vh] md:max-h-[50vh] object-contain"
                      preload="metadata"
                      onTimeUpdate={handleTimeUpdate}
                      poster={file.videoThumbnail}
                    >
                      <source src={file.url} type={file.contentType} />
                      Your browser does not support the video element.
                    </video>
                  </div>

                  <div className="flex-shrink-0 p-3 sm:p-4 bg-black/60 border-t border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-xs sm:text-sm text-gray-300 truncate">
                        <span>{file.contentType}</span>
                        {file.videoDuration && (
                          <span className="ml-2">• {formatVideoDuration(file.videoDuration)}</span>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap file-preview-modal-buttons">
                        {availableOptions.includes('analyze') && onAnalyze && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-600/50 hover:bg-green-600/10 text-xs sm:text-sm"
                            onClick={() => {
                              onAnalyze(file.name, file.contentType)
                              onClose()
                            }}
                          >
                            <span className="text-sm sm:text-base mr-1 sm:mr-2">🔍</span>
                            Analyze
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs sm:text-sm"
                          onClick={() => {
                            const a = document.createElement('a')
                            a.href = file.url!
                            a.download = file.name
                            a.click()
                          }}
                        >
                          <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black/20 rounded-lg p-8 sm:p-12 text-center flex-1 flex flex-col items-center justify-center">
                  <Video className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mb-3 sm:mb-4" />
                  <p className="text-gray-400 text-sm sm:text-base">Video preview not available</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">The video file URL is missing</p>
                </div>
              )}
              {/* Transcription Section */}
              {file.transcription && (
                <div className="flex-shrink-0">
                  <Tabs defaultValue="full" className="w-full">
                    <TabsList className="bg-[#333333] w-full h-8 sm:h-10">
                      <TabsTrigger value="full" className="flex-1 data-[state=active]:bg-[#4A4A4A] text-xs sm:text-sm">
                        Full Transcript
                      </TabsTrigger>
                      {file.transcription.segments && file.transcription.segments.length > 0 && (
                        <TabsTrigger value="timed" className="flex-1 data-[state=active]:bg-[#4A4A4A] text-xs sm:text-sm">
                          Timed Segments
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="full" className="mt-3 sm:mt-4">
                      <div className="bg-black/20 rounded-lg">
                        <div className="p-3 sm:p-4 border-b border-gray-700">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-300">
                            Full Transcription
                            {file.transcription.language && ` (${file.transcription.language})`}
                            {file.transcription.duration && ` • ${formatDuration(file.transcription.duration)}`}
                          </h3>
                        </div>
                        <div className="p-3 sm:p-4 max-h-[200px] sm:max-h-[250px] overflow-y-auto">
                          <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {file.transcription.text}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                    {file.transcription.segments && file.transcription.segments.length > 0 && (
                      <TabsContent value="timed" className="mt-3 sm:mt-4">
                        <div className="bg-black/20 rounded-lg">
                          <div className="p-3 sm:p-4 border-b border-gray-700">
                            <h3 className="text-xs sm:text-sm font-medium text-gray-300">
                              Timed Transcript Segments
                              <span className="text-xs text-gray-500 ml-2 hidden sm:inline">
                                (Click timestamp to jump to that point)
                              </span>
                            </h3>
                          </div>
                          <div className="p-2 max-h-[200px] sm:max-h-[250px] overflow-y-auto">
                            {file.transcription.segments.map((segment, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "p-2 sm:p-3 rounded-lg mb-2 cursor-pointer transition-all hover:bg-black/30",
                                  activeSegment === index && "bg-blue-900/30 border-l-2 border-blue-500"
                                )}
                                onClick={() => seekToSegment(segment.start)}
                              >
                                <div className="flex items-start gap-2 sm:gap-3">
                                  <button
                                    type="button"
                                    className="text-xs text-blue-400 hover:text-blue-300 font-mono whitespace-nowrap pt-0.5 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      seekToSegment(segment.start)
                                    }}
                                  >
                                    {formatDuration(segment.start)}
                                  </button>
                                  <p className="text-xs sm:text-sm text-gray-200 flex-1 leading-relaxed">
                                    {segment.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              )}
            </div>
          )}
          {isAudio && (
            <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
              {/* Audio Player Section */}
              {file.url ? (
                <div className="bg-black/20 rounded-lg p-4 sm:p-6 flex-shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-black/30 flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0">
                      <FileAudio className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-white font-medium text-sm sm:text-base truncate">{file.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {file.contentType}
                        {file.transcription?.duration && ` • ${formatDuration(file.transcription.duration)}`}
                      </p>
                    </div>
                  </div>

                  <audio
                    ref={audioRef}
                    controls
                    className="w-full mb-4"
                    preload="metadata"
                    onTimeUpdate={handleTimeUpdate}
                  >
                    <source src={file.url} type={file.contentType} />
                    Your browser does not support the audio element.
                  </audio>

                  <div className="flex flex-wrap justify-center sm:justify-end gap-2 file-preview-modal-buttons">
                    {availableOptions.includes('analyze') && onAnalyze && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-600/50 hover:bg-green-600/10 text-xs sm:text-sm"
                        onClick={() => {
                          onAnalyze(file.name, file.contentType)
                          onClose()
                        }}
                      >
                        <span className="text-sm sm:text-base mr-1 sm:mr-2">🔍</span>
                        Analyze
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => {
                        const a = document.createElement('a')
                        a.href = file.url!
                        a.download = file.name
                        a.click()
                      }}
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-black/20 rounded-lg p-4 sm:p-6 text-center flex-1 flex flex-col items-center justify-center">
                  <FileAudio className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2" />
                  <p className="text-gray-400 text-sm sm:text-base">Audio preview not available</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">The audio file URL is missing</p>
                </div>
              )}
              {/* Transcription Section */}
              {file.transcription && (
                <div className="flex-1 min-h-0">
                  <Tabs defaultValue="full" className="w-full h-full flex flex-col">
                    <TabsList className="bg-[#333333] w-full h-8 sm:h-10 flex-shrink-0">
                      <TabsTrigger value="full" className="flex-1 data-[state=active]:bg-[#4A4A4A] text-xs sm:text-sm">
                        Full Transcript
                      </TabsTrigger>
                      {file.transcription.segments && file.transcription.segments.length > 0 && (
                        <TabsTrigger value="timed" className="flex-1 data-[state=active]:bg-[#4A4A4A] text-xs sm:text-sm">
                          Timed Segments
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="full" className="mt-3 sm:mt-4 flex-1 min-h-0">
                      <div className="bg-black/20 rounded-lg h-full flex flex-col">
                        <div className="p-3 sm:p-4 border-b border-gray-700 flex-shrink-0">
                          <h3 className="text-xs sm:text-sm font-medium text-gray-300">
                            Full Transcription
                            {file.transcription.language && ` (${file.transcription.language})`}
                            {file.transcription.duration && ` • ${formatDuration(file.transcription.duration)}`}
                          </h3>
                        </div>
                        <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
                          <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {file.transcription.text}
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {file.transcription.segments && file.transcription.segments.length > 0 && (
                      <TabsContent value="timed" className="mt-3 sm:mt-4 flex-1 min-h-0">
                        <div className="bg-black/20 rounded-lg h-full flex flex-col">
                          <div className="p-3 sm:p-4 border-b border-gray-700 flex-shrink-0">
                            <h3 className="text-xs sm:text-sm font-medium text-gray-300">
                              Timed Transcript Segments
                              <span className="text-xs text-gray-500 ml-2 hidden sm:inline">
                                (Click timestamp to jump to that point)
                              </span>
                            </h3>
                          </div>
                          <div className="p-2 flex-1 overflow-y-auto">
                            {file.transcription.segments.map((segment, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "p-2 sm:p-3 rounded-lg mb-2 cursor-pointer transition-all hover:bg-black/30",
                                  activeSegment === index && "bg-blue-900/30 border-l-2 border-blue-500"
                                )}
                                onClick={() => seekToSegment(segment.start)}
                              >
                                <div className="flex items-start gap-2 sm:gap-3">
                                  <button
                                    type="button"
                                    className="text-xs text-blue-400 hover:text-blue-300 font-mono whitespace-nowrap pt-0.5 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      seekToSegment(segment.start)
                                    }}
                                  >
                                    {formatDuration(segment.start)}
                                  </button>
                                  <p className="text-xs sm:text-sm text-gray-200 flex-1 leading-relaxed">
                                    {segment.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </div>
              )}
            </div>
          )}

          {/* Fallback for other file types */}
          {!isImage && !isAudio && !isVideo && (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 h-full">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-black/30 flex items-center justify-center mb-4">
                <FileAudio className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
              </div>
              <p className="text-gray-400 text-sm sm:text-base text-center">Preview not available for this file type</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 text-center">File: {file.name}</p>
              {availableOptions.includes('analyze') && onAnalyze && (
                <div className="mt-4 sm:mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-600/50 hover:bg-green-600/10 text-xs sm:text-sm"
                    onClick={() => {
                      onAnalyze(file.name, file.contentType)
                      onClose()
                    }}
                  >
                    <span className="text-sm sm:text-base mr-1 sm:mr-2">🔍</span>
                    Analyze File
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
