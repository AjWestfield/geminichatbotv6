import { NextRequest, NextResponse } from "next/server";
import { ReplicateVideoClient } from "@/lib/replicate-client";
import { HuggingFaceVideoClient } from "@/lib/huggingface-client";
import { generateVideoThumbnail } from "@/lib/video-utils";
import { auth } from "@/lib/auth"; // Assuming auth helper exists

export const maxDuration = 600; // 10 minutes timeout

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      duration,
      aspectRatio,
      negativePrompt,
      startImage,
      model,
      cfg_scale,
      referenceImages,
      enableProgressTracking = true, // New option to enable/disable progress tracking
      backend = 'replicate', // 'replicate' or 'huggingface'
      tier = 'fast' // 'fast' or 'quality' (for HuggingFace)
    } = body;

    // Validate required fields - Kling models need at least a prompt
    if (!prompt && !startImage) {
      return NextResponse.json(
        { error: "Either a prompt or start image is required" },
        { status: 400 }
      );
    }


    // Handle HuggingFace backend
    if (backend === 'huggingface') {
      const hfToken = process.env.HF_TOKEN;
      const hfFastUrl = process.env.HF_ENDPOINT_FAST_URL;
      const hfQualityUrl = process.env.HF_ENDPOINT_QUALITY_URL;

      if (!hfToken) {
        return NextResponse.json(
          { error: "HuggingFace token not configured. Please add HF_TOKEN to your .env.local file." },
          { status: 500 }
        );
      }

      if (!hfFastUrl && !hfQualityUrl) {
        return NextResponse.json(
          { error: "No HuggingFace endpoints configured. Please add HF_ENDPOINT_FAST_URL or HF_ENDPOINT_QUALITY_URL to your .env.local file." },
          { status: 500 }
        );
      }

      console.log('Starting HuggingFace video generation:', {
        prompt,
        tier,
        duration,
        aspectRatio,
        enableProgressTracking
      });

      try {
        const hfClient = new HuggingFaceVideoClient({
          token: hfToken,
          fastUrl: hfFastUrl,
          qualityUrl: hfQualityUrl
        });

        const inputParams = {
          prompt,
          duration: duration || 5,
          aspect_ratio: aspectRatio || "16:9",
          negative_prompt: negativePrompt || "",
          start_image: startImage,
          cfg_scale: cfg_scale || 7.5,
          seed: body.seed
        };

        // Check if endpoint is healthy
        const isHealthy = await hfClient.checkEndpointHealth(tier);
        if (!isHealthy) {
          console.warn(`HuggingFace ${tier} endpoint not healthy, may experience delays`);
        }

        // Direct generation (blocking)
        const videoUrl = await hfClient.generateVideo(inputParams, tier);

        console.log('HuggingFace video generated successfully:', videoUrl);

        return NextResponse.json({
          id: 'hf-' + Date.now(),
          status: 'succeeded',
          output: videoUrl,
          url: videoUrl,
          prompt,
          duration: duration || 5,
          aspectRatio: aspectRatio || "16:9",
          model: `huggingface-${tier}`,
          backend: 'huggingface',
          tier,
          sourceImage: startImage,
          enablePolling: false
        });

      } catch (error) {
        console.error('HuggingFace generation error:', error);
        
        let errorMessage = 'Failed to generate video with HuggingFace';
        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('authentication')) {
            errorMessage = 'Invalid HuggingFace token. Please check your configuration.';
          } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorMessage = 'HuggingFace rate limit exceeded. Please try again later.';
          } else if (error.message.includes('503') || error.message.includes('unavailable')) {
            errorMessage = `HuggingFace ${tier} endpoint is starting up. Please try again in a few minutes.`;
          } else {
            errorMessage = error.message;
          }
        }

        return NextResponse.json(
          {
            error: errorMessage,
            status: 'failed',
            stage: 'failed'
          },
          { status: 500 }
        );
      }
    }
    

    // Original Replicate logic continues below...
    // Check API key
    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      console.error('REPLICATE_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: "Replicate API key not configured. Please add REPLICATE_API_KEY to your .env.local file." },
        { status: 500 }
      );
    }

    console.log('Starting video generation with progress tracking:', {
      prompt,
      model,
      duration,
      aspectRatio,
      enableProgressTracking
    });

    // Create Replicate client
    const client = new ReplicateVideoClient(apiKey, model || 'standard');

    const inputParams = {
      prompt,
      duration: duration || 5,
      aspect_ratio: aspectRatio || "16:9",
      negative_prompt: negativePrompt || "",
      start_image: startImage,
      cfg_scale: cfg_scale || 0.5,
      reference_images: referenceImages
    };

    // Use prediction-based generation for better progress tracking
    if (enableProgressTracking) {
      try {
        console.log('Creating prediction for progress tracking...');
        const predictionId = await client.createPrediction(inputParams);

        console.log('Prediction created successfully:', predictionId);

        // Return prediction ID for polling
        return NextResponse.json({
          id: predictionId,
          predictionId,
          status: 'generating',
          stage: 'initializing',
          progress: 0,
          prompt,
          duration: duration || 5,
          aspectRatio: aspectRatio || "16:9",
          model: model || 'standard',
          sourceImage: startImage,
          enablePolling: true
        });
      } catch (predictionError) {
        console.log('Prediction creation failed, falling back to direct generation:', predictionError);
        // Fall through to direct generation
      }
    }

    // Fallback to direct generation (blocking, no progress tracking)
    try {
      console.log('Using direct generation (no progress tracking)...');
      const videoUrl = await client.generateVideo(inputParams);

      console.log('Video generated successfully:', videoUrl);

      // Return immediately with the video URL
      return NextResponse.json({
        id: 'kling-' + Date.now(),
        status: 'succeeded',
        output: videoUrl,
        url: videoUrl,
        prompt,
        duration: duration || 5,
        aspectRatio: aspectRatio || "16:9",
        model: model || 'standard',
        sourceImage: startImage,
        enablePolling: false
      });
    } catch (directError) {
      console.error('Both prediction and direct generation failed:', directError);
      throw directError;
    }

  } catch (error) {
    console.error('Video generation error:', error);

    // Parse specific error messages for better user feedback
    let errorMessage = 'Failed to generate video';
    if (error instanceof Error) {
      if (error.message.includes('authentication')) {
        errorMessage = 'Invalid Replicate API key. Please check your configuration.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
      } else if (error.message.includes('insufficient credits')) {
        errorMessage = 'Insufficient Replicate credits. Please add credits to your account.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        status: 'failed',
        stage: 'failed'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check video status (kept for backward compatibility)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const predictionId = searchParams.get('id');

    if (!predictionId) {
      return NextResponse.json(
        { error: "Prediction ID is required" },
        { status: 400 }
      );
    }

    // Check if this is a fake prediction ID (kling- + timestamp)
    if (predictionId.startsWith('kling-') && /^kling-\d+$/.test(predictionId)) {
      console.log('Detected fake prediction ID for completed video:', predictionId);
      return NextResponse.json({
        status: 'succeeded',
        output: null,
        thumbnailUrl: null
      });
    }

    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Replicate API key not configured" },
        { status: 500 }
      );
    }

    const client = new ReplicateVideoClient(apiKey);
    const status = await client.getVideoStatus(predictionId);

    // Generate thumbnail if video is ready
    let thumbnailUrl;
    if (status.status === 'succeeded' && status.output) {
      try {
        thumbnailUrl = status.output; // Use video URL as thumbnail for now
      } catch (error) {
        console.error('Error generating thumbnail:', error);
      }
    }

    return NextResponse.json({
      ...status,
      thumbnailUrl
    });

  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    );
  }
}
