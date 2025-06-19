/**
 * Image Editing Handler for Chat Integration
 *
 * This module handles image editing requests from the chat interface
 */

export interface ImageEditingRequest {
  type: 'inpainting' | 'image-to-image';
  prompt: string;
  imageUrl?: string;
  imageUri?: string; // Google AI File Manager URI
  mask?: string; // Optional mask for inpainting
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  size?: '1024x1024' | '1536x1024' | '1024x1536';
}

export class ImageEditingHandler {
  /**
   * Detects if a message contains an image editing request
   */
  static detectEditRequest(
    message: string,
    fileUri?: string,
    fileMimeType?: string
  ): ImageEditingRequest | null {
    const lowerMessage = message.toLowerCase();

    // Check if an image was uploaded
    const hasUploadedImage = fileUri && fileMimeType?.startsWith('image/');

    if (!hasUploadedImage) {
      return null; // Can't edit without an image
    }

    // Image editing patterns
    const editingPatterns = [
      // Direct editing commands
      /edit\s+(?:this|the)\s+image/i,
      /modify\s+(?:this|the)\s+image/i,
      /change\s+(?:this|the)\s+image/i,
      /alter\s+(?:this|the)\s+image/i,
      /update\s+(?:this|the)\s+image/i,

      // Specific editing actions
      /change\s+the\s+(sky|background|color|lighting)/i,
      /add\s+(a|an|some)\s+(.+?)\s+to\s+(?:this|the)\s+image/i,
      /remove\s+the\s+(.+?)\s+from\s+(?:this|the)\s+image/i,
      /replace\s+the\s+(.+?)\s+with\s+(.+)/i,
      /make\s+the\s+(.+?)\s+(bigger|smaller|brighter|darker|different)/i,

      // Style changes
      /make\s+(?:it|this)\s+(more|less)\s+(.+)/i,
      /turn\s+(?:it|this)\s+into\s+(.+)/i,
      /style\s+(?:it|this)\s+like\s+(.+)/i,

      // Color and appearance
      /change\s+the\s+color/i,
      /make\s+(?:it|this)\s+(brighter|darker|warmer|cooler)/i,
      /adjust\s+the\s+(lighting|contrast|saturation)/i,

      // Object manipulation
      /add\s+(.+)/i,
      /remove\s+(.+)/i,
      /delete\s+(.+)/i,

      // General editing requests
      /can\s+you\s+edit/i,
      /please\s+edit/i,
      /edit\s+to/i,
      /modify\s+to/i
    ];

    // Check for quality specifications
    let quality: 'standard' | 'hd' = 'standard';
    if (message.match(/high quality|hd|high definition|best quality/i)) {
      quality = 'hd';
    }

    // Check for style preferences
    let style: 'vivid' | 'natural' = 'natural';
    if (message.match(/vivid|vibrant|saturated|bold/i)) {
      style = 'vivid';
    }

    // Check for size preferences
    let size: '1024x1024' | '1536x1024' | '1024x1536' = '1024x1024';
    if (message.match(/portrait|vertical|tall/i)) {
      size = '1024x1536';
    } else if (message.match(/landscape|horizontal|wide/i)) {
      size = '1536x1024';
    }

    // Check if any editing pattern matches
    for (const pattern of editingPatterns) {
      if (pattern.test(message)) {
        return {
          type: 'image-to-image',
          prompt: message,
          imageUri: fileUri,
          quality,
          style,
          size
        };
      }
    }

    return null;
  }

  /**
   * Generates a response for image editing requests
   */
  static generateResponse(request: ImageEditingRequest): string {
    return `I'm editing your uploaded image using GPT-Image-1! ✨

**Edit Details:**
- Model: GPT-Image-1 (OpenAI's multimodal image generation)
- Quality: ${request.quality === 'hd' ? 'High Definition' : 'Standard'}
- Style: ${request.style === 'vivid' ? 'Vivid and bold' : 'Natural and realistic'}
- Size: ${request.size}

**Edit Instructions:** "${request.prompt}"

**What's happening:**
1. Your uploaded image is being analyzed
2. GPT-Image-1 is applying your requested changes
3. The edited image will appear in the Images tab

The editing process typically takes 10-30 seconds. You'll see the result in the Images tab!`;
  }

  /**
   * Checks if a message contains inpainting-specific requests
   */
  static isInpaintingRequest(message: string): boolean {
    const inpaintingPatterns = [
      /remove\s+(.+)/i,
      /delete\s+(.+)/i,
      /erase\s+(.+)/i,
      /take\s+out\s+(.+)/i,
      /get\s+rid\s+of\s+(.+)/i
    ];

    return inpaintingPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Extracts the object to be removed for inpainting
   */
  static extractRemovalTarget(message: string): string | null {
    const removalPatterns = [
      /remove\s+(?:the\s+)?(.+?)(?:\s+from|$)/i,
      /delete\s+(?:the\s+)?(.+?)(?:\s+from|$)/i,
      /erase\s+(?:the\s+)?(.+?)(?:\s+from|$)/i,
      /take\s+out\s+(?:the\s+)?(.+?)(?:\s+from|$)/i,
      /get\s+rid\s+of\s+(?:the\s+)?(.+?)(?:\s+from|$)/i
    ];

    for (const pattern of removalPatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}
