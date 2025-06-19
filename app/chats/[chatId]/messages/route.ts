import { NextRequest, NextResponse } from 'next/server'
import { addMessage } from '@/lib/services/chat-persistence'
import { isPersistenceConfigured } from '@/lib/database/supabase'
import { saveLocalStorageMessages, getLocalStorageMessages } from '@/lib/localStorage-persistence'

// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  let chatId: string
  let role: string
  let content: string
  let attachments: any

  try {
    const paramsData = await params
    chatId = paramsData.chatId
    const requestData = await req.json()
    role = requestData.role
    content = requestData.content
    attachments = requestData.attachments

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      )
    }

    let message = await addMessage(chatId, role, content, attachments)

    if (!message) {
      // Use localStorage when persistence is not configured
      const mockMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        chat_id: chatId,
        role,
        content,
        created_at: new Date().toISOString(),
        attachments: attachments || []
      }

      // Save to localStorage
      if (!isPersistenceConfigured()) {
        const existingMessages = getLocalStorageMessages(chatId)
        const allMessages = [...existingMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content
        })), mockMessage]
        saveLocalStorageMessages(chatId, allMessages)
      }

      message = mockMessage
    }

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Error in POST /api/chats/[chatId]/messages:', error)
    // Return mock message on error to allow video generation to continue
    const mockMessage = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      role,
      content,
      created_at: new Date().toISOString(),
      attachments: attachments || []
    }
    return NextResponse.json({ message: mockMessage })
  }
}
