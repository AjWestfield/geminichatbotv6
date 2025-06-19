import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;

    if (!predictionId) {
      return NextResponse.json(
        { error: 'Prediction ID is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Replicate API key not configured' },
        { status: 500 }
      );
    }

    const replicate = new Replicate({
      auth: apiKey,
    });

    // Get prediction status from Replicate
    const prediction = await replicate.predictions.get(predictionId);

    console.log(`[VIDEO STATUS] Prediction ${predictionId} status:`, prediction.status);

    // Map Replicate status to our internal status
    let status: 'generating' | 'completed' | 'failed' = 'generating';
    let stage: 'initializing' | 'processing' | 'finalizing' | 'completed' | 'failed' = 'processing';
    let progress = 50; // Default progress
    let error: string | undefined;

    switch (prediction.status) {
      case 'starting':
        status = 'generating';
        stage = 'initializing';
        progress = 5;
        break;
      case 'processing':
        status = 'generating';
        stage = 'processing';
        progress = 50; // We'll calculate this based on elapsed time
        break;
      case 'succeeded':
        status = 'completed';
        stage = 'completed';
        progress = 100;
        break;
      case 'failed':
        status = 'failed';
        stage = 'failed';
        progress = 0;
        error = prediction.error?.toString() || 'Generation failed';
        break;
      case 'canceled':
        status = 'failed';
        stage = 'failed';
        progress = 0;
        error = 'Generation was canceled';
        break;
      default:
        // For any other status, assume processing
        status = 'generating';
        stage = 'processing';
        progress = 25;
    }

    // Calculate estimated time remaining based on elapsed time
    const createdAt = new Date(prediction.created_at);
    const now = new Date();
    const elapsedTime = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    // Kling v1.6 typical generation times (in seconds)
    const estimatedTotalTime = 300; // 5 minutes average
    const estimatedRemainingTime = Math.max(0, estimatedTotalTime - elapsedTime);

    // Refine progress based on elapsed time if still processing
    if (status === 'generating' && stage === 'processing') {
      const timeProgress = Math.min(elapsedTime / estimatedTotalTime, 0.9); // Cap at 90% until completion
      progress = Math.floor(10 + (timeProgress * 75)); // 10% to 85% range for processing
    }

    const response = {
      id: predictionId,
      status,
      stage,
      progress,
      error,
      output: prediction.output,
      replicateStatus: prediction.status,
      elapsedTime,
      estimatedRemainingTime,
      logs: prediction.logs,
      urls: prediction.urls
    };

    console.log(`[VIDEO STATUS] Returning response:`, response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching video status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch video status';

    return NextResponse.json(
      {
        error: errorMessage,
        status: 'failed',
        stage: 'failed',
        progress: 0
      },
      { status: 500 }
    );
  }
}
