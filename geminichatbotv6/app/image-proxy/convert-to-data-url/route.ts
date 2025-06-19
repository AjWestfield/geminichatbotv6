import { NextRequest, NextResponse } from "next/server"

/**
 * Server-side image URL to data URL conversion
 * This helps handle expired Replicate URLs by downloading them server-side
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      )
    }

    console.log('[convert-to-data-url] Converting image:', imageUrl)

    // Fetch the image server-side
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
      },
    })

    if (!response.ok) {
      console.error('[convert-to-data-url] Failed to fetch image:', response.status, response.statusText)
      return NextResponse.json(
        { 
          error: 'Failed to fetch image', 
          details: `${response.status} ${response.statusText}` 
        },
        { status: response.status }
      )
    }

    // Get the image buffer
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    // Convert to base64 data URL
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`
    
    console.log('[convert-to-data-url] Successfully converted to data URL, size:', Math.round(dataUrl.length / 1024), 'KB')

    return NextResponse.json({
      success: true,
      dataUrl,
      originalUrl: imageUrl,
      contentType,
      size: buffer.byteLength
    })
  } catch (error) {
    console.error('[convert-to-data-url] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to convert image to data URL', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}