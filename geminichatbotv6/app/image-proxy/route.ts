import { NextRequest, NextResponse } from "next/server";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the File Manager and Gemini client
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUri = searchParams.get('fileUri');

    if (!fileUri) {
      return NextResponse.json(
        { error: "File URI is required" },
        { status: 400 }
      );
    }

    // Extract file name from URI
    const fileName = fileUri.split('/').pop();
    if (!fileName) {
      return NextResponse.json(
        { error: "Invalid file URI" },
        { status: 400 }
      );
    }

    console.log(`[IMAGE PROXY] Fetching image: ${fileName}`);

    // Get file info from Google AI File Manager
    const fileInfo = await fileManager.getFile(fileName);

    if (fileInfo.state !== 'ACTIVE') {
      return NextResponse.json(
        { error: "File is not available" },
        { status: 404 }
      );
    }

    console.log(`[IMAGE PROXY] File info:`, {
      name: fileInfo.name,
      mimeType: fileInfo.mimeType,
      state: fileInfo.state,
      uri: fileInfo.uri
    });

    // Use Gemini to get the actual image content
    // We'll use the model to extract the image as base64
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
      // Fetch the actual image data using the Gemini API
      // This is a workaround since Google AI File Manager doesn't provide direct download
      const response = await fetch(fileInfo.uri, {
        headers: {
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        }
      });

      if (!response.ok) {
        console.log(`[IMAGE PROXY] Direct fetch failed, trying alternative approach...`);
        
        // Alternative: Create a simple response that redirects to the original URI
        // This won't work for OpenAI but might help debug
        return new Response(null, {
          status: 302,
          headers: {
            'Location': fileInfo.uri,
            'Cache-Control': 'no-cache',
          }
        });
      }

      const imageBuffer = await response.arrayBuffer();
      
      // Return the image directly
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': fileInfo.mimeType || 'image/png',
          'Content-Length': imageBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600',
        }
      });

    } catch (fetchError) {
      console.error("[IMAGE PROXY] Failed to fetch image directly:", fetchError);
      
      // Fallback: Return an error message
      return NextResponse.json(
        { 
          error: "Cannot proxy Gemini files directly", 
          details: "Gemini file URIs require authentication and cannot be accessed by external services",
          suggestion: "Consider using a different image source or implementing base64 conversion"
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("[IMAGE PROXY] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
