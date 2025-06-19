/**
 * HEIC to JPEG Converter Service
 * 
 * Converts HEIC/HEIF images to JPEG format for browser preview
 * while preserving the original for upload to Gemini
 */

import heicConvert from 'heic-convert';
import sharp from 'sharp';

export class HEICConverter {
  // Cache for converted images to avoid re-conversion
  private static cache = new Map<string, string>();
  
  /**
   * Convert HEIC buffer to JPEG buffer
   */
  static async convertToJPEG(heicBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('[HEICConverter] Starting HEIC to JPEG conversion...');
      
      // Convert HEIC to JPEG using heic-convert
      const outputBuffer = await heicConvert({
        buffer: heicBuffer,
        format: 'JPEG',
        quality: 0.9
      });
      
      console.log('[HEICConverter] Conversion successful');
      return Buffer.from(outputBuffer);
    } catch (error) {
      console.error('[HEICConverter] Conversion failed:', error);
      throw new Error(`Failed to convert HEIC to JPEG: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create a thumbnail from an image buffer
   */
  static async createThumbnail(imageBuffer: Buffer, maxSize: number = 200): Promise<Buffer> {
    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(maxSize, maxSize, {
          fit: 'cover',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: 80,
          mozjpeg: true // Better compression
        })
        .toBuffer();
      
      return thumbnail;
    } catch (error) {
      console.error('[HEICConverter] Thumbnail creation failed:', error);
      throw new Error(`Failed to create thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Convert HEIC to JPEG and return as data URL
   */
  static async convertHEICtoDataURL(heicBuffer: Buffer): Promise<string> {
    try {
      // First convert HEIC to JPEG
      const jpegBuffer = await this.convertToJPEG(heicBuffer);
      
      // Then create a thumbnail
      const thumbnail = await this.createThumbnail(jpegBuffer, 400); // Larger for better quality
      
      // Convert to base64 data URL
      const base64 = thumbnail.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('[HEICConverter] Data URL conversion failed:', error);
      throw error;
    }
  }
  
  /**
   * Convert HEIC to JPEG with caching
   */
  static async convertHEICtoDataURLWithCache(
    heicBuffer: Buffer, 
    cacheKey: string
  ): Promise<string> {
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log('[HEICConverter] Returning cached conversion');
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const dataURL = await this.convertHEICtoDataURL(heicBuffer);
      
      // Cache the result (limit cache size to prevent memory issues)
      if (this.cache.size > 50) {
        // Remove oldest entry
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
      this.cache.set(cacheKey, dataURL);
      
      return dataURL;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }
  
  /**
   * Clear the conversion cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Check if a file is HEIC/HEIF format
   */
  static isHEICFile(file: { type: string; name: string }): boolean {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    return type === 'image/heic' || 
           type === 'image/heif' || 
           name.endsWith('.heic') || 
           name.endsWith('.heif');
  }
}