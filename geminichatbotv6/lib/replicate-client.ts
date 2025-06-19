import Replicate from "replicate";
import { VideoGenerationInput } from "./video-generation-types";

export interface ImageEditingInput {
  prompt: string;
  input_image: string;
  aspect_ratio?: string;
  output_format?: string;
  safety_tolerance?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

export interface PredictionStatus {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ImageUpscaleInput {
  image: string;
  enhance_model?: 'Standard V2' | 'Low Resolution V2' | 'CGI' | 'High Fidelity V2' | 'Text Refine';
  upscale_factor?: 'None' | '2x' | '4x' | '6x';
  output_format?: 'jpg' | 'png';
  subject_detection?: 'None' | 'All' | 'Foreground' | 'Background';
  face_enhancement?: boolean;
  face_enhancement_creativity?: number;
  face_enhancement_strength?: number;
}

export class ReplicateVideoClient {
  private replicate: Replicate;
  private model: "kwaivgi/kling-v1.6-pro" | "kwaivgi/kling-v1.6-standard";

  constructor(apiKey: string, model: 'standard' | 'pro' = 'standard') {
    this.replicate = new Replicate({ auth: apiKey });

    // Using Kling v1.6 models as documented
    this.model = model === 'pro'
      ? "kwaivgi/kling-v1.6-pro"
      : "kwaivgi/kling-v1.6-standard";
  }

  /**
   * Generate video using direct run method (blocking, waits for completion)
   * Use this for immediate results when you don't need progress tracking
   */
  async generateVideo(input: VideoGenerationInput): Promise<string> {
    try {
      console.log(`Starting video generation with Kling v1.6 ${this.model.includes('pro') ? 'Pro' : 'Standard'} model`);
      console.log('Input:', input);

      // Format input according to Kling v1.6 API
      const replicateInput: any = {
        prompt: input.prompt,
        duration: input.duration || 5,
        cfg_scale: input.cfg_scale || 0.5,
        aspect_ratio: input.aspect_ratio || "16:9",
        negative_prompt: input.negative_prompt || ""
      };

      // Add start_image if provided (for image-to-video)
      if (input.start_image) {
        replicateInput.start_image = input.start_image;
      }

      console.log('Calling Replicate API with input:', replicateInput);

      const output = await this.replicate.run(this.model, { input: replicateInput });

      console.log('Replicate API response:', output);

      // The output should be a URL to the generated video
      if (typeof output === 'string') {
        console.log('Video generated successfully:', output);
        return output;
      } else if (output && typeof output === 'object' && 'url' in output) {
        // Sometimes the output is an object with a url method
        const url = typeof output.url === 'function' ? output.url() : output.url;
        console.log('Video generated successfully:', url);
        return url;
      } else if (Array.isArray(output) && output.length > 0) {
        console.log('Video generated successfully:', output[0]);
        return output[0];
      } else {
        console.error('Unexpected output format:', output);
        throw new Error('Unexpected output format from Replicate');
      }
    } catch (error) {
      console.error('Video generation error:', error);
      throw error;
    }
  }

  /**
   * Create a prediction for video generation (non-blocking, allows for polling)
   * Use this when you want to track progress and poll for status
   */
  async createPrediction(input: VideoGenerationInput): Promise<string> {
    try {
      console.log(`Creating prediction with Kling v1.6 ${this.model.includes('pro') ? 'Pro' : 'Standard'} model`);
      console.log('Input:', input);

      // Format input according to Kling v1.6 API
      const replicateInput: any = {
        prompt: input.prompt,
        duration: input.duration || 5,
        cfg_scale: input.cfg_scale || 0.5,
        aspect_ratio: input.aspect_ratio || "16:9",
        negative_prompt: input.negative_prompt || ""
      };

      // Add start_image if provided
      if (input.start_image) {
        replicateInput.start_image = input.start_image;
      }

      // Add reference images if provided
      if (input.reference_images && input.reference_images.length > 0) {
        replicateInput.reference_images = input.reference_images;
      }

      console.log('Creating Replicate prediction with input:', replicateInput);

      const prediction = await this.replicate.predictions.create({
        model: this.model,
        input: replicateInput
      });

      console.log('Prediction created successfully:', prediction.id);
      return prediction.id;
    } catch (error) {
      console.error('Error creating prediction:', error);
      throw error;
    }
  }

