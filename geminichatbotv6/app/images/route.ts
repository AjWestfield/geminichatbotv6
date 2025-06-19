import { NextRequest, NextResponse } from 'next/server'
import { getAllImages, saveImage } from '@/lib/services/chat-persistence'
import { GeneratedImage } from '@/lib/image-utils'

// GET /api/images - Get all images
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    const images = await getAllImages(limit)

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error in GET /api/images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

// POST /api/images - Save an image
export async function POST(req: NextRequest) {
  try {
    const { image, chatId, messageId } = await req.json()

    if (!image || !image.url || !image.prompt) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    const savedImage = await saveImage(image as GeneratedImage, chatId, messageId)

    // Return success even if persistence failed (it's optional)
    if (!savedImage) {
      // Return the original image data as if it was saved
      return NextResponse.json({ 
        image: {
          ...image,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString()
        } 
      })
    }

    return NextResponse.json({ image: savedImage })
  } catch (error: any) {
    console.error('Error in POST /api/images:', error)
    
    // Check if it's an image validation error
    if (error.message?.includes('Image generation failed:') || 
        error.message?.includes('Invalid image response:') ||
        error.message?.includes('Failed to fetch image:')) {
      return NextResponse.json(
        { 
          error: 'Invalid image generated',
          details: error.message,
          isImageError: true 
        },
        { status: 422 } // Unprocessable Entity
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to save image' },
      { status: 500 }
    )
  }
}