/**
 * Server-side utility to proxy and cache images for editing
 * This helps handle expired Replicate URLs by re-serving them through our server
 */

import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy an image URL through our server
 * This can help with CORS issues and expired URLs
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing image URL parameter' },
        { status: 400 }
      )
    }

    console.log('[image-proxy] Proxying image:', imageUrl)

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    })

    if (!response.ok) {
      console.error('[image-proxy] Failed to fetch image:', response.status, response.statusText)
      return NextResponse.json(
        { 
          error: 'Failed to fetch image', 
          details: `${response.status} ${response.statusText}` 
        },
        { status: response.status }
      )
    }

    // Get the image blob
    const imageBlob = await response.blob()
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    console.log('[image-proxy] Successfully proxied image, size:', imageBlob.size, 'bytes')

    // Return the image with appropriate headers
    return new NextResponse(imageBlob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBlob.size.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[image-proxy] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to proxy image', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Convert an image URL to a data URL by fetching it server-side
 */
export async function convertImageUrlToDataUrl(imageUrl: string): Promise<string> {
  try {
    console.log('[convertImageUrlToDataUrl] Converting:', imageUrl)
    
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }
    
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    // Convert to base64
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`
    
    console.log('[convertImageUrlToDataUrl] Converted to data URL, size:', Math.round(dataUrl.length / 1024), 'KB')
    
    return dataUrl
  } catch (error) {
    console.error('[convertImageUrlToDataUrl] Error:', error)
    throw error
  }
}