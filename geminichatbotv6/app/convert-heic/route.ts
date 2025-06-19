import { NextRequest, NextResponse } from 'next/server';
import { HEICConverter } from '@/lib/heic-converter';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' }, 
        { status: 400 }
      );
    }
    
    // Check if it's a HEIC file
    if (!HEICConverter.isHEICFile(file)) {
      return NextResponse.json(
        { error: 'Not a HEIC/HEIF file' }, 
        { status: 400 }
      );
    }
    
    // Check file size (limit to 50MB for conversion)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' }, 
        { status: 413 }
      );
    }
    
    console.log(`[HEIC Conversion] Processing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    
    try {
      // Convert File to Buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create a cache key based on file name and size
      const cacheKey = `${file.name}-${file.size}`;
      
      // Convert HEIC to JPEG data URL with caching
      const startTime = Date.now();
      const dataURL = await HEICConverter.convertHEICtoDataURLWithCache(buffer, cacheKey);
      const conversionTime = Date.now() - startTime;
      
      console.log(`[HEIC Conversion] Completed in ${conversionTime}ms`);
      
      // Calculate the size of the converted preview
      const base64Length = dataURL.length - 'data:image/jpeg;base64,'.length;
      const previewSizeKB = (base64Length * 0.75 / 1024).toFixed(2);
      
      return NextResponse.json({ 
        success: true, 
        preview: dataURL,
        originalName: file.name,
        originalSize: file.size,
        previewSize: `${previewSizeKB}KB`,
        conversionTime: `${conversionTime}ms`
      });
    } catch (conversionError) {
      console.error('[HEIC Conversion] Failed:', conversionError);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to convert HEIC file';
      let errorDetails = 'Unknown error';
      
      if (conversionError instanceof Error) {
        errorDetails = conversionError.message;
        
        if (errorDetails.includes('Invalid')) {
          errorMessage = 'Invalid or corrupted HEIC file';
        } else if (errorDetails.includes('memory')) {
          errorMessage = 'File too large to process';
        } else if (errorDetails.includes('format')) {
          errorMessage = 'Unsupported HEIC format variant';
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: errorDetails,
          suggestion: 'The file will be uploaded without preview'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[HEIC Conversion] Request error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}