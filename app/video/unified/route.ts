import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 600; // 10 minutes timeout

/**
 * Unified Video Generation Endpoint
 * Handles both quick video generation and studio pipeline workflows
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workflow = 'quick', // 'quick' or 'studio'
      prompt,
      backend = 'replicate',
      model,
      duration,
      aspectRatio,
      startImage,
      negativePrompt,
      userId = 'anonymous',
      chatId = 'default'
    } = body;

    // Validate required fields
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log('[Unified Video API] Processing request:', {
      workflow,
      backend,
      prompt: prompt.substring(0, 100) + '...'
    });

    // Route to appropriate handler based on workflow
    if (workflow === 'studio') {
      // Studio workflow - use the generate API for full pipeline
      const generateResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || '3000'}`}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            image: startImage,
            userId,
            chatId
          })
        }
      );

      if (!generateResponse.ok) {
        const error = await generateResponse.text();
        throw new Error(`Studio generation failed: ${error}`);
      }

      const result = await generateResponse.json();
      return NextResponse.json({
        ...result,
        workflow: 'studio'
      });
      
    } else {
      // Quick workflow - use the generate-video API
      const videoBody = {
        prompt,
        duration: duration || 5,
        aspectRatio: aspectRatio || "16:9",
        model: model || 'standard',
        negativePrompt,
        startImage,
        backend,
        enableProgressTracking: true,
        useQueue: true,
        userId,
        chatId
      };


      const videoResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || '3000'}`}/api/generate-video`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(videoBody)
        }
      );

      if (!videoResponse.ok) {
        const error = await videoResponse.text();
        throw new Error(`Video generation failed: ${error}`);
      }

      const result = await videoResponse.json();
      return NextResponse.json({
        ...result,
        workflow: 'quick'
      });
    }

  } catch (error) {
    console.error('[Unified Video API] Error:', error);

    let errorMessage = 'Failed to process video generation request';
    if (error instanceof Error) {
      errorMessage = error.message;
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