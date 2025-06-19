import { NextRequest, NextResponse } from 'next/server'
import { getAllVideos, saveVideo, deleteVideo } from '@/lib/services/chat-persistence'
import { GeneratedVideo } from '@/lib/video-generation-types'

// GET /api/videos - Get all videos
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    const videos = await getAllVideos(limit)

    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Error in GET /api/videos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}

// POST /api/videos - Save a video
export async function POST(req: NextRequest) {
  try {
    const { video, chatId, messageId } = await req.json()

    if (!video || !video.url || !video.prompt) {
      return NextResponse.json(
        { error: 'Video data is required' },
        { status: 400 }
      )
    }

    const savedVideo = await saveVideo(video as GeneratedVideo, chatId, messageId)

    // Return success even if persistence failed (it's optional)
    if (!savedVideo) {
      // Return the original video data as if it was saved
      return NextResponse.json({ 
        video: {
          ...video,
          id: `local-${Date.now()}`,
          created_at: new Date().toISOString()
        } 
      })
    }

    return NextResponse.json({ video: savedVideo })
  } catch (error) {
    console.error('Error in POST /api/videos:', error)
    return NextResponse.json(
      { error: 'Failed to save video' },
      { status: 500 }
    )
  }
}

// DELETE /api/videos - Delete a video
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const videoId = searchParams.get('id')

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteVideo(videoId)

    if (!deleted) {
      // Return success even if database deletion failed
      // The video will still be removed from localStorage
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/videos:', error)
    return NextResponse.json(
      { error: 'Failed to delete video' },
      { status: 500 }
    )
  }
}