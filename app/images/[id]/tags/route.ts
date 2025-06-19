import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_API_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params
    const { tags } = await request.json()

    console.log('[Image Tags API] Adding tags to image:', { imageId, tags })

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags array is required' },
        { status: 400 }
      )
    }

    // Validate tags
    const validTags = tags
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase())
      .slice(0, 20) // Limit to 20 tags

    if (validTags.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid tag is required' },
        { status: 400 }
      )
    }

    // Get current image
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('metadata')
      .eq('id', imageId)
      .single()

    if (fetchError) {
      console.error('[Image Tags API] Error fetching image:', fetchError)
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Update metadata with tags
    const currentMetadata = image.metadata || {}
    const existingTags = currentMetadata.tags || []
    const newTags = [...new Set([...existingTags, ...validTags])] // Remove duplicates

    const updatedMetadata = {
      ...currentMetadata,
      tags: newTags,
      lastTagUpdate: new Date().toISOString()
    }

    // Update image with new metadata
    const { error: updateError } = await supabase
      .from('images')
      .update({ metadata: updatedMetadata })
      .eq('id', imageId)

    if (updateError) {
      console.error('[Image Tags API] Error updating image:', updateError)
      return NextResponse.json(
        { error: 'Failed to update image tags' },
        { status: 500 }
      )
    }

    console.log('[Image Tags API] Tags added successfully:', newTags)

    return NextResponse.json({
      success: true,
      tags: newTags,
      addedTags: validTags
    })

  } catch (error) {
    console.error('[Image Tags API] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params

    console.log('[Image Tags API] Getting tags for image:', imageId)

    // Get image metadata
    const { data: image, error } = await supabase
      .from('images')
      .select('metadata')
      .eq('id', imageId)
      .single()

    if (error) {
      console.error('[Image Tags API] Error fetching image:', error)
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    const tags = image.metadata?.tags || []

    return NextResponse.json({
      success: true,
      tags,
      imageId
    })

  } catch (error) {
    console.error('[Image Tags API] Error getting tags:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params
    const { searchParams } = new URL(request.url)
    const tagToRemove = searchParams.get('tag')

    console.log('[Image Tags API] Removing tag from image:', { imageId, tagToRemove })

    if (!tagToRemove) {
      return NextResponse.json(
        { error: 'Tag parameter is required' },
        { status: 400 }
      )
    }

    // Get current image
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('metadata')
      .eq('id', imageId)
      .single()

    if (fetchError) {
      console.error('[Image Tags API] Error fetching image:', fetchError)
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Remove tag from metadata
    const currentMetadata = image.metadata || {}
    const existingTags = currentMetadata.tags || []
    const updatedTags = existingTags.filter((tag: string) => tag !== tagToRemove.toLowerCase())

    const updatedMetadata = {
      ...currentMetadata,
      tags: updatedTags,
      lastTagUpdate: new Date().toISOString()
    }

    // Update image with new metadata
    const { error: updateError } = await supabase
      .from('images')
      .update({ metadata: updatedMetadata })
      .eq('id', imageId)

    if (updateError) {
      console.error('[Image Tags API] Error updating image:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove tag' },
        { status: 500 }
      )
    }

    console.log('[Image Tags API] Tag removed successfully')

    return NextResponse.json({
      success: true,
      tags: updatedTags,
      removedTag: tagToRemove
    })

  } catch (error) {
    console.error('[Image Tags API] Error removing tag:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