  /**
   * Get the status of a prediction
   */
  async getPredictionStatus(predictionId: string): Promise<PredictionStatus> {
    try {
      const prediction = await this.replicate.predictions.get(predictionId);

      return {
        id: prediction.id,
        status: prediction.status,
        output: prediction.output,
        error: prediction.error?.toString(),
        logs: prediction.logs,
        created_at: prediction.created_at,
        started_at: prediction.started_at,
        completed_at: prediction.completed_at
      };
    } catch (error) {
      console.error('Error getting prediction status:', error);
      throw error;
    }
  }

  /**
   * Wait for a prediction to complete (with optional timeout)
   */
  async waitForPrediction(predictionId: string, timeoutMs: number = 600000): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getPredictionStatus(predictionId);

      if (status.status === 'succeeded') {
        if (typeof status.output === 'string') {
          return status.output;
        } else if (Array.isArray(status.output) && status.output.length > 0) {
          return status.output[0];
        } else {
          throw new Error('No output URL found in successful prediction');
        }
      } else if (status.status === 'failed' || status.status === 'canceled') {
        throw new Error(status.error || `Prediction ${status.status}`);
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Prediction timed out');
  }

  /**
   * Cancel a prediction
   */
  async cancelPrediction(predictionId: string): Promise<void> {
    try {
      await this.replicate.predictions.cancel(predictionId);
      console.log('Prediction canceled successfully:', predictionId);
    } catch (error) {
      console.error('Error canceling prediction:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async getVideoStatus(predictionId: string): Promise<{
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    output?: string;
    error?: string;
  }> {
    const prediction = await this.getPredictionStatus(predictionId);
    return {
      status: prediction.status,
      output: typeof prediction.output === 'string' ? prediction.output :
              Array.isArray(prediction.output) ? prediction.output[0] : undefined,
      error: prediction.error
    };
  }
}

/**
 * Replicate Image Client with Portrait Generation Optimizations
 * 
 * Portrait Generation (9:16 aspect ratio) Optimizations:
 * - safety_tolerance: 4 (vs default 2) - prevents over-filtering of portrait content
 * - guidance_scale: 8.5 (vs default) - enhanced prompt adherence for realistic portraits  
 * - num_inference_steps: 45 (vs default) - higher quality at 1024x1536 resolution
 * 
 * Portrait Editing Optimizations:
 * - safety_tolerance: 3 (vs default 2) - balanced filtering for editing
 * - guidance_scale: 7.5 - balanced editing without over-modification
 * - num_inference_steps: 40 - quality enhancement for edited portraits
 */
export class ReplicateImageClient {
  private replicate: Replicate;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Replicate API key is required');
    }
    console.log('Initializing ReplicateImageClient with API key:', apiKey.substring(0, 10) + '...');
    this.replicate = new Replicate({ auth: apiKey });
  }

  async generateImage(model: 'flux-kontext-pro' | 'flux-kontext-max' | 'flux-pro' | 'flux-1.1-pro' | 'flux-dev-ultra-fast', prompt: string, options: {
    aspect_ratio?: string,
    output_format?: string,
    safety_tolerance?: number,
    guidance_scale?: number,
    num_inference_steps?: number
  } = {}): Promise<string> {
    try {
      console.log(`Starting image generation with ${model} model`);
      console.log('Prompt:', prompt);

      // Ensure output format is supported by Replicate (only "jpg" and "png")
      const supportedFormat = options.output_format === "png" ? "png" : "jpg"; // Default to jpg
      
      // Determine if this is portrait generation (9:16 aspect ratio)
      const isPortraitGeneration = options.aspect_ratio === "9:16";
      
      // Optimize safety_tolerance for portrait generation
      let optimizedSafetyTolerance = options.safety_tolerance;
      if (!optimizedSafetyTolerance) {
        // For portrait generation, use higher safety_tolerance (3-4) to prevent over-filtering
        // For other aspect ratios, use default (2)
        optimizedSafetyTolerance = isPortraitGeneration ? 4 : 2;
      }
      
      // For Flux Kontext, when doing text-to-image (no input_image), 
      // we might need to explicitly set certain parameters
      const replicateInput: any = {
        prompt: prompt,
        aspect_ratio: options.aspect_ratio || "1:1",
        output_format: supportedFormat,
      };
      
      // Only add safety_tolerance for Flux Kontext models
      if (model === 'flux-kontext-pro' || model === 'flux-kontext-max') {
        replicateInput.safety_tolerance = optimizedSafetyTolerance;
        
        // Add guidance_scale for better prompt adherence (especially important for portraits)
        if (options.guidance_scale !== undefined) {
          replicateInput.guidance_scale = options.guidance_scale;
        } else if (isPortraitGeneration) {
          // For portrait generation, use higher guidance_scale (8.5) for better realism
          replicateInput.guidance_scale = 8.5;
        }
        
        // Add num_inference_steps for higher quality (especially for portraits at high resolution)
        if (options.num_inference_steps !== undefined) {
          replicateInput.num_inference_steps = options.num_inference_steps;
        } else if (isPortraitGeneration) {
          // For portrait generation at 1024x1536, use more steps for better quality
          replicateInput.num_inference_steps = 45;
        }
      }

      // Log portrait generation optimizations
      if (isPortraitGeneration) {
        console.log('🖼️ Portrait generation (9:16) detected - applying optimizations:');
        console.log(`  - safety_tolerance: ${replicateInput.safety_tolerance} (optimized for portraits)`);
        console.log(`  - guidance_scale: ${replicateInput.guidance_scale || 'default'} (enhanced for realism)`);
        console.log(`  - num_inference_steps: ${replicateInput.num_inference_steps || 'default'} (higher quality)`);
      }

      console.log('Calling Replicate API with input:', replicateInput);

      let modelString: string;
      switch (model) {
        case 'flux-kontext-pro':
          modelString = "black-forest-labs/flux-kontext-pro";
          break;
        case 'flux-kontext-max':
          modelString = "black-forest-labs/flux-kontext-max";
          break;
        case 'flux-pro':
          modelString = "black-forest-labs/flux-pro";
          break;
        case 'flux-1.1-pro':
          modelString = "black-forest-labs/flux-1.1-pro";
          break;
        case 'flux-dev-ultra-fast':
          modelString = "black-forest-labs/flux-dev";
          break;
        default:
          // Default to gpt-image-1 which will be handled by OpenAI
          console.log(`⚠️ Unknown model '${model}' for Replicate, should be handled by OpenAI`);
          throw new Error(`Model '${model}' is not a Replicate model`);
      }

      console.log('Using model string:', modelString);
      console.log('About to call Replicate API...');
      
      let output: any;
      let retryCount = 0;
      const maxRetries = 2;
      const baseTimeout = 60000; // 60 seconds base timeout
      
      while (retryCount <= maxRetries) {
        try {
          // Add a timeout with exponential backoff
          const timeout = baseTimeout * (retryCount + 1);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Replicate API timeout after ${timeout / 1000} seconds`)), timeout)
          );
          
          console.log(`Attempting Replicate API call (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          const apiCallPromise = this.replicate.run(modelString, { input: replicateInput });
          
          output = await Promise.race([apiCallPromise, timeoutPromise]);
          console.log('Replicate API call completed successfully');
          break; // Success, exit the retry loop
        } catch (apiError: any) {
          console.error(`Replicate API call failed (attempt ${retryCount + 1}):`, apiError);
          
          if (retryCount < maxRetries && apiError.message?.includes('timeout')) {
            retryCount++;
            console.log(`Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          } else {
            throw apiError;
          }
        }
      }

      console.log('Replicate API response type:', typeof output);
      console.log('Output constructor name:', output?.constructor?.name);
      console.log('Raw output:', output);

      // Handle various response formats
      // 1. Direct string URL
      if (typeof output === 'string') {
        if (output.startsWith('http') || output.startsWith('data:')) {
          console.log('Image generated successfully (string):', output);
          return output;
        }
      }
      
      // 2. Array of URLs
      if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem === 'string' && (firstItem.startsWith('http') || firstItem.startsWith('data:'))) {
          console.log('Image generated successfully (array):', firstItem);
          return firstItem;
        }
      }
      
      // 3. Object with URL property/method
      if (output && typeof output === 'object') {
        // Enhanced URL extraction for FileOutput objects
        if (output.constructor?.name === 'FileOutput') {
          // For FileOutput objects, try different URL extraction methods
          try {
            // Method 1: Direct URL property
            if (output.url && typeof output.url === 'string') {
              console.log('Image generated successfully (FileOutput.url):', output.url);
              return output.url;
            }
            
            // Method 2: URL method
            if (typeof output.url === 'function') {
              const url = output.url();
              if (url && typeof url === 'string') {
                console.log('Image generated successfully (FileOutput.url()):', url);
                return url;
              }
            }
            
            // Method 3: toString method might return URL
            if (typeof output.toString === 'function') {
              const urlString = output.toString();
              if (urlString && typeof urlString === 'string' && urlString.startsWith('http')) {
                console.log('Image generated successfully (FileOutput.toString()):', urlString);
                return urlString;
              }
            }
            
            // Method 4: Check if output has href property (URL-like objects)
            if (output.href && typeof output.href === 'string') {
              console.log('Image generated successfully (FileOutput.href):', output.href);
              return output.href;
            }
          } catch (urlError) {
            console.warn('Error extracting URL from FileOutput:', urlError);
          }
        }
        
        // Check for .url() method (some Replicate responses have this)
        if ('url' in output && typeof output.url === 'function') {
          const url = output.url();
          console.log('Image generated successfully (url method):', url);
          return url;
        }
        
        // Check for direct .url property
        if ('url' in output && typeof output.url === 'string') {
          console.log('Image generated successfully (url property):', output.url);
          return output.url;
        }
        
        // Check for .output property
        if ('output' in output) {
          const innerOutput = output.output;
          if (typeof innerOutput === 'string' && (innerOutput.startsWith('http') || innerOutput.startsWith('data:'))) {
            console.log('Image generated successfully (output property):', innerOutput);
            return innerOutput;
          }
          if (Array.isArray(innerOutput) && innerOutput.length > 0 && typeof innerOutput[0] === 'string') {
            console.log('Image generated successfully (output array):', innerOutput[0]);
            return innerOutput[0];
          }
        }
        
        // Handle async iterator (streaming response)
        if (Symbol.asyncIterator in output) {
          console.log('Handling streaming response...');
          const outputs: any[] = [];
          
          // Iterate through the stream to collect all outputs
          for await (const event of output as any) {
            console.log('Stream event:', event);
            outputs.push(event);
          }

          console.log('All stream outputs:', outputs);

          // Try to find the image URL in the outputs
          for (const item of outputs) {
            if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:'))) {
              console.log('Found image URL in stream:', item);
              return item;
            } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
              console.log('Found image URL array in stream:', item[0]);
              return item[0];
            } else if (item && typeof item === 'object' && item.output) {
              if (typeof item.output === 'string') {
                console.log('Found image URL in output property:', item.output);
                return item.output;
              } else if (Array.isArray(item.output) && item.output.length > 0) {
                console.log('Found image URL array in output property:', item.output[0]);
                return item.output[0];
              }
            }
          }
        }
      }
      
      // If we couldn't parse the output, log it and throw an error
      console.error('🚨 Failed to extract image URL from Replicate response');
      console.error('Input parameters:', replicateInput);
      console.error('Model used:', modelString);
      console.error('Output type:', typeof output);
      console.error('Output constructor:', output?.constructor?.name);
      console.error('Output keys:', output && typeof output === 'object' ? Object.keys(output) : 'N/A');
      console.error('Full output:', JSON.stringify(output, null, 2));
      
      // Special handling for portrait generation
      if (options.aspect_ratio === '9:16') {
        console.error('❌ Portrait aspect ratio (9:16) URL extraction failed');
        console.error('This suggests a response format issue with Flux Kontext models for portrait images');
      }
      
      throw new Error(`Failed to get valid image URL from Replicate. Response type: ${typeof output}, Constructor: ${output?.constructor?.name}`);
    } catch (error) {
      console.error('Image generation error:', error);
      console.error('Generation params:', { model, prompt, options });
      
      // Special logging for portrait failures
      if (options.aspect_ratio === '9:16') {
        console.error('🚨 Portrait aspect ratio (9:16) generation failed');
        console.error('This should work with Flux Kontext models');
      }
      
      throw error;
    }
  }

  async editImage(model: 'flux-kontext-pro' | 'flux-kontext-max' | 'flux-pro' | 'flux-1.1-pro', input: ImageEditingInput): Promise<string> {
    try {
      console.log(`Starting image editing with ${model} model`);
      console.log('Edit prompt:', input.prompt);
      console.log('Input image:', input.input_image ? 'provided' : 'missing');

      // Flux Kontext models DO support image-to-image editing
      // IMPORTANT: Replicate only supports "jpg" and "png" output formats, NOT "webp"
      const supportedFormat = input.output_format === "png" ? "png" : "jpg"; // Default to jpg
      
      // Determine if this is portrait editing (9:16 aspect ratio)
      const isPortraitEditing = input.aspect_ratio === "9:16";
      
      // Optimize safety_tolerance for portrait editing
      let optimizedSafetyTolerance = input.safety_tolerance;
      if (!optimizedSafetyTolerance) {
        // For portrait editing, use higher safety_tolerance (3) to prevent over-filtering
        // Note: For editing with input images, max is typically lower than text-to-image
        optimizedSafetyTolerance = isPortraitEditing ? 3 : 2;
      }
      
      const replicateInput: any = {
        prompt: input.prompt,
        input_image: input.input_image, // This is the key parameter for editing
        aspect_ratio: input.aspect_ratio || "match_input_image", // Preserve original dimensions by default
        output_format: supportedFormat, // Only "jpg" or "png" supported by Replicate
        safety_tolerance: Math.min(optimizedSafetyTolerance, 3) // Max 3 for editing with input images
      };
      
      // Add guidance_scale for better prompt adherence in editing
      if (input.guidance_scale !== undefined) {
        replicateInput.guidance_scale = input.guidance_scale;
      } else if (isPortraitEditing) {
        // For portrait editing, use moderate guidance_scale (7.5) for balanced editing
        replicateInput.guidance_scale = 7.5;
      }
      
      // Add num_inference_steps for higher quality editing
      if (input.num_inference_steps !== undefined) {
        replicateInput.num_inference_steps = input.num_inference_steps;
      } else if (isPortraitEditing) {
        // For portrait editing, use more steps for better quality
        replicateInput.num_inference_steps = 40;
      }

      // Log portrait editing optimizations
      if (isPortraitEditing) {
        console.log('🖼️ Portrait editing (9:16) detected - applying optimizations:');
        console.log(`  - safety_tolerance: ${replicateInput.safety_tolerance} (optimized for portrait editing)`);
        console.log(`  - guidance_scale: ${replicateInput.guidance_scale || 'default'} (balanced editing)`);
        console.log(`  - num_inference_steps: ${replicateInput.num_inference_steps || 'default'} (higher quality)`);
      }

      console.log('Calling Replicate API with edit input:', replicateInput);

      let modelString: string;
      switch (model) {
        case 'flux-kontext-pro':
          modelString = "black-forest-labs/flux-kontext-pro";
          break;
        case 'flux-kontext-max':
          modelString = "black-forest-labs/flux-kontext-max";
          break;
        case 'flux-pro':
          modelString = "black-forest-labs/flux-pro";
          break;
        case 'flux-1.1-pro':
          modelString = "black-forest-labs/flux-1.1-pro";
          break;
        default:
          modelString = "black-forest-labs/flux-kontext-pro";
      }

      let output: any;
      let retryCount = 0;
      const maxRetries = 2;
      const baseTimeout = 60000; // 60 seconds base timeout
      
      while (retryCount <= maxRetries) {
        try {
          // Add a timeout with exponential backoff
          const timeout = baseTimeout * (retryCount + 1);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Replicate API timeout after ${timeout / 1000} seconds`)), timeout)
          );
          
          console.log(`Attempting Replicate API call (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          const apiCallPromise = this.replicate.run(modelString, { input: replicateInput });
          
          output = await Promise.race([apiCallPromise, timeoutPromise]);
          console.log('Replicate API call completed successfully');
          break; // Success, exit the retry loop
        } catch (apiError: any) {
          console.error(`Replicate API call failed (attempt ${retryCount + 1}):`, apiError);
          
          if (retryCount < maxRetries && apiError.message?.includes('timeout')) {
            retryCount++;
            console.log(`Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          } else {
            throw apiError;
          }
        }
      }

      console.log('Replicate API edit response type:', typeof output);
      console.log('Raw output:', output);

      // Use the same response parsing logic as generateImage
      // 1. Direct string URL
      if (typeof output === 'string') {
        if (output.startsWith('http') || output.startsWith('data:')) {
          console.log('Image edited successfully (string):', output);
          return output;
        }
      }
      
      // 2. Array of URLs
      if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem === 'string' && (firstItem.startsWith('http') || firstItem.startsWith('data:'))) {
          console.log('Image edited successfully (array):', firstItem);
          return firstItem;
        }
      }
      
