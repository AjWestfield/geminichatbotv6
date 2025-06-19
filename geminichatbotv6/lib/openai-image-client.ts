/**
 * OpenAI GPT-Image-1 Client
 *
 * GPT-Image-1 is OpenAI's multimodal image generation model
 * - Requires organization verification (government ID + facial verification)
 * - Uses token-based pricing for text, image input, and image output
 * - Supports generation, editing, and variations
 * - Can process up to 10 input images
 *
 * Key Features:
 * - High-fidelity image generation
 * - Image-to-image transformations
 * - Inpainting with alpha channel masks
 * - Multi-image composition
 * - Accurate text rendering in images
 * - Transparent background support
 *
 * IMPORTANT: GPT-Image-1 has specific parameter requirements:
 * - quality: "low", "medium", "high" (NOT "standard" or "hd")
 * - NO style parameter supported (unlike DALL-E models)
 * - edit operations do NOT accept quality parameter
 */

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

interface GPTImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

interface GPTImageErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * Convert image URL to base64 data
 * Works in both browser and Node.js environments
 */
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    // Get the image as array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Convert to base64
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return as data URL
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert URL to base64:', error);
    throw new Error('Failed to process image URL');
  }
}

/**
 * Generate a new image using GPT-Image-1
 */
export async function generateImageWithGPTImage1(
  prompt: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    quality?: 'low' | 'medium' | 'high';
    output_format?: 'png' | 'jpeg' | 'webp';
    background?: 'transparent' | 'auto';
    moderation?: 'low' | 'auto';
    n?: number;
  } = {}
) {
  const {
    size = '1024x1024',
    quality = 'medium',
    output_format = 'png',
    background = 'auto',
    moderation = 'auto',
    n = 1,
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {
    console.log('Generating image...');
    console.log(`Quality: ${quality}, Size: ${size}, Format: ${output_format}`);

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n,
      size: size as any,
      quality: quality as any,
      output_format: output_format as any,
      background: background as any,
      moderation: moderation as any,
    });

    // Handle both URL and base64 responses
    let resultImageUrl = response.data[0]?.url;
    if (!resultImageUrl && response.data[0]?.b64_json) {
      resultImageUrl = `data:image/${output_format};base64,${response.data[0].b64_json}`;
    }

    return {
      success: true,
      imageUrl: resultImageUrl || '',
      revisedPrompt: response.data[0]?.revised_prompt,
      model: 'gpt-image-1',
    };
  } catch (error: any) {
    console.error('GPT-Image-1 generation error:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // If GPT-Image-1 requires verification or is not available
    if (error.message?.includes('invalid_model') || 
        error.message?.includes('model_not_found') ||
        error.message?.includes('verification required') ||
        error.message?.includes('organization not verified')) {
      
      console.log('GPT-Image-1 not available, falling back to DALL-E-3...');
      
      // Fall back to DALL-E-3 (which supports style parameter)
      try {
        // Map GPT-Image-1 quality values to DALL-E-3 quality values
        // GPT-Image-1: 'low', 'medium', 'high' -> DALL-E-3: 'standard', 'hd'
        let dalle3Quality: 'standard' | 'hd' = 'standard';
        if (quality === 'high') {
          dalle3Quality = 'hd';
        }
        
        const dalle3Response = await openai.images.generate({
          model: 'dall-e-3',
          prompt,
          n: 1, // DALL-E-3 only supports n=1
          size: size as any,
          quality: dalle3Quality,
          // Note: DALL-E-3 supports style but not background/moderation
        });

        return {
          success: true,
          imageUrl: dalle3Response.data[0]?.url || '',
          revisedPrompt: dalle3Response.data[0]?.revised_prompt,
          model: 'dall-e-3 (fallback)',
        };
      } catch (dalle3Error: any) {
        console.error('DALL-E-3 fallback also failed:', dalle3Error.message);
        // Try DALL-E-2 as last resort
        const dalle2Response = await openai.images.generate({
          model: 'dall-e-2',
          prompt,
          n,
          size: size === '1536x1024' || size === '1024x1536' ? '1024x1024' : size as any,
        });

        return {
          success: true,
          imageUrl: dalle2Response.data[0]?.url || '',
          model: 'dall-e-2 (fallback)',
        };
      }
    }

    throw error;
  }
}

/**
 * Edit an existing image using GPT-Image-1's image-to-image capabilities
 * Note: GPT-Image-1 edit operations do NOT accept quality parameter
 */
