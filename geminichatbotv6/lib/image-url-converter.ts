/**
 * Image URL Converter
 *
 * Converts Google AI File Manager URIs to publicly accessible URLs
 * for use with external services like Replicate
 */

import { GoogleAIFileManager } from "@google/generative-ai/server";

export class ImageUrlConverter {
  private static fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

  /**
   * Converts a Google AI File Manager URI to a publicly accessible URL
   * This downloads the image and re-uploads it to a temporary public storage
   */
  static async convertToPublicUrl(fileUri: string): Promise<string> {
    try {
      // For now, we'll return the original URI and let the video generation API handle it
      // TODO: Implement actual conversion to public URL using Vercel Blob or similar

      // Extract the file name from the URI
      const fileName = fileUri.split('/').pop() || 'image';

      // Get file info from Google AI File Manager
      const fileInfo = await this.fileManager.getFile(fileName);

      if (fileInfo.state !== 'ACTIVE') {
        throw new Error('File is not ready for download');
      }

      // For immediate implementation, we'll use a proxy approach
      // Return a URL that points to our own API endpoint that can serve the image
      const proxyUrl = `/api/image-proxy?fileUri=${encodeURIComponent(fileUri)}`;

      return proxyUrl;
    } catch (error) {
      console.error('Error converting image URL:', error);
      throw new Error('Failed to convert image URL to public format');
    }
  }

  /**
   * Checks if a URI is a Google AI File Manager URI
   */
  static isGoogleAIFileUri(uri: string): boolean {
    return uri.startsWith('https://generativelanguage.googleapis.com/') ||
           uri.includes('files/') ||
           uri.startsWith('gs://generativeai-uploads/');
  }

  /**
   * Downloads an image from Google AI File Manager
   * Returns the image as a Buffer
   */
  static async downloadImage(fileUri: string): Promise<Buffer> {
    try {
      // Extract file name from URI
      const fileName = fileUri.split('/').pop() || 'image';

      // Get file info
      const fileInfo = await this.fileManager.getFile(fileName);

      if (fileInfo.state !== 'ACTIVE') {
        throw new Error('File is not available for download');
      }

      // Download the file content
      // Note: Google AI File Manager doesn't provide direct download
      // We'll need to implement this differently or use a different approach
      throw new Error('Direct download not implemented yet');

    } catch (error) {
      console.error('Error downloading image:', error);
      throw new Error('Failed to download image from Google AI File Manager');
    }
  }

  /**
   * Uploads an image buffer to a public storage service
   * Returns the public URL
   */
  static async uploadToPublicStorage(imageBuffer: Buffer, fileName: string): Promise<string> {
    try {
      // TODO: Implement upload to Vercel Blob or similar service
      // For now, we'll use a temporary approach

      // This would typically be:
      // const { url } = await put(fileName, imageBuffer, { access: 'public' });
      // return url;

      throw new Error('Public storage upload not implemented yet');

    } catch (error) {
      console.error('Error uploading to public storage:', error);
      throw new Error('Failed to upload image to public storage');
    }
  }
}