      // 3. Object with URL property/method
      if (output && typeof output === 'object') {
        // Check for .url() method
        if ('url' in output && typeof output.url === 'function') {
          const url = output.url();
          console.log('Image edited successfully (url method):', url);
          return url;
        }
        
        // Check for direct .url property
        if ('url' in output && typeof output.url === 'string') {
          console.log('Image edited successfully (url property):', output.url);
          return output.url;
        }
        
        // Check for .output property
        if ('output' in output) {
          const innerOutput = output.output;
          if (typeof innerOutput === 'string' && (innerOutput.startsWith('http') || innerOutput.startsWith('data:'))) {
            console.log('Image edited successfully (output property):', innerOutput);
            return innerOutput;
          }
          if (Array.isArray(innerOutput) && innerOutput.length > 0 && typeof innerOutput[0] === 'string') {
            console.log('Image edited successfully (output array):', innerOutput[0]);
            return innerOutput[0];
          }
        }
      }
      
      // If we couldn't parse the output, log it and throw an error
      console.error('Unexpected edit output format. Full output:', JSON.stringify(output, null, 2));
      throw new Error(`Unexpected output format from Replicate edit. Type: ${typeof output}`);
    } catch (error) {
      console.error('Image editing error:', error);
      throw error;
    }
  }

  async upscaleImage(input: ImageUpscaleInput): Promise<string> {
    try {
      console.log('Starting image upscaling with Topaz Labs model');
      console.log('Input settings:', {
        enhance_model: input.enhance_model || 'Standard V2',
        upscale_factor: input.upscale_factor || 'None',
        output_format: input.output_format || 'jpg',
        subject_detection: input.subject_detection || 'None',
        face_enhancement: input.face_enhancement || false
      });

      // Prepare input with defaults
      const replicateInput: any = {
        image: input.image,
        enhance_model: input.enhance_model || 'Standard V2',
        upscale_factor: input.upscale_factor || 'None',
        output_format: input.output_format || 'jpg',
        subject_detection: input.subject_detection || 'None',
        face_enhancement: input.face_enhancement || false
      };

      // Only add face enhancement parameters if face enhancement is enabled
      if (input.face_enhancement) {
        replicateInput.face_enhancement_creativity = input.face_enhancement_creativity ?? 0;
        replicateInput.face_enhancement_strength = input.face_enhancement_strength ?? 0.8;
      }

      console.log('Calling Replicate API with Topaz Labs model...');
      const output = await this.replicate.run("topazlabs/image-upscale", { input: replicateInput });

      console.log('Replicate API response type:', typeof output);
      console.log('Raw output:', output);

      // Handle response (similar to generateImage parsing)
      if (typeof output === 'string') {
        if (output.startsWith('http') || output.startsWith('data:')) {
          console.log('Image upscaled successfully (string):', output);
          return output;
        }
      }

      if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem === 'string' && (firstItem.startsWith('http') || firstItem.startsWith('data:'))) {
          console.log('Image upscaled successfully (array):', firstItem);
          return firstItem;
        }
      }

      if (output && typeof output === 'object') {
        // Handle FileOutput objects
        if (output.constructor?.name === 'FileOutput') {
          try {
            if (output.url && typeof output.url === 'string') {
              console.log('Image upscaled successfully (FileOutput.url):', output.url);
              return output.url;
            }
            
            if (typeof output.url === 'function') {
              const url = output.url();
              if (url && typeof url === 'string') {
                console.log('Image upscaled successfully (FileOutput.url()):', url);
                return url;
              }
            }
            
            if (typeof output.toString === 'function') {
              const urlString = output.toString();
              if (urlString && typeof urlString === 'string' && urlString.startsWith('http')) {
                console.log('Image upscaled successfully (FileOutput.toString()):', urlString);
                return urlString;
              }
            }
          } catch (urlError) {
            console.warn('Error extracting URL from FileOutput:', urlError);
          }
        }

        // Check for other object patterns
        if ('url' in output) {
          if (typeof output.url === 'function') {
            const url = output.url();
            console.log('Image upscaled successfully (url method):', url);
            return url;
          }
          if (typeof output.url === 'string') {
            console.log('Image upscaled successfully (url property):', output.url);
            return output.url;
          }
        }

        if ('output' in output) {
          const innerOutput = output.output;
          if (typeof innerOutput === 'string' && (innerOutput.startsWith('http') || innerOutput.startsWith('data:'))) {
            console.log('Image upscaled successfully (output property):', innerOutput);
            return innerOutput;
          }
          if (Array.isArray(innerOutput) && innerOutput.length > 0 && typeof innerOutput[0] === 'string') {
            console.log('Image upscaled successfully (output array):', innerOutput[0]);
            return innerOutput[0];
          }
        }
      }

      console.error('Failed to extract image URL from Topaz Labs response');
      console.error('Output type:', typeof output);
      console.error('Output constructor:', output?.constructor?.name);
      console.error('Full output:', JSON.stringify(output, null, 2));
      
      throw new Error(`Failed to get valid image URL from Topaz Labs upscaling. Response type: ${typeof output}`);
    } catch (error) {
      console.error('Image upscaling error:', error);
      throw error;
    }
  }
}
