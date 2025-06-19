import { NextRequest, NextResponse } from "next/server"
import { generateImageWithGPTImage1, generateImageWithContext } from "@/lib/openai-image-client"
import { ReplicateImageClient } from "@/lib/replicate-client"

export async function POST(req: NextRequest) {
  console.log("Image generation API called")

  try {
    // Parse request body
    const body = await req.json()
    console.log("Request body:", body)
    console.log("[API] Received model:", body.model)

    const {
      prompt,
      originalPrompt, // The full original prompt from the user
      model = "flux-kontext-pro", // Default to flux-kontext-pro
      quality = "standard", // Default quality
      style = "vivid",
      size = "1024x1024",
      imageContext, // For uploaded image editing
      originalImageId, // ID of the original image being edited
    } = body

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    if (model === "gpt-image-1") {
      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY not configured")
        return NextResponse.json(
          {
            error: "OpenAI API key not configured",
            details: "Please add OPENAI_API_KEY to your .env.local file."
          },
          { status: 500 }
        )
      }

      try {
        // Generate with GPT-Image-1 (DALL-E-3)
        console.log(`Generating image with GPT-Image-1: ${prompt}`)
        console.log(`Input quality: ${quality}`)
        
        // Map quality from UI format to GPT-Image-1 format
        // UI uses 'standard' or 'hd', GPT-Image-1 expects 'low', 'medium', or 'high'
        let mappedQuality: 'low' | 'medium' | 'high' = 'medium';
        
        if (quality === 'hd') {
          mappedQuality = 'high';
        } else if (quality === 'standard') {
          mappedQuality = 'medium';
        }
        
        console.log(`Quality mapping: ${quality} -> ${mappedQuality}`)
        
        // Check if we have image context (for uploaded image editing)
        let result;
        if (imageContext) {
          console.log('Using image context for generation (uploaded image editing)')
          result = await generateImageWithContext(
            prompt,
            imageContext,
            {
              quality: mappedQuality,
              size: size as "1024x1024" | "1536x1024" | "1024x1536",
              model: 'gpt-image-1'
            }
          )
        } else {
          result = await generateImageWithGPTImage1(
            prompt,
            {
              quality: mappedQuality,
              style: style,
              size: size as "1024x1024" | "1536x1024" | "1024x1536",
              n: 1,
            }
          )
        }

        console.log(`Successfully generated image with GPT-Image-1`)

        return NextResponse.json({
          success: true,
          images: [{
            url: result.imageUrl,
            revisedPrompt: result.revisedPrompt || prompt,
            index: 0,
          }],
          metadata: {
            model: "gpt-image-1",
            provider: "openai",
            quality: quality,
            mappedQuality: mappedQuality,
            style: style,
            size: size,
            originalPrompt: originalPrompt || prompt,
            imageCount: 1,
          }
        })

      } catch (error: any) {
        console.error("GPT-Image-1 generation error:", error)
        return NextResponse.json(
          {
            error: "Failed to generate image with GPT-Image-1",
            details: error.message || "Image generation failed"
          },
          { status: 500 }
        )
      }
    }

    // Handle Replicate models (Flux)
    if (model === "flux-kontext-pro" || model === "flux-kontext-max" || model === "flux-dev-ultra-fast") {
      // Check if Replicate API key is configured
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

      try {
        console.log(`Generating image with ${model}: ${prompt}`)
        
        // Map size to aspect ratio for Replicate
        const aspectRatioMap: Record<string, string> = {
          '1024x1024': '1:1',
          '1792x1024': '16:9',
          '1024x1536': '9:16'
        }
        
        const client = new ReplicateImageClient(process.env.REPLICATE_API_KEY)
        const imageUrl = await client.generateImage(model, prompt, {
          aspect_ratio: aspectRatioMap[size] || "1:1",
          output_format: "jpg",
          guidance_scale: style === 'vivid' ? 4.5 : 3.5,
        })

        console.log(`Successfully generated image with ${model}`)

        return NextResponse.json({
          success: true,
          images: [{
            url: imageUrl,
            revisedPrompt: prompt,
            index: 0,
          }],
          metadata: {
            model: model,
            provider: "replicate",
            style: style,
            size: size,
            originalPrompt: originalPrompt || prompt,
            imageCount: 1,
          }
        })

      } catch (error: any) {
        console.error(`${model} generation error:`, error)
        return NextResponse.json(
          {
            error: `Failed to generate image with ${model}`,
            details: error.message || "Image generation failed"
          },
          { status: 500 }
        )
      }
    }

    // Unknown model
    console.log(`Unknown model "${model}"`)
    return NextResponse.json(
      {
        error: `Unsupported model: ${model}`,
        details: "Supported models: gpt-image-1, flux-kontext-pro, flux-kontext-max, flux-dev-ultra-fast"
      },
      { status: 400 }
    )

  } catch (error) {
    console.error("Image generation API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}