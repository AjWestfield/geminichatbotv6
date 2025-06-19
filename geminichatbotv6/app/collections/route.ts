import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_API_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('[Collections API] Creating new collection (using images metadata)')

    const { name, imageIds, description } = await request.json()

    if (!name || !imageIds || !Array.isArray(imageIds)) {
      console.log('[Collections API] Invalid request data')
      return NextResponse.json(
        { error: 'Name and imageIds array are required' },
        { status: 400 }
      )
    }

    console.log('[Collections API] Creating collection:', {
      name,
      imageCount: imageIds.length,
      description: description || 'No description'
    })

    // For now, store collection info in localStorage/client-side
    // This is a temporary solution until database tables are set up
    const collectionId = `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const collection = {
      id: collectionId,
      name,
      description: description || null,
      imageCount: imageIds.length,
      imageIds,
      createdAt: new Date().toISOString(),
      metadata: {
        createdBy: 'user',
        tags: [],
        isPublic: false
      }
    }

    console.log('[Collections API] Collection created (client-side):', collection.id)

    return NextResponse.json({
      success: true,
      collection,
      note: 'Collection stored client-side. Database tables need to be created for persistent storage.'
    })

  } catch (error) {
    console.error('[Collections API] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('[Collections API] Fetching collections (client-side storage):', { limit, offset })

    // For now, return empty collections since we're using client-side storage
    // In a real implementation, this would fetch from the database
    const collections: any[] = []

    console.log('[Collections API] Found collections:', collections.length)

    return NextResponse.json({
      success: true,
      collections,
      total: collections.length,
      note: 'Collections are stored client-side. Database tables need to be created for server-side storage.'
    })

  } catch (error) {
    console.error('[Collections API] Error fetching collections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get('id')

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      )
    }

    console.log('[Collections API] Deleting collection:', collectionId)

    // Delete collection images first (foreign key constraint)
    const { error: imagesError } = await supabase
      .from('collection_images')
      .delete()
      .eq('collection_id', collectionId)

    if (imagesError) {
      console.error('[Collections API] Error deleting collection images:', imagesError)
      return NextResponse.json(
        { error: 'Failed to delete collection images' },
        { status: 500 }
      )
    }

    // Delete collection
    const { error: collectionError } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)

    if (collectionError) {
      console.error('[Collections API] Error deleting collection:', collectionError)
      return NextResponse.json(
        { error: 'Failed to delete collection' },
        { status: 500 }
      )
    }

    console.log('[Collections API] Collection deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Collection deleted successfully'
    })

  } catch (error) {
    console.error('[Collections API] Error deleting collection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
