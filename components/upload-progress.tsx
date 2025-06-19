import { motion } from "framer-motion"
import { Loader2, Upload, Check, AlertCircle } from "lucide-react"
import { cn, formatFileSize } from "@/lib/utils"

interface UploadProgressProps {
  progress: number
  status: 'idle' | 'uploading' | 'transcribing' | 'complete' | 'error' | 'converting' | 'analyzing'
  fileName?: string
  fileSize?: number
}

export function UploadProgress({ progress, status, fileName, fileSize }: UploadProgressProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Upload className="w-4 h-4" />
      case 'transcribing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'converting':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'complete':
        return <Check className="w-4 h-4" />
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        const name = fileName || 'file'
        const size = fileSize ? ` (${formatFileSize(fileSize)})` : ''
        return `Uploading ${name}${size}...`
      case 'transcribing':
        return 'Transcribing media...'
      case 'converting':
        return 'Converting HEIC to JPEG...'
      case 'analyzing':
        return 'Analyzing and transcribing with Gemini...'
      case 'complete':
        return 'Upload complete!'
      case 'error':
        return 'Upload failed'
      default:
        return ''
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-300'
    }
  }

  if (status === 'idle') return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mx-4 mt-2 mb-2">
        <div className="bg-black/20 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-2 flex-1", getStatusColor())}>
              {getStatusIcon()}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            {status === 'uploading' && (
              <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
            )}
          </div>
          
          {(status === 'uploading' || status === 'transcribing' || status === 'converting') && (
            <div className="mt-2">
              <div className="w-full bg-black/30 rounded-full h-1.5 overflow-hidden">
                {(status === 'transcribing' || status === 'converting') ? (
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" />
                ) : (
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                )}
              </div>
              {status === 'transcribing' && (
                <p className="text-xs text-gray-400 mt-1">
                  This may take a few moments...
                </p>
              )}
              {status === 'converting' && (
                <p className="text-xs text-gray-400 mt-1">
                  Processing HEIC image...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
