import { NextRequest, NextResponse } from "next/server"
import { smartEditWithGPTImage1, checkGPTImage1Available } from "@/lib/openai-image-client"
import { ReplicateImageClient } from "@/lib/replicate-client"
import { ensureImageUrlAccessible, isReplicateDeliveryUrl } from "@/lib/image-url-validator"
import { getImageByLocalId } from "@/lib/services/chat-persistence"

export async function POST(req: NextRequest) {
  console.log("Image editing API called")

  try {
    // Parse request body
    const body = await req.json()
    console.log("Request body:", body)

    // Define supported models type
    type SupportedModel = "gpt-image-1" | "flux-kontext-pro" | "flux-kontext-max";
    
    const {
      imageUrl,
      imageId, // Optional local image ID for database lookup
      prompt,
      model = "flux-kontext-pro" as SupportedModel,
      quality = "standard",
      style = "vivid",
      size = "1024x1024",
      mask, // Optional mask for inpainting
    }: {
      imageUrl: string;
      imageId?: string;
      prompt: string;
      model?: SupportedModel;
      quality?: string;
      style?: string;
      size?: string;
      mask?: string;
    } = body
    
    console.log("[API] Image editing request received:")
    console.log("[API] Model:", model)
    console.log("[API] Model type check:", {
      isGptImage1: model === "gpt-image-1",
      isFluxKontextMax: model === "flux-kontext-max", 
      isFluxKontextPro: model === "flux-kontext-pro",
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasReplicateKey: !!process.env.REPLICATE_API_KEY
    })

    // Check if required API keys are configured based on model
    if (model === "gpt-image-1" && !process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured for GPT-Image-1")
      return NextResponse.json(
        {
          error: "OpenAI API key not configured",
          details: "Please add OPENAI_API_KEY to your .env.local file. Get your API key from https://platform.openai.com/api-keys"
        },
        { status: 500 }
      )
    }
    
    if ((model === "flux-kontext-max" || model === "flux-kontext-pro") && !process.env.REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured for", model)
      return NextResponse.json(
        {
          error: "Replicate API key not configured",
          details: "Please add REPLICATE_API_KEY to your .env.local file."
        },
        { status: 500 }
      )
    }

    // Convert quality parameter from standard/hd to GPT-Image-1's low/medium/high
    let gptQuality: 'low' | 'medium' | 'high' = 'medium';
    if (quality === 'standard') {
      gptQuality = 'medium';
    } else if (quality === 'hd') {
      gptQuality = 'high';
    }
    
    // Log which model will be used
    console.log(`[API] Will use model: ${model}`);
    const modelCapabilities: Record<string, string> = {
      'gpt-image-1': 'Multimodal editing with inpainting support',
      'flux-kontext-pro': 'Fast text-based editing (~4-6s)',
      'flux-kontext-max': 'Premium quality with typography (~6-10s)'
    };
    console.log(`[API] Model capabilities:`, modelCapabilities[model as string] || 'Unknown model');

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Edit prompt is required" },
        { status: 400 }
      )
    }

    // Validate and map sizes for GPT-Image-1
    const validSizes = ['1024x1024', '1536x1024', '1024x1536'];
    let actualSize = size;
    
    // Map common sizes to GPT-Image-1 compatible sizes
    if (size === '1792x1024') {
      actualSize = '1536x1024'; // Closest landscape size
      console.log(`Mapping ${size} to ${actualSize} for GPT-Image-1`);
    } else if (size === '1024x1536') {
      actualSize = '1024x1536'; // Closest portrait size
      console.log(`Mapping ${size} to ${actualSize} for GPT-Image-1`);
    } else if (!validSizes.includes(size)) {
      actualSize = '1024x1024'; // Default to square
      console.log(`Invalid size ${size} for GPT-Image-1, using default: ${actualSize}`);
    }

    if (model === "gpt-image-1") {
      console.log(`Editing image with GPT-Image-1: "${prompt.substring(0, 50)}..."`)
    } else {
      console.log(`Editing image with ${model}: "${prompt.substring(0, 50)}..."`)
    }
    console.log(`Original image: ${imageUrl.substring(0, 50)}...`)
    console.log(`Quality: ${gptQuality} (from ${quality}), Style: ${style}, Size: ${actualSize} (requested: ${size})`)
    if (mask) {
      console.log(`Using mask for inpainting: ${mask.substring(0, 50)}...`)
    }

    try {
      if (model === "gpt-image-1") {
        // Convert Gemini file URI to a format OpenAI can access
        let processedImageUrl = imageUrl;

        // Check if this is a Gemini file URI (but not a data URL)
        if (!imageUrl.startsWith('data:') && (imageUrl.includes('generativelanguage.googleapis.com') || imageUrl.includes('files/'))) {
          console.log('Detected Gemini file URI - editing not supported');

          return NextResponse.json(
            {
              error: "Image editing not available for Gemini file URIs",
              details: "Gemini file URIs cannot be accessed by external services. Please upload the image again or use a generated image.",
              suggestion: "Try uploading the image file directly instead of using a Gemini URI"
            },
            { status: 400 }
          );
        }

        // Edit image using GPT-Image-1
        const result = await smartEditWithGPTImage1(processedImageUrl, prompt, {
          size: actualSize as '1024x1024' | '1536x1024' | '1024x1536',
          quality: gptQuality,
          style: style as 'vivid' | 'natural',
          mask,
        })

        console.log(`Successfully edited image using ${result.model || 'GPT-Image-1'}`)

        return NextResponse.json({
          success: true,
          images: [{
            url: result.imageUrl,
            originalUrl: result.originalImageUrl || imageUrl,
            revisedPrompt: result.revisedPrompt || prompt,
            index: 0,
          }],
          metadata: {
            model: result.model || 'gpt-image-1',
            provider: "openai",
            quality: quality, // Return original quality parameter
            style,
            size,
            originalPrompt: prompt,
            editMode: true,
            method: result.method || 'image-to-image',
            imageCount: 1,
            note: result.model?.includes('fallback') ? 'Using fallback model due to GPT-Image-1 availability' : undefined,
          }
        })
      } else if (model === "flux-kontext-max" || model === "flux-kontext-pro") {
        if (!process.env.REPLICATE_API_KEY) {
          console.error("REPLICATE_API_KEY not configured")
          return NextResponse.json(
            {
              error: "Replicate API key not configured",
              details: "Please add REPLICATE_API_KEY to your .env.local file."
            },
            { status: 500 }
          )
        }
        
        // Validate and ensure image URL is accessible for Replicate
        console.log(`[API] Validating image URL for Replicate: ${imageUrl}`)
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
                  // Try to download and convert to data URL
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
            
            // If we have an imageId and it's a Replicate URL, try database lookup as fallback
            if (imageId && isReplicateDeliveryUrl(imageUrl)) {
              console.log(`[API] Attempting database lookup as fallback for image ID: ${imageId}`)
              const storedImage = await getImageByLocalId(imageId)
              
              if (storedImage && storedImage.url) {
                console.log(`[API] Found permanent URL in database (fallback): ${storedImage.url.substring(0, 50)}...`)
                validImageUrl = storedImage.url
              } else {
                // Try to recover the image by downloading it
                try {
                  validImageUrl = await ensureImageUrlAccessible(imageUrl)
                  console.log(`[API] Successfully recovered image as data URL`)
                } catch (recoveryError) {
                  console.error(`[API] Failed to recover image:`, recoveryError)
                  
                  // Provide helpful error message based on URL type
                  const isReplicateUrl = imageUrl.includes('replicate.delivery')
                  return NextResponse.json(
                    {
                      error: "Image URL expired or inaccessible",
                      details: isReplicateUrl 
                        ? "The Replicate image URL has expired. Replicate URLs are only available for 24 hours."
                        : "The image URL is no longer accessible.",
                      suggestion: "To edit this image, please save it to your device first, then upload it again.",
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
              // Try to recover the image by downloading it
              try {
                validImageUrl = await ensureImageUrlAccessible(imageUrl)
                console.log(`[API] Successfully recovered image as data URL`)
              } catch (recoveryError) {
                console.error(`[API] Failed to recover image:`, recoveryError)
                
                // Provide helpful error message based on URL type
                const isReplicateUrl = imageUrl.includes('replicate.delivery')
                return NextResponse.json(
                  {
                    error: "Image URL expired or inaccessible",
                    details: isReplicateUrl 
                      ? "The Replicate image URL has expired. Replicate URLs are only available for 24 hours."
                      : "The image URL is no longer accessible.",
                    suggestion: "To edit this image, please save it to your device first, then upload it again.",
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
        
        const replicateClient = new ReplicateImageClient(process.env.REPLICATE_API_KEY)
        
        // Flux Kontext models require specific parameters
        const editInput = {
          prompt: prompt,
          input_image: validImageUrl,
          aspect_ratio: "match_input_image", // Always preserve original aspect ratio for edits
          output_format: "png" as const, // Replicate only supports "jpg" or "png"
          safety_tolerance: 2, // Max allowed when using input images
        }
        
        console.log(`[API] Calling Replicate ${model} with input:`, {
          ...editInput,
          input_image: editInput.input_image.substring(0, 50) + '...' // Truncate for logging
        })
        
        const editedImageUrl = await replicateClient.editImage(model, editInput)
        return NextResponse.json({
          success: true,
          images: [{
            url: editedImageUrl,
            originalUrl: imageUrl,
            revisedPrompt: prompt,
            index: 0,
          }],
          metadata: {
            model,
            provider: "replicate",
            quality,
            style,
            size,
            originalPrompt: prompt,
            editMode: true,
            method: 'image-to-image',
            imageCount: 1,
          }
        })
      } else {
        return NextResponse.json(
          {
            error: "Invalid model specified",
            details: `The model "${model}" is not supported for image editing.`
          },
          { status: 400 }
        )
      }
    } catch (error: any) {
      console.error("GPT-Image-1 editing error:", error)
      console.error("Error details:", error.message)
      console.error("Error code:", error.code)
      console.error("Error type:", error.type)

      if (error.message?.includes('invalid_request_error')) {
        return NextResponse.json(
          {
            error: "Invalid request",
            details: "The request format or parameters are invalid. " + error.message
          },
          { status: 400 }
        )
      }

      if (error.message?.includes('rate_limit_exceeded')) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            details: "Too many requests to OpenAI. Please wait a moment and try again."
          },
          { status: 429 }
        )
      }

      // Handle Replicate URL 404 errors (expired URLs)
      if (error.message?.includes('404 Client Error') && error.message?.includes('replicate.delivery')) {
        return NextResponse.json(
          {
            error: "Image URL expired",
            details: "The image URL has expired. Replicate-generated images are only accessible for 24 hours. Please try editing a more recent image or upload the image file directly.",
            suggestion: "Upload the image file directly to edit it, or generate a new image to edit."
          },
          { status: 400 }
        )
      }

      if (error.message?.includes('safety system') || error.code === 'moderation_blocked' || error.type === 'image_generation_user_error') {
        return NextResponse.json(
          {
            error: "Content not allowed",
            details: "The image or edit request was rejected by OpenAI's safety system. This may happen with copyrighted characters, inappropriate content, or certain types of modifications. Try using different wording or editing a different image."
          },
          { status: 400 }
        )
      }

      if (error.message?.includes('model_not_found')) {
        return NextResponse.json(
          {
            error: "Model not available",
            details: "GPT-Image-1 model not found. Please ensure your OpenAI organization is verified and you have access to GPT-4o's image generation capabilities."
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: "Failed to edit image",
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
  try {
    // Check if GPT-Image-1 is available
    const isAvailable = await checkGPTImage1Available();

    return NextResponse.json({
      status: "ok",
      message: "GPT-Image-1 editing API is accessible",
      provider: "openai",
      model: "gpt-image-1",
      available: isAvailable,
      capabilities: {
        features: [
          "Native Multimodal Image Generation",
          "Advanced Image-to-Image Editing",
          "Inpainting with Alpha Channel Masks",
          "Multi-Image Composition (up to 10 images)",
          "Conversational Editing with Context",
          "Accurate Text Rendering in Images"
        ],
        sizes: ["1024x1024", "1536x1024", "1024x1536"],
        quality: ["low", "medium", "high"],
        style: ["vivid", "natural"],
        mode: "multimodal",
        description: "GPT-Image-1 is GPT-4o's native image generation capability with advanced multimodal features"
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "GPT-Image-1 API not configured or accessible",
      error: error.message
    }, { status: 500 })
  }
}
