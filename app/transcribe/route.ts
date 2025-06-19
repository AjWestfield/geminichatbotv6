import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI with enhanced configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  timeout: 90000, // Increased to 90 seconds for large files
  maxRetries: 0, // We'll handle retries manually for better control
})

// Enhanced retry configuration for different error types
const RETRY_CONFIG = {
  ECONNRESET: { maxAttempts: 5, baseDelay: 2000, maxDelay: 10000 },
  ETIMEDOUT: { maxAttempts: 3, baseDelay: 3000, maxDelay: 15000 },
  DEFAULT: { maxAttempts: 3, baseDelay: 1000, maxDelay: 5000 }
}

// Helper function to determine retry configuration based on error
function getRetryConfig(error: any) {
  if (error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET')) {
    return RETRY_CONFIG.ECONNRESET
  }
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return RETRY_CONFIG.ETIMEDOUT
  }
  return RETRY_CONFIG.DEFAULT
}

// Helper function for exponential backoff with jitter
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
  const jitter = Math.random() * 0.3 * exponentialDelay // 30% jitter
  return Math.floor(exponentialDelay + jitter)
}

// Helper to create a File from ArrayBuffer with proper mime type
async function createFileFromBuffer(buffer: ArrayBuffer, originalFile: File): Promise<File> {
  const blob = new Blob([buffer], { type: originalFile.type })
  return new File([blob], originalFile.name, { type: originalFile.type })
}

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key not configured")
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file" },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Check if it's an audio or video file
    const isAudio = file.type.startsWith("audio/")
    const isVideo = file.type.startsWith("video/")
    
    if (!isAudio && !isVideo) {
      return NextResponse.json(
        { error: "File must be an audio or video file" },
        { status: 400 }
      )
    }

    console.log(`Processing ${isVideo ? 'video' : 'audio'} file:`, file.name, "Type:", file.type, "Size:", file.size)

    // Check file size (Whisper has a 25MB limit)
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File size exceeds limit: ${(file.size / 1024 / 1024).toFixed(1)}MB > 25MB`)
      const response = NextResponse.json(
        { 
          error: "File too large",
          details: `Maximum file size is 25MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`,
          suggestion: "Consider using a shorter audio/video clip or compressing the file."
        },
        { status: 400 }
      )
      return response
    }

    // Convert File to ArrayBuffer for potential retry attempts
    // This prevents "Body already read" errors on retries
    const arrayBuffer = await file.arrayBuffer()
    
    try {
      // Enhanced retry logic with dynamic configuration
      let attempts = 0;
      let lastError: any = null;
      
      while (true) {
        attempts++;
        
        try {
          console.log(`Transcription attempt ${attempts}...`)
          console.log("File size:", (file.size / 1024 / 1024).toFixed(2), "MB")
          
          // Create a new File object for each attempt to avoid stream issues
          const fileForAttempt = await createFileFromBuffer(arrayBuffer, file)
          
          // Add progress tracking for large files
          const startTime = Date.now()
          
          const transcription = await openai.audio.transcriptions.create({
            file: fileForAttempt,
            model: "whisper-1",
            response_format: "verbose_json", // Get more detailed response
          })
          
          const duration = Date.now() - startTime
          console.log(`Transcription successful in ${duration}ms!`)
          
          // Extract additional metadata if available
          const response = transcription as any; // Type assertion for verbose response
          
          return NextResponse.json({
            success: true,
            transcription: {
              text: response.text || "No transcription available",
              language: response.language || undefined,
              duration: response.duration || undefined,
              segments: response.segments || [], // Detailed timing information
            },
            fileInfo: {
              name: file.name,
              type: file.type,
              size: file.size,
              isVideo: isVideo
            },
            performance: {
              processingTime: duration,
              attempts: attempts
            }
          })
        } catch (error: any) {
          lastError = error;
          console.error(`Attempt ${attempts} failed:`, error.message, error.code)
          
          // Determine retry configuration based on error type
          const retryConfig = getRetryConfig(error)
          
          // Don't retry on certain errors
          if (error.status === 401 || 
              error.status === 400 ||
              error.message?.includes("format") ||
              error.message?.includes("Invalid file format")) {
            throw error;
          }
          
          // Check if we should retry
          if (attempts >= retryConfig.maxAttempts) {
            console.error(`Max attempts (${retryConfig.maxAttempts}) reached for error type`)
            throw error;
          }
          
          // Calculate backoff delay
          const delay = calculateBackoff(attempts, retryConfig.baseDelay, retryConfig.maxDelay)
          console.log(`Waiting ${delay}ms before retry (${error.code || 'Unknown error'})...`)
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // For ECONNRESET errors on large files, add a longer initial wait on first retry
          if (error.code === 'ECONNRESET' && attempts === 1 && file.size > 10 * 1024 * 1024) {
            console.log("Large file ECONNRESET - adding additional 5s cooldown")
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
      }
      
    } catch (transcriptionError: any) {
      console.error("Transcription error after all retries:", transcriptionError)
      console.error("Error type:", transcriptionError.constructor.name)
      console.error("Error message:", transcriptionError.message)
      console.error("Error code:", transcriptionError.code)
      
      // Check if it's an authentication error
      if (transcriptionError.status === 401) {
        return NextResponse.json(
          { 
            error: "Invalid OpenAI API key",
            details: "Please check your OPENAI_API_KEY in the .env file"
          },
          { status: 401 }
        )
      }
      
      // Check if it's a file format error
      if (transcriptionError.message?.includes("format") || 
          transcriptionError.message?.includes("Invalid file format")) {
        return NextResponse.json(
          { 
            error: "Unsupported file format",
            details: "Please upload a supported audio or video format (MP3, MP4, M4A, WAV, WEBM, MOV, etc.)",
            supportedFormats: ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "mov"]
          },
          { status: 400 }
        )
      }
      
      // Check for connection errors with more helpful messages
      if (transcriptionError.code === 'ECONNRESET' || 
          transcriptionError.code === 'ECONNREFUSED' ||
          transcriptionError.message?.includes("Connection error") ||
          transcriptionError.message?.includes("ECONNRESET")) {
        
        // Provide specific guidance for large files
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
        const isLargeFile = file.size > 15 * 1024 * 1024 // >15MB
        
        return NextResponse.json(
          { 
            error: "Connection error",
            details: isLargeFile 
              ? `The connection was reset while uploading your ${fileSizeMB}MB file. This often happens with larger files.`
              : "Failed to connect to OpenAI transcription service.",
            suggestion: isLargeFile
              ? "Try using a smaller file (under 15MB) or ensure you have a stable internet connection."
              : "Please check your internet connection and try again.",
            fileSize: fileSizeMB
          },
          { status: 503 }
        )
      }
      
      // Check for timeout errors
      if (transcriptionError.code === 'ETIMEDOUT' || 
          transcriptionError.message?.includes("timeout")) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
        return NextResponse.json(
          { 
            error: "Request timeout",
            details: `The transcription request timed out. Your file (${fileSizeMB}MB) may be too large to process within the time limit.`,
            suggestion: "Try using a shorter audio/video clip or compress the file to reduce its size."
          },
          { status: 504 }
        )
      }
      
      // Generic error with more context
      return NextResponse.json(
        { 
          error: "Failed to transcribe media",
          details: transcriptionError.message || "Unknown error",
          errorCode: transcriptionError.code,
          suggestion: "If this persists, try with a smaller or different format file."
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("General error:", error)
    return NextResponse.json(
      { 
        error: "Failed to process request",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    )
  }
}
