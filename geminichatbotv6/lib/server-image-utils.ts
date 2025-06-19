/**
 * Server-side image utilities for Google AI File Manager operations
 * This file should only be imported by API routes and server-side code
 */

import { GoogleAIFileManager } from "@google/generative-ai/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini for server-side operations
const fileManager = process.env.GEMINI_API_KEY ? new GoogleAIFileManager(process.env.GEMINI_API_KEY) : null
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null

/**
 * Detects the aspect ratio of an image from a Google AI File Manager URI (server-side)
 * @param fileUri The Google AI File Manager URI
 * @returns Promise<VideoAspectRatio> The closest matching video aspect ratio
 */
export async function detectImageAspectRatioFromGeminiUri(fileUri: string): Promise<"16:9" | "9:16" | "1:1"> {
  if (!fileManager || !genAI) {
    console.warn('[SERVER ASPECT DETECTION] Gemini API not configured, using default 16:9');
    return "16:9";
  }

  try {
    // Extract file name from URI
    const fileName = fileUri.split('/').pop();
    if (!fileName) {
      console.warn('[SERVER ASPECT DETECTION] Invalid file URI format');
      return "16:9";
    }

    console.log(`[SERVER ASPECT DETECTION] Analyzing file: ${fileName}`);

    // Get file info from Google AI File Manager
    const fileInfo = await fileManager.getFile(fileName);

    if (fileInfo.state !== 'ACTIVE') {
      console.warn('[SERVER ASPECT DETECTION] File not active, using default aspect ratio');
      return "16:9";
    }

    console.log(`[SERVER ASPECT DETECTION] File info:`, {
      name: fileInfo.displayName,
      mimeType: fileInfo.mimeType,
      state: fileInfo.state,
      sizeBytes: fileInfo.sizeBytes
    });

    // Use Gemini Vision to analyze the image and extract dimensions
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this image and provide ONLY the dimensions in this exact format: WIDTH x HEIGHT

    For example:
    - If it's 1920x1080, respond: "1920 x 1080"
    - If it's 800x1200, respond: "800 x 1200"
    - If it's 500x500, respond: "500 x 500"

    Just the numbers and the 'x' separator, nothing else.`;

    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          mimeType: fileInfo.mimeType,
          fileUri: fileInfo.uri
        }
      }
    ]);

    const response = await result.response;
    const text = response.text().trim();

    console.log(`[SERVER ASPECT DETECTION] Gemini response: "${text}"`);

    // Parse dimensions from response
    const dimensionMatch = text.match(/(\d+)\s*x\s*(\d+)/i);
    if (!dimensionMatch) {
      console.warn('[SERVER ASPECT DETECTION] Could not parse dimensions from Gemini response, using default');
      return "16:9";
    }

    const width = parseInt(dimensionMatch[1]);
    const height = parseInt(dimensionMatch[2]);
    const ratio = width / height;

    console.log(`[SERVER ASPECT DETECTION] Parsed dimensions: ${width}x${height}, ratio: ${ratio}`);

    // Apply the same thresholds as client-side detection
    const LANDSCAPE_THRESHOLD = 1.5  // 16:9 ≈ 1.78
    const SQUARE_THRESHOLD_LOW = 0.8
    const SQUARE_THRESHOLD_HIGH = 1.2
    const PORTRAIT_THRESHOLD = 0.7   // 9:16 ≈ 0.56

    let detectedRatio: "16:9" | "9:16" | "1:1"

    if (ratio >= LANDSCAPE_THRESHOLD) {
      detectedRatio = "16:9"
    } else if (ratio >= SQUARE_THRESHOLD_LOW && ratio <= SQUARE_THRESHOLD_HIGH) {
      detectedRatio = "1:1"
    } else if (ratio <= PORTRAIT_THRESHOLD) {
      detectedRatio = "9:16"
    } else {
      detectedRatio = ratio > 1 ? "16:9" : "9:16"
    }

    console.log(`[SERVER ASPECT DETECTION] ✅ Auto-detected aspect ratio: ${detectedRatio} for ${width}x${height} image`);
    return detectedRatio;

  } catch (error) {
    console.error('[SERVER ASPECT DETECTION] Error analyzing image:', error);
    return "16:9"; // Fallback to default
  }
}

/**
 * Gets a human-readable description for server-side aspect ratio detection
 */
export async function getServerAspectRatioDetectionReason(
  fileUri: string,
  detectedRatio: "16:9" | "9:16" | "1:1"
): Promise<string> {
  try {
    const fileName = fileUri.split('/').pop() || 'image';
    return `Server auto-detected → ${detectedRatio} from uploaded image (${fileName})`;
  } catch (error) {
    return `Auto-detected → ${detectedRatio} (server fallback)`;
  }
}