export async function editImageWithGPTImage1(
  imageUrl: string,
  prompt: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    mask?: string; // Optional mask URL for inpainting
    n?: number;
  } = {}
) {
  const {
    size = '1024x1024',
    mask,
    n = 1,
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {
    console.log('Editing image with GPT-Image-1...');
    console.log('Original image:', imageUrl.substring(0, 50) + '...');
    console.log('Edit prompt:', prompt);

    let imageBuffer: Buffer;

    // Handle different URL types
    if (imageUrl.startsWith('blob:')) {
      // Blob URLs cannot be accessed on the server side
      throw new Error('Blob URLs cannot be processed on the server. Please ensure images are converted to data URLs before sending to the API.');
    } else if (imageUrl.startsWith('data:')) {
      console.log('Processing data URL for editing...');
      // Extract base64 data from data URL
      const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid data URL format');
      }
      const base64Data = base64Match[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Download the image from HTTP URL
      console.log('Downloading image from URL...');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(imageArrayBuffer);
    }

    // Convert buffer to File using OpenAI's toFile helper
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    // Prepare parameters for GPT-Image-1 edit
    // Note: NO quality parameter for edit operations
    const editParams: any = {
      model: 'gpt-image-1',
      image: imageFile,
      prompt: prompt,
      size: size as any,
      n: n,
    };

    // Add mask if provided for inpainting
    if (mask) {
      const maskResponse = await fetch(mask);
      if (maskResponse.ok) {
        const maskArrayBuffer = await maskResponse.arrayBuffer();
        const maskBuffer = Buffer.from(maskArrayBuffer);
        const maskFile = await toFile(maskBuffer, 'mask.png', { type: 'image/png' });
        editParams.mask = maskFile;
        console.log('Using mask for inpainting');
      }
    }

    // Use OpenAI SDK to edit the image
    const response = await openai.images.edit(editParams);

    // Handle both URL and base64 responses
    let resultImageUrl = response.data[0]?.url;

    if (!resultImageUrl && response.data[0]?.b64_json) {
      // Convert base64 to data URL
      resultImageUrl = `data:image/png;base64,${response.data[0].b64_json}`;
    }

    return {
      success: true,
      imageUrl: resultImageUrl || '',
      originalImageUrl: imageUrl,
      prompt,
      revisedPrompt: response.data[0]?.revised_prompt,
      model: 'gpt-image-1',
      method: 'image-to-image',
    };
  } catch (error: any) {
    console.error('GPT-Image-1 edit error:', error);
    console.error('Error details:', error.response?.data || error.message);

    // Check for moderation/safety system errors first
    if (error.message?.includes('safety system') || error.code === 'moderation_blocked' || error.type === 'image_generation_user_error') {
      // Pass through the moderation error without fallback
      throw error;
    }

    // If the model is not found or requires verification
    if (error.message?.includes('invalid_model') || 
        error.message?.includes('model_not_found') ||
        error.message?.includes('verification required')) {
      // Try with dall-e-2 as fallback
      console.log('GPT-Image-1 not available, falling back to dall-e-2...');

      const openai = new OpenAI({ apiKey });

      // Re-process the image for the fallback attempt
      let fallbackImageBuffer: Buffer;
      if (imageUrl.startsWith('blob:')) {
        throw new Error('Blob URLs cannot be processed on the server. Please ensure images are converted to data URLs before sending to the API.');
      } else if (imageUrl.startsWith('data:')) {
        console.log('Processing data URL for fallback editing...');
        const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Invalid data URL format');
        }
        const base64Data = base64Match[1];
        fallbackImageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        console.log('Re-downloading image for fallback...');
        const imageResponse = await fetch(imageUrl);
        fallbackImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      }
      const imageFile = await toFile(fallbackImageBuffer, 'image.png', { type: 'image/png' });

      const fallbackParams: any = {
        model: 'dall-e-2',
        image: imageFile,
        prompt: prompt,
        size: size === '1536x1024' || size === '1024x1536' ? '1024x1024' : size as any,
        n: 1,
      };

      if (mask) {
        const maskResponse = await fetch(mask);
        if (maskResponse.ok) {
          const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());
          const maskFile = await toFile(maskBuffer, 'mask.png', { type: 'image/png' });
          fallbackParams.mask = maskFile;
        }
      }

      const fallbackResponse = await openai.images.edit(fallbackParams);

      // Handle both URL and base64 responses for fallback
      let fallbackImageUrl = fallbackResponse.data[0]?.url;
      if (!fallbackImageUrl && fallbackResponse.data[0]?.b64_json) {
        fallbackImageUrl = `data:image/png;base64,${fallbackResponse.data[0].b64_json}`;
      }

      return {
        success: true,
        imageUrl: fallbackImageUrl || '',
        originalImageUrl: imageUrl,
        prompt,
        revisedPrompt: fallbackResponse.data[0]?.revised_prompt,
        model: 'dall-e-2 (fallback)',
        method: 'image-to-image',
      };
    }

    throw error;
  }
}

/**
 * Create variations of an image using GPT-Image-1
 */
export async function createImageVariationGPT1(
  imageUrl: string,
  options: {
    n?: number;
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    style?: 'vivid' | 'natural';
  } = {}
) {
  const {
    n = 1,
    size = '1024x1024',
    style = 'natural',
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {
    console.log('Creating image variation with GPT-Image-1...');

    let imageBuffer: Buffer;

    // Handle different URL types
    if (imageUrl.startsWith('blob:')) {
      // Blob URLs cannot be accessed on the server side
      throw new Error('Blob URLs cannot be processed on the server. Please ensure images are converted to data URLs before sending to the API.');
    } else if (imageUrl.startsWith('data:')) {
      console.log('Processing data URL for variation...');
      // Extract base64 data from data URL
      const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid data URL format');
      }
      const base64Data = base64Match[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Download the image from HTTP URL
      console.log('Downloading image from URL...');
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(imageArrayBuffer);
    }

    // Convert buffer to File using OpenAI's toFile helper
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    // Use OpenAI SDK to create variations
    const response = await openai.images.createVariation({
      model: 'gpt-image-1' as any,
      image: imageFile,
      n: n,
      size: size as any,
    });

    return {
      success: true,
      imageUrl: response.data[0]?.url || '',
      model: 'gpt-image-1',
      method: 'variation',
    };
  } catch (error: any) {
    console.error('GPT-Image-1 variation error:', error);

    // If gpt-image-1 is not available, fall back to dall-e-2
    if (error.message?.includes('invalid_model') || error.message?.includes('model_not_found')) {
      console.log('GPT-Image-1 not available, falling back to dall-e-2...');

      // Re-process the image for the fallback
      let fallbackImageBuffer: Buffer;
      if (imageUrl.startsWith('blob:')) {
        throw new Error('Blob URLs cannot be processed on the server. Please ensure images are converted to data URLs before sending to the API.');
      } else if (imageUrl.startsWith('data:')) {
        console.log('Processing data URL for fallback variation...');
        const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error('Invalid data URL format');
        }
        const base64Data = base64Match[1];
        fallbackImageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        console.log('Re-downloading image for fallback...');
        const imageResponse = await fetch(imageUrl);
        fallbackImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      }
      const imageFile = await toFile(fallbackImageBuffer, 'image.png', { type: 'image/png' });

      const fallbackResponse = await openai.images.createVariation({
        model: 'dall-e-2' as any,
        image: imageFile,
        n: n,
        size: size === '1536x1024' || size === '1024x1536' ? '1024x1024' : size as any,
      });

      return {
        success: true,
        imageUrl: fallbackResponse.data[0]?.url || '',
        model: 'dall-e-2 (fallback)',
        method: 'variation',
      };
    }

    throw error;
  }
}

/**
 * Smart edit function that uses GPT-Image-1's advanced capabilities
 * Note: GPT-Image-1 edit operations do NOT accept quality parameter
 */
export async function smartEditWithGPTImage1(
  imageUrl: string,
  editPrompt: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    quality?: 'low' | 'medium' | 'high'; // Accepted but not used in edit operation
    style?: 'vivid' | 'natural'; // Accepted but not used in edit operation
    mask?: string;
  } = {}
) {
  const {
    size = '1024x1024',
    quality = 'medium', // Keep for compatibility but won't be used
    style = 'natural', // Keep for compatibility but won't be used
    mask,
  } = options;

  console.log('Using smart image editing approach with GPT-Image-1...');
  console.log('Note: Quality and style parameters are not supported for edit operations');

  try {
    // Use the image-to-image edit capability with GPT-Image-1
    // Note: editImageWithGPTImage1 does NOT accept quality or style parameters
    const result = await editImageWithGPTImage1(imageUrl, editPrompt, {
      size,
      mask,
    });

    return result;
  } catch (error: any) {
    // The error is already handled in editImageWithGPTImage1 with fallback
    // Just pass through any remaining errors
    throw error;
  }
}

/**
 * Generate a new image based on an existing image context
 * This is used for "editing" uploaded images where we can't access the original URL
 */
export async function generateImageWithContext(
  prompt: string,
  imageContext: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536';
    quality?: 'low' | 'medium' | 'high';
    output_format?: 'png' | 'jpeg' | 'webp';
    model?: string;
  } = {}
) {
  const {
    size = '1024x1024',
    quality = 'medium',
    output_format = 'png',
    model = 'gpt-image-1',
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured.');
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log('Generating image with context using GPT-4V...');
    
    // First, analyze the image with GPT-4V to understand its content
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and describe its key visual elements, style, composition, colors, and any text or objects present. Be very detailed as this will be used to generate a similar image with modifications.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageContext.startsWith('data:') ? imageContext : `data:image/jpeg;base64,${imageContext}`
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const imageAnalysis = analysisResponse.choices[0]?.message?.content || '';
    console.log('Image analysis:', imageAnalysis.substring(0, 200) + '...');

    // Create an enhanced prompt that combines the analysis with the user's modifications
    const enhancedPrompt = `${imageAnalysis}\n\nNow create a new image with these modifications: ${prompt}`;

    // Generate the new image
    return await generateImageWithGPTImage1(enhancedPrompt, {
      size,
      quality,
      output_format,
    });
  } catch (error: any) {
    console.error('Failed to generate image with context:', error);
    // Fallback to regular generation
    return await generateImageWithGPTImage1(prompt, {
      size,
      quality,
      output_format,
    });
  }
}

/**
 * Check GPT-Image-1 availability
 * Note: Requires organization verification (government ID + facial verification)
 */
export async function checkGPTImage1Available() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return false;
  }

  try {
    // Check if we can access GPT-Image-1
    // In practice, you might want to make a test API call
    // For now, we assume availability if API key exists
    return true;
  } catch (error) {
    console.error('Failed to check GPT-Image-1 availability:', error);
    return false;
  }
}
