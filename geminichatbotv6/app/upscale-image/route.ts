import { NextRequest, NextResponse } from "next/server"
import { ReplicateImageClient } from "@/lib/replicate-client"
import { ensureImageUrlAccessible, isReplicateDeliveryUrl } from "@/lib/image-url-validator"
import { getImageByLocalId } from "@/lib/services/chat-persistence"

// Cost calculation based on output megapixels
const calculateCost = (width: number, height: number, factor: string): { mp: number; units: number; cost: number } => {
  const multiplier = factor === '2x' ? 4 : factor === '4x' ? 16 : factor === '6x' ? 36 : 1
  const outputMP = (width * height * multiplier) / 1_000_000
  
  // Cost tiers from Topaz Labs documentation
  if (outputMP <= 24) return { mp: outputMP, units: 1, cost: 0.05 }
  if (outputMP <= 48) return { mp: outputMP, units: 2, cost: 0.10 }
  if (outputMP <= 60) return { mp: outputMP, units: 3, cost: 0.15 }
  if (outputMP <= 96) return { mp: outputMP, units: 4, cost: 0.20 }
  if (outputMP <= 132) return { mp: outputMP, units: 5, cost: 0.24 }
  if (outputMP <= 168) return { mp: outputMP, units: 6, cost: 0.29 }
  if (outputMP <= 336) return { mp: outputMP, units: 11, cost: 0.53 }
  if (outputMP <= 512) return { mp: outputMP, units: 17, cost: 0.82 }
  
  // For very large images, estimate based on linear scaling
  const units = Math.ceil(outputMP / 30)
  return { mp: outputMP, units, cost: units * 0.048 }
}

export async function POST(req: NextRequest) {
  console.log("Image upscaling API called")

  try {
    const body = await req.json()
    console.log("Request body:", body)

    const {
      imageUrl,
      imageId, // Optional local image ID for database lookup
      enhanceModel = "Standard V2",
      upscaleFactor = "2x",
      outputFormat = "jpg",
      subjectDetection = "None",
      faceEnhancement = false,
      faceEnhancementCreativity = 0,
      faceEnhancementStrength = 0.8,
      // Optional image dimensions for cost calculation
      imageWidth,
      imageHeight
    } = body

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      )
    }

    // Check if Replicate API key is configured
    if (!process.env.REPLICATE_API_KEY) {
      return NextResponse.json(
        {
          error: "Replicate API key not configured",
          details: "Please add REPLICATE_API_KEY to your .env.local file. Get your API key from https://replicate.com/account/api-tokens"
        },
        { status: 500 }
      )
    }

    console.log(`[API] Upscaling image with Topaz Labs:`)
    console.log(`[API] Model: ${enhanceModel}`)
    console.log(`[API] Upscale Factor: ${upscaleFactor}`)
    console.log(`[API] Face Enhancement: ${faceEnhancement}`)
    console.log(`[API] Subject Detection: ${subjectDetection}`)

    // Calculate cost if dimensions provided
    let costEstimate = null
    if (imageWidth && imageHeight) {
      costEstimate = calculateCost(imageWidth, imageHeight, upscaleFactor)
      console.log(`[API] Cost estimate: $${costEstimate.cost.toFixed(2)} (${costEstimate.units} units, ${costEstimate.mp.toFixed(1)}MP output)`)
    }

    // Validate and ensure image URL is accessible
    let validImageUrl = imageUrl
    
    // Check if this is an expired Replicate URL or any inaccessible URL
    if (!imageUrl.startsWith('data:') && !imageUrl.includes('blob.vercel-storage.com')) {
      console.log(`[API] Checking URL accessibility...`)
      try {
        // First, try a HEAD request to check if URL is accessible
        const testResponse = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (!testResponse.ok) {
          console.log(`[API] URL returned status ${testResponse.status}, attempting recovery...`)
          
          // If we have an imageId and it's a Replicate URL, try to fetch from database first
          if (imageId && isReplicateDeliveryUrl(imageUrl)) {
            console.log(`[API] Attempting to fetch permanent URL from database for image ID: ${imageId}`)
            const storedImage = await getImageByLocalId(imageId)
            
            if (storedImage && storedImage.url) {
              console.log(`[API] Found permanent URL in database: ${storedImage.url.substring(0, 50)}...`)
              validImageUrl = storedImage.url
            } else {
              console.log(`[API] No permanent URL found in database, attempting direct recovery`)
              validImageUrl = await ensureImageUrlAccessible(imageUrl)
              console.log(`[API] Successfully converted to data URL`)
            }
          } else {
            // Try to download and convert to data URL
            validImageUrl = await ensureImageUrlAccessible(imageUrl)
            console.log(`[API] Successfully converted to data URL`)
          }
        }
      } catch (error) {
        console.error(`[API] URL accessibility check failed:`, error)
        
        // Try recovery methods
        if (imageId && isReplicateDeliveryUrl(imageUrl)) {
          console.log(`[API] Attempting database lookup as fallback for image ID: ${imageId}`)
          const storedImage = await getImageByLocalId(imageId)
          
          if (storedImage && storedImage.url) {
            console.log(`[API] Found permanent URL in database (fallback): ${storedImage.url.substring(0, 50)}...`)
            validImageUrl = storedImage.url
          } else {
            try {
              validImageUrl = await ensureImageUrlAccessible(imageUrl)
              console.log(`[API] Successfully recovered image as data URL`)
            } catch (recoveryError) {
              console.error(`[API] Failed to recover image:`, recoveryError)
              
              const isReplicateUrl = imageUrl.includes('replicate.delivery')
              return NextResponse.json(
                {
                  error: "Image URL expired or inaccessible",
                  details: isReplicateUrl 
                    ? "The Replicate image URL has expired. Replicate URLs are only available for 24 hours."
                    : "The image URL is no longer accessible.",
                  suggestion: "To upscale this image, please save it to your device first, then upload it again.",
                  technicalInfo: {
                    originalUrl: imageUrl,
                    errorType: "url_expired",
                    provider: isReplicateUrl ? "replicate" : "unknown"
                  }
                },
                { status: 400 }
              )
            }
          }
        } else {
          try {
            validImageUrl = await ensureImageUrlAccessible(imageUrl)
            console.log(`[API] Successfully recovered image as data URL`)
          } catch (recoveryError) {
            console.error(`[API] Failed to recover image:`, recoveryError)
            
            const isReplicateUrl = imageUrl.includes('replicate.delivery')
            return NextResponse.json(
              {
                error: "Image URL expired or inaccessible",
                details: isReplicateUrl 
                  ? "The Replicate image URL has expired. Replicate URLs are only available for 24 hours."
                  : "The image URL is no longer accessible.",
                suggestion: "To upscale this image, please save it to your device first, then upload it again.",
                technicalInfo: {
                  originalUrl: imageUrl,
                  errorType: "url_expired",
                  provider: isReplicateUrl ? "replicate" : "unknown"
                }
              },
              { status: 400 }
            )
          }
        }
      }
    }

    try {
      const replicateClient = new ReplicateImageClient(process.env.REPLICATE_API_KEY)
      
      // Prepare upscale input
      const upscaleInput = {
        image: validImageUrl,
        enhance_model: enhanceModel as any,
        upscale_factor: upscaleFactor as any,
        output_format: outputFormat as any,
        subject_detection: subjectDetection as any,
        face_enhancement: faceEnhancement,
        face_enhancement_creativity: faceEnhancementCreativity,
        face_enhancement_strength: faceEnhancementStrength
      }
      
      console.log(`[API] Calling Replicate with Topaz Labs model...`)
      const upscaledImageUrl = await replicateClient.upscaleImage(upscaleInput)
      
      console.log(`[API] Successfully upscaled image`)

      return NextResponse.json({
        success: true,
        imageUrl: upscaledImageUrl,
        originalUrl: imageUrl,
        metadata: {
          model: "topazlabs/image-upscale",
          provider: "replicate",
          enhanceModel,
          upscaleFactor,
          outputFormat,
          subjectDetection,
          faceEnhancement,
          method: 'upscaling',
          costEstimate,
          note: upscaleFactor === 'None' ? 'Image enhanced without upscaling' : `Image upscaled ${upscaleFactor}`
        }
      })
    } catch (error: any) {
      console.error("Topaz Labs upscaling error:", error)
      console.error("Error details:", error.message)

      // Handle specific Replicate errors
      if (error.message?.includes('404 Client Error') && error.message?.includes('replicate.delivery')) {
        return NextResponse.json(
          {
            error: "Image URL expired",
            details: "The image URL has expired. Replicate-generated images are only accessible for 24 hours.",
            suggestion: "Upload the image file directly to upscale it, or use a more recent image."
          },
          { status: 400 }
        )
      }

      if (error.message?.includes('rate_limit')) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            details: "Too many requests to Replicate. Please wait a moment and try again."
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error: "Failed to upscale image",
          details: error.message || "An unexpected error occurred"
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

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Topaz Labs image upscaling API is accessible",
    provider: "replicate",
    model: "topazlabs/image-upscale",
    available: !!process.env.REPLICATE_API_KEY,
    capabilities: {
      features: [
        "Professional-grade AI upscaling up to 6x",
        "Multiple enhancement models for different image types",
        "Face enhancement with creativity and strength controls",
        "Subject detection (foreground/background)",
        "Preserves and enhances fine details",
        "Optimized for various content types"
      ],
      models: {
        "Standard V2": "Best for general photos and images",
        "Low Resolution V2": "Optimized for low-quality source images",
        "CGI": "Ideal for digital art and rendered images",
        "High Fidelity V2": "Preserves fine details and textures",
        "Text Refine": "Enhances text clarity in documents"
      },
      upscaleFactors: ["None", "2x", "4x", "6x"],
      outputFormats: ["jpg", "png"],
      subjectDetection: ["None", "All", "Foreground", "Background"]
    }
  })
}