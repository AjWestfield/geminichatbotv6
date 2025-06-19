import { NextRequest, NextResponse } from 'next/server'
import { getChat, updateChatTitle, deleteChat, updateCanvasState } from '@/lib/services/chat-persistence'
import { isPersistenceConfigured } from '@/lib/database/supabase'
import { getLocalStorageChats, getLocalStorageMessages, updateLocalStorageChatTitle, deleteLocalStorageChat } from '@/lib/localStorage-persistence'

// GET /api/chats/[chatId] - Get a specific chat with messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    let chatData = await getChat(chatId)

    if (!chatData && !isPersistenceConfigured()) {
      // Try localStorage fallback
      const chats = getLocalStorageChats()
      const chat = chats.find(c => c.id === chatId)
      
      if (chat) {
        const messages = getLocalStorageMessages(chatId)
        // For localStorage, we don't have images/videos/canvas state stored separately
        chatData = {
          chat,
          messages,
          images: [],
          videos: [],
          canvasState: null
        }
      }
    }

    if (!chatData) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(chatData)
  } catch (error) {
    console.error('Error in GET /api/chats/[chatId]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    )
  }
}

// PATCH /api/chats/[chatId] - Update chat (e.g., title, canvas state)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const body = await req.json()
    const { title, canvasState } = body

    let success = true

    // Update title if provided
    if (title !== undefined) {
      const titleSuccess = await updateChatTitle(chatId, title)
      
      // Use localStorage fallback if persistence not configured
      if (!titleSuccess && !isPersistenceConfigured()) {
        updateLocalStorageChatTitle(chatId, title)
      } else if (!titleSuccess) {
        success = false
      }
    }

    // Update canvas state if provided
    if (canvasState !== undefined && isPersistenceConfigured()) {
      const canvasSuccess = await updateCanvasState(chatId, canvasState)
      if (!canvasSuccess) {
        success = false
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update chat' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/chats/[chatId]:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    )
  }
}

// DELETE /api/chats/[chatId] - Delete a chat
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    let success = await deleteChat(chatId)
    
    // Use localStorage fallback if persistence not configured
    if (!success && !isPersistenceConfigured()) {
      deleteLocalStorageChat(chatId)
      success = true
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete chat' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/chats/[chatId]:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    )
  }
}