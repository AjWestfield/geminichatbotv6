import { VideoGenerationInput } from "./video-generation-types";

export interface HFEndpointConfig {
  fastUrl?: string;
  qualityUrl?: string;
  token: string;
}

export interface HFPredictionResponse {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  output?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export class HuggingFaceVideoClient {
  private config: HFEndpointConfig;

  constructor(config: HFEndpointConfig) {
    this.config = config;
    
    if (!config.token) {
      throw new Error('HuggingFace token is required');
    }
    
    if (!config.fastUrl && !config.qualityUrl) {
      throw new Error('At least one endpoint URL (fast or quality) is required');
    }
  }

  /**
   * Generate video using HuggingFace Inference Endpoints
   */
  async generateVideo(
    input: VideoGenerationInput, 
    tier: 'fast' | 'quality' = 'fast'
  ): Promise<string> {
    const endpointUrl = tier === 'fast' ? this.config.fastUrl : this.config.qualityUrl;
    
    if (!endpointUrl) {
      throw new Error(`${tier} endpoint URL not configured`);
    }

    try {
      console.log(`Starting video generation with HuggingFace ${tier} endpoint`);
      console.log('Input:', input);

      // Format input for HunyuanVideo-Avatar model
      const hfInput = {
        inputs: {
          prompt: input.prompt,
          negative_prompt: input.negative_prompt || "",
          num_frames: this.calculateFrames(input.duration || 5),
          guidance_scale: input.cfg_scale || 7.5,
          width: this.getWidth(input.aspect_ratio || "16:9"),
          height: this.getHeight(input.aspect_ratio || "16:9"),
          seed: input.seed || -1
        },
        parameters: {
          max_new_tokens: 1,
          temperature: 0.7,
          use_cache: true // Enable TeaCache if available
        }
      };

      // Add image if provided for image-to-video
      if (input.start_image) {
        hfInput.inputs.image = input.start_image;
      }

      console.log('Calling HuggingFace endpoint:', endpointUrl);

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hfInput)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      
      // Handle different response formats
      if (typeof result === 'string') {
        return result;
      } else if (result.generated_video_url) {
        return result.generated_video_url;
      } else if (result.output) {
        return result.output;
      } else if (Array.isArray(result) && result.length > 0) {
        return result[0];
      } else {
        console.error('Unexpected response format:', result);
        throw new Error('Unexpected response format from HuggingFace');
      }

    } catch (error) {
      console.error('HuggingFace video generation error:', error);
      throw error;
    }
  }

  /**
   * Create an async prediction (for progress tracking)
   */
  async createPrediction(
    input: VideoGenerationInput,
    tier: 'fast' | 'quality' = 'fast'
  ): Promise<string> {
    const endpointUrl = tier === 'fast' ? this.config.fastUrl : this.config.qualityUrl;
    
    if (!endpointUrl) {
      throw new Error(`${tier} endpoint URL not configured`);
    }

    try {
      console.log(`Creating HuggingFace prediction with ${tier} endpoint`);

      // For async predictions, we'll use a different endpoint pattern
      const asyncUrl = endpointUrl.replace('/v1/chat/completions', '/async/predict');

      const hfInput = {
        inputs: {
          prompt: input.prompt,
          negative_prompt: input.negative_prompt || "",
          num_frames: this.calculateFrames(input.duration || 5),
          guidance_scale: input.cfg_scale || 7.5,
          width: this.getWidth(input.aspect_ratio || "16:9"),
          height: this.getHeight(input.aspect_ratio || "16:9")
        }
      };

      if (input.start_image) {
        hfInput.inputs.image = input.start_image;
      }

      const response = await fetch(asyncUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hfInput)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      return result.id || result.prediction_id;

    } catch (error) {
      console.error('Error creating HuggingFace prediction:', error);
      throw error;
    }
  }

  /**
   * Get prediction status
   */
  async getPredictionStatus(predictionId: string, endpointUrl: string): Promise<HFPredictionResponse> {
    try {
      const statusUrl = `${endpointUrl}/predictions/${predictionId}`;
      
      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get prediction status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting prediction status:', error);
      throw error;
    }
  }

  /**
   * Calculate number of frames based on duration
   * HunyuanVideo typically generates at 8 fps
   */
  private calculateFrames(durationSeconds: number): number {
    const fps = 8;
    return Math.min(Math.max(durationSeconds * fps, 16), 128); // Min 16, max 128 frames
  }

  /**
   * Get width based on aspect ratio
   */
  private getWidth(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      "16:9": 1280,
      "9:16": 720,
      "1:1": 1024,
      "4:3": 1024,
      "3:4": 768
    };
    return ratioMap[aspectRatio] || 1280;
  }

  /**
   * Get height based on aspect ratio
   */
  private getHeight(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      "16:9": 720,
      "9:16": 1280,
      "1:1": 1024,
      "4:3": 768,
      "3:4": 1024
    };
    return ratioMap[aspectRatio] || 720;
  }

  /**
   * Check endpoint health
   */
  async checkEndpointHealth(tier: 'fast' | 'quality' = 'fast'): Promise<boolean> {
    const endpointUrl = tier === 'fast' ? this.config.fastUrl : this.config.qualityUrl;
    
    if (!endpointUrl) {
      return false;
    }

    try {
      const healthUrl = `${endpointUrl}/health`;
      const response = await fetch(healthUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${tier} endpoint:`, error);
      return false;
    }
  }
}
