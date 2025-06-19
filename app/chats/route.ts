import { NextRequest, NextResponse } from 'next/server'
import { getChats, createChat, searchChats } from '@/lib/services/chat-persistence'
import { isPersistenceConfigured } from '@/lib/database/supabase'
import { getLocalStorageChats, createLocalStorageChat } from '@/lib/localStorage-persistence'

// GET /api/chats - Get all chats or search
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const useLocalStorage = searchParams.get('localStorage') === 'true'

    let chats
    
    // Try database first
    if (isPersistenceConfigured() && !useLocalStorage) {
      if (search) {
        chats = await searchChats(search)
      } else {
        chats = await getChats(limit)
      }
    }
    
    // Use localStorage as fallback or when explicitly requested
    if (!chats || chats.length === 0 || !isPersistenceConfigured() || useLocalStorage) {
      chats = getLocalStorageChats()
      
      // Filter by search if provided
      if (search) {
        const searchLower = search.toLowerCase()
        chats = chats.filter(chat => 
          chat.title.toLowerCase().includes(searchLower) ||
          (chat.last_message && chat.last_message.toLowerCase().includes(searchLower))
        )
      }
      
      // Apply limit
      chats = chats.slice(0, limit)
    }

    return NextResponse.json({ chats })
  } catch (error) {
    console.error('Error in GET /api/chats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}

// POST /api/chats - Create a new chat
export async function POST(req: NextRequest) {
  try {
    const { title, model } = await req.json()
    
    console.log('[API /api/chats POST] Creating chat with title:', title, 'model:', model)

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    let chat = await createChat(
      title,
      model || 'gemini-2.0-flash'
    )

    if (!chat) {
      // Use localStorage when persistence is not configured
      chat = createLocalStorageChat(title, model || 'gemini-2.0-flash')
      console.log('[API] Created localStorage chat:', chat.id, chat.title)
    }

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Error in POST /api/chats:', error)
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    )
  }
}