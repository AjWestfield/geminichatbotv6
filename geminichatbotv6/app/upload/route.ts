import { GoogleAIFileManager } from "@google/generative-ai/server"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import os from "node:os"

// Initialize the File Manager with better error handling
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error("GEMINI_API_KEY is not configured")
}
const fileManager = new GoogleAIFileManager(apiKey || "")

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!apiKey) {
      console.error("[Upload API] GEMINI_API_KEY is not configured")
      return NextResponse.json(
        {
          error: "Server configuration error",
          details: "Gemini API key is not configured. Please check server environment variables."
        },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.error("[Upload API] No file provided in request")
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    console.log(`[Upload API] Processing file: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`)

    // Validate file type
    const supportedTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
      // Audio
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/webm",
      "audio/mp4",
      "audio/m4a",
      // Video
      "video/mp4",
      "video/mpeg",
      "video/mov",
      "video/avi",
      "video/x-flv",
      "video/mpg",
      "video/webm",
      "video/wmv",
      "video/3gpp",
      "video/quicktime"
    ]

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload an image (JPEG, PNG, WebP, HEIC, HEIF), audio file (MP3, WAV, etc.), or video file (MP4, MOV, etc.)" },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Gemini
    try {
      // Create a temporary file to upload (Gemini SDK requires file path)
      const tempDir = os.tmpdir()
      const tempPath = path.join(tempDir, `gemini_upload_${Date.now()}_${file.name}`)

      // Write buffer to temp file
      await fs.writeFile(tempPath, buffer)

      // Upload the file
      const uploadResponse = await fileManager.uploadFile(tempPath, {
        mimeType: file.type,
        displayName: file.name,
      })

      // Clean up temp file
      await fs.unlink(tempPath)

      // Wait for file to be processed
      let fileInfo = await fileManager.getFile(uploadResponse.file.name)

      console.log(`File upload - Initial state: ${fileInfo.state}, Type: ${file.type}, Size: ${file.size} bytes`)

      while (fileInfo.state === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 1000))
        fileInfo = await fileManager.getFile(uploadResponse.file.name)
      }

      if (fileInfo.state === "FAILED") {
        console.error(`File processing failed for ${file.name}`)
        throw new Error("File processing failed")
      }

      console.log(`File upload successful - URI: ${fileInfo.uri}, State: ${fileInfo.state}`)

      // Return file info
      return NextResponse.json({
        success: true,
        file: {
          uri: fileInfo.uri,
          mimeType: fileInfo.mimeType,
          displayName: fileInfo.displayName,
          name: fileInfo.name,
          sizeBytes: fileInfo.sizeBytes
        }
      })
    } catch (uploadError: any) {
      console.error("[Upload API] Upload error:", uploadError)
      console.error("[Upload API] Error details:", {
        message: uploadError.message,
        stack: uploadError.stack,
        name: uploadError.name
      })

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to upload file to Gemini"
      let errorDetails = uploadError.message || "Unknown error occurred"

      if (uploadError.message?.includes("API_KEY_INVALID")) {
        errorMessage = "Invalid Gemini API key"
        errorDetails = "The Gemini API key is invalid or expired. Please check your configuration."
      } else if (uploadError.message?.includes("QUOTA_EXCEEDED")) {
        errorMessage = "Gemini API quota exceeded"
        errorDetails = "The Gemini API quota has been exceeded. Please try again later."
      } else if (uploadError.message?.includes("PERMISSION_DENIED")) {
        errorMessage = "Permission denied"
        errorDetails = "Access to Gemini API was denied. Please check your API key permissions."
      } else if (uploadError.message?.includes("ENOTFOUND") || uploadError.message?.includes("network")) {
        errorMessage = "Network connection error"
        errorDetails = "Unable to connect to Gemini API. Please check your internet connection."
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[Upload API] File upload error:", error)
    console.error("[Upload API] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    // Provide more helpful error messages
    let errorMessage = "Failed to process file upload"
    let errorDetails = error.message || "An unexpected error occurred"

    if (error.message?.includes("formData")) {
      errorMessage = "Invalid file upload format"
      errorDetails = "The file upload request format is invalid. Please try uploading the file again."
    } else if (error.message?.includes("arrayBuffer")) {
      errorMessage = "File processing error"
      errorDetails = "Unable to process the uploaded file. The file may be corrupted or in an unsupported format."
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
