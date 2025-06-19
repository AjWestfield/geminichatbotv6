import { NextRequest, NextResponse } from 'next/server'
import { deleteImage } from '@/lib/services/chat-persistence'

// DELETE /api/images/[imageId] - Delete an image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    console.log('[API] Deleting image:', imageId)

    const success = await deleteImage(imageId)

    if (!success) {
      console.log('[API] Failed to delete image:', imageId)
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      )
    }

    console.log('[API] Successfully deleted image:', imageId)

    return NextResponse.json({ 
      success: true,
      message: 'Image deleted successfully' 
    })
  } catch (error) {
    console.error('Error in DELETE /api/images/[imageId]:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}