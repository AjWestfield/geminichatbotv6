/**
 * Video Generation Handler for Chat Integration
 *
 * This module handles video generation requests from the chat interface
 */

import { detectImageAspectRatioFromGeminiUri } from '@/lib/server-image-utils'

export interface VideoGenerationRequest {
  type: 'text-to-video' | 'image-to-video';
  prompt: string;
  imageUrl?: string;
  imageUri?: string; // Google AI File Manager URI
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: 'standard' | 'pro' | 'fast';
  negativePrompt?: string;
  backend?: 'replicate' | 'huggingface';
  tier?: 'fast' | 'quality';
}

export class VideoGenerationHandler {
  /**
   * Detects if a message contains a video generation request
   * Enhanced to handle uploaded file context with automatic aspect ratio detection
   */
  static async detectVideoRequest(
    message: string,
    fileUri?: string,
    fileMimeType?: string
  ): Promise<VideoGenerationRequest | null> {
    console.log('[VIDEO DETECTION] Starting detection with params:', {
      message: message.substring(0, 100) + '...',
      fileUri: fileUri,
      fileMimeType: fileMimeType
    });

    const lowerMessage = message.toLowerCase();

    // Check if an image or video was uploaded
    const hasUploadedImage = fileUri && fileMimeType?.startsWith('image/');
    const hasUploadedVideo = fileUri && fileMimeType?.startsWith('video/');
    const hasUploadedMedia = hasUploadedImage || hasUploadedVideo;
    console.log('[VIDEO DETECTION] Has uploaded image:', hasUploadedImage);
    console.log('[VIDEO DETECTION] Has uploaded video:', hasUploadedVideo);
    console.log('[VIDEO DETECTION] Has uploaded media:', hasUploadedMedia);

    // Text-to-video patterns
    const textToVideoPatterns = [
      /(?:generate|create|make|produce)\s+(?:a\s+)?video\s+(?:of|showing|about)\s+(.+)/i,
      /(?:can you|please|could you)\s+(?:generate|create|make)\s+(?:a\s+)?video\s+(?:of|showing|about)\s+(.+)/i,
      /video\s+(?:of|showing|about)\s+(.+)/i,
      /(?:animate|animation)\s+(?:of|showing)\s+(.+?)(?:\s+from scratch)?/i,
      // More natural language patterns
      /(?:i want|i'd like|i need)\s+(?:you\s+)?(?:to\s+)?(?:create|make|generate)\s+(?:a\s+)?video\s+(.+)/i,
      /(?:create|make|generate)\s+(?:a\s+)?video\s+(?:like|similar to|just like)\s+(.+)/i,
      /(?:create|make|generate)\s+(?:me\s+)?(?:a\s+)?video/i,
      /(?:can you|could you|please)\s+(?:create|make|generate)\s+(?:me\s+)?(?:a\s+)?video/i
    ];

    // Image-to-video patterns (when user mentions animating an existing image)
    const imageToVideoPatterns = [
      /animate\s+(?:this|the)\s+image/i,
      /make\s+(?:this|the)\s+image\s+move/i,
      /turn\s+(?:this|the)\s+image\s+into\s+(?:a\s+)?video/i,
      /create\s+(?:an?\s+)?animation\s+from\s+(?:this|the)\s+image/i,
      /animate\s+(?:this|it)/i,
      /make\s+(?:this|it)\s+move/i,
      /bring\s+(?:this|the)\s+image\s+to\s+life/i,
      /add\s+motion\s+to\s+(?:this|the)\s+image/i
    ];

    // Video-to-video patterns (when user wants to create a video based on uploaded video)
    const videoToVideoPatterns = [
      /(?:create|make|generate)\s+(?:a\s+)?video\s+(?:like|similar to|just like|based on)\s+(?:this|it)/i,
      /(?:i want|i'd like|i need)\s+(?:you\s+)?(?:to\s+)?(?:create|make|generate)\s+(?:a\s+)?video\s+(?:like|similar to|just like)\s+(?:this|it)/i,
      /(?:create|make|generate)\s+(?:me\s+)?(?:a\s+)?(?:similar|new)\s+video/i,
      /(?:can you|could you|please)\s+(?:create|make|generate)\s+(?:a\s+)?video\s+(?:like|similar to|just like)\s+(?:this|it)/i,
      /recreate\s+(?:this\s+)?video/i,
      /make\s+(?:me\s+)?(?:another|a new)\s+video/i
    ];

    // Check for duration specifications
    const durationMatch = message.match(/(\d+)\s*(?:second|sec|s)\s+(?:video|animation)/i);
    let duration: 5 | 10 = durationMatch ? (parseInt(durationMatch[1]) === 10 ? 10 : 5) : 5;

    // Auto-detect aspect ratio from uploaded image or fall back to text parsing
    let aspectRatio: '16:9' | '9:16' | '1:1' = '16:9';
    let aspectRatioSource = 'default';

    // Priority 1: Auto-detect from uploaded image using server-side analysis
    if (hasUploadedImage && fileUri) {
      try {
        console.log('[VIDEO DETECTION] Auto-detecting aspect ratio from uploaded image...');
        aspectRatio = await detectImageAspectRatioFromGeminiUri(fileUri);
        aspectRatioSource = 'auto-detected';
        console.log(`[VIDEO DETECTION] ✅ Auto-detected aspect ratio: ${aspectRatio} from image`);
      } catch (error) {
        console.warn('[VIDEO DETECTION] Failed to auto-detect aspect ratio:', error);
        aspectRatioSource = 'fallback';
      }
    }

    // Priority 2: Parse from message text (if auto-detection failed or no image)
    if (aspectRatioSource !== 'auto-detected') {
      if (message.match(/portrait|vertical|9:16|mobile/i)) {
        aspectRatio = '9:16';
        aspectRatioSource = 'text-parsed';
      } else if (message.match(/square|1:1|instagram/i)) {
        aspectRatio = '1:1';
        aspectRatioSource = 'text-parsed';
      } else {
        aspectRatio = '16:9';
        aspectRatioSource = 'default';
      }
    }

    console.log(`[VIDEO DETECTION] Final aspect ratio: ${aspectRatio} (source: ${aspectRatioSource})`);

    // Check for model preference
    let model: 'standard' | 'pro' = 'standard';
    if (message.match(/high quality|best quality|pro|1080p|professional/i)) {
      model = 'pro';
    }

    // Check for backend preference
    let backend: 'replicate' | 'huggingface' = 'replicate';
    let tier: 'fast' | 'quality' = 'fast';
    
    if (message.match(/huggingface|hunyuan|hf/i)) {
      backend = 'huggingface';
      // Check for tier preference
      if (message.match(/quality|high quality|best|h100/i)) {
        tier = 'quality';
      }
    }

    // Check for media-to-video patterns first (higher priority when media is uploaded)
    if (hasUploadedMedia) {
      // For video uploads, check video-to-video patterns
      if (hasUploadedVideo) {
        console.log('[VIDEO DETECTION] Checking video-to-video patterns...');

        for (let i = 0; i < videoToVideoPatterns.length; i++) {
          const pattern = videoToVideoPatterns[i];
          const matches = pattern.test(message);
          console.log(`[VIDEO DETECTION] Video-to-video pattern ${i} (${pattern.source}): ${matches}`);

          if (matches) {
            console.log('[VIDEO DETECTION] ✅ Video-to-video pattern matched!');
            // For now, treat video-to-video as image-to-video (using first frame)
            const result = {
              type: 'image-to-video' as const,
              prompt: message,
              imageUri: fileUri,
              duration,
              aspectRatio,
              model,
              negativePrompt: '',
              backend,
              tier
            };
            console.log('[VIDEO DETECTION] Returning result:', result);
            return result;
          }
        }
      }

      // For image uploads, check image-to-video patterns
      if (hasUploadedImage) {
        console.log('[VIDEO DETECTION] Checking image-to-video patterns...');

        for (let i = 0; i < imageToVideoPatterns.length; i++) {
          const pattern = imageToVideoPatterns[i];
          const matches = pattern.test(message);
          console.log(`[VIDEO DETECTION] Image-to-video pattern ${i} (${pattern.source}): ${matches}`);

          if (matches) {
            console.log('[VIDEO DETECTION] ✅ Image-to-video pattern matched!');
            const result = {
              type: 'image-to-video' as const,
              prompt: message,
              imageUri: fileUri,
              duration,
              aspectRatio,
              model,
              negativePrompt: '',
              backend,
              tier
            };
            console.log('[VIDEO DETECTION] Returning result:', result);
            return result;
          }
        }
      }

      // Also check if user is asking for general animation/video creation with uploaded media
      const generalVideoMatch = message.match(/(?:create|make|generate)\s+(?:a\s+)?video|animate|animation|move|motion/i);
      console.log('[VIDEO DETECTION] General video/animation match:', generalVideoMatch);

      if (generalVideoMatch) {
        console.log('[VIDEO DETECTION] ✅ General video/animation pattern matched!');
        const result = {
          type: 'image-to-video' as const,
          prompt: message,
          imageUri: fileUri,
          duration,
          aspectRatio,
          model,
          negativePrompt: '',
          backend,
          tier
        };
        console.log('[VIDEO DETECTION] Returning result:', result);
        return result;
      }
    }

    console.log('[VIDEO DETECTION] Checking text-to-video patterns...');

    // Try to match text-to-video patterns
    for (let i = 0; i < textToVideoPatterns.length; i++) {
      const pattern = textToVideoPatterns[i];
      const match = message.match(pattern);
      console.log(`[VIDEO DETECTION] Text-to-video pattern ${i} (${pattern.source}): ${!!match}`);

      if (match) {
        console.log('[VIDEO DETECTION] ✅ Text-to-video pattern matched!');
        const result = {
          type: 'text-to-video' as const,
          prompt: match[1].trim(),
          duration,
          aspectRatio,
          model: model,
          negativePrompt: '',
          backend,
          tier
        };
        console.log('[VIDEO DETECTION] Returning result:', result);
        return result;
      }
    }

    console.log('[VIDEO DETECTION] ❌ No patterns matched, returning null');
    return null;
  }

  /**
   * Generates a response for video generation requests
   */
  static generateResponse(request: VideoGenerationRequest): string {
    const aspectRatioDisplay = {
      '16:9': 'Landscape (16:9)',
      '9:16': 'Portrait (9:16)',
      '1:1': 'Square (1:1)'
    }[request.aspectRatio] || request.aspectRatio;

    if (request.type === 'text-to-video') {
      const isHuggingFace = request.backend === 'huggingface';
      const modelName = isHuggingFace 
        ? `HunyuanVideo (${request.tier === 'quality' ? 'H100 Quality' : 'L40 S Fast'})`
        : `Kling v1.6 ${request.model === 'pro' ? 'Pro' : 'Standard'}`;
      const provider = isHuggingFace ? 'HuggingFace' : 'Replicate';
      const timeEstimate = isHuggingFace 
        ? (request.tier === 'quality' ? '6-8 minutes (including cold start)' : '3-4 minutes')
        : '5-8 minutes';

      return `I'll generate a ${request.duration}-second video of "${request.prompt}" for you.

**Video Details:**
- Provider: ${provider}
- Model: ${modelName}
- Duration: ${request.duration} seconds
- Aspect Ratio: ${aspectRatioDisplay}
- Quality: ${isHuggingFace && request.tier === 'quality' ? 'Highest quality (H100 GPU)' : request.model === 'pro' ? 'High quality professional output' : 'Standard quality'}

The video is being generated and will appear in the Video tab. ${modelName} typically takes ${timeEstimate} to generate a ${request.duration}-second video.

**Generation Process:**
1. The system is using ${provider}'s ${modelName} model
2. Your prompt is being processed to create the video
3. You'll see the result in the Video tab once complete
4. You can then view, download, or share your video

The video generation has started! Check the Video tab in a few minutes.`;
    } else {
      const isHuggingFace = request.backend === 'huggingface';
      const modelName = isHuggingFace 
        ? `HunyuanVideo (${request.tier === 'quality' ? 'H100 Quality' : 'L40 S Fast'})`
        : `Kling v1.6 ${request.model === 'pro' ? 'Pro (1080p)' : 'Standard (720p)'}`;
      const provider = isHuggingFace ? 'HuggingFace' : 'Replicate';
      const timeEstimate = isHuggingFace 
        ? (request.tier === 'quality' ? '6-8 minutes' : '3-4 minutes')
        : '5-8 minutes';

      return `I'm animating your uploaded image into a ${request.duration}-second video! 🎬

**Animation Details:**
- Provider: ${provider}
- Model: ${modelName}
- Duration: ${request.duration} seconds
- Aspect Ratio: ${aspectRatioDisplay} 🔮 *Auto-detected from your image*
- Source: Your uploaded image

**What's happening:**
1. Your image is being used as the starting frame
2. The AI will add natural motion and movement
3. The aspect ratio was automatically detected to match your image
4. The animation will appear in the Video tab once complete

**Animation Instructions:** "${request.prompt}"

The animation typically takes ${timeEstimate} to generate. You'll see the result in the Video tab!`;
    }
  }

  /**
   * Extracts video generation parameters from a message
   */
  static parseVideoParameters(message: string): {
    duration: 5 | 10;
    aspectRatio: '16:9' | '9:16' | '1:1';
    negativePrompt: string;
  } {
    // Duration
    const durationMatch = message.match(/(\d+)\s*(?:second|sec|s)/i);
    const duration = durationMatch ? (parseInt(durationMatch[1]) === 10 ? 10 : 5) : 5;

    // Aspect ratio (fallback for non-auto-detected cases)
    let aspectRatio: '16:9' | '9:16' | '1:1' = '16:9';
    if (message.match(/portrait|vertical|9:16|mobile/i)) {
      aspectRatio = '9:16';
    } else if (message.match(/square|1:1|instagram/i)) {
      aspectRatio = '1:1';
    }

    // Negative prompt
    const negativeMatch = message.match(/(?:without|no|avoid|exclude)\s+(.+?)(?:\.|,|;|$)/i);
    const negativePrompt = negativeMatch ? negativeMatch[1].trim() : '';

    return { duration, aspectRatio, negativePrompt };
  }
}
