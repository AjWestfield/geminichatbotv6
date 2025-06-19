// LocalStorage fallback for chat persistence when Supabase is not configured
import { Chat, ChatSummary, Message } from '@/lib/database/supabase'

const CHATS_KEY = 'gemini-chat-chats'
const MESSAGES_KEY_PREFIX = 'gemini-chat-messages-'
const STORAGE_VERSION = '1.0'

interface LocalStorageData {
  version: string
  chats: ChatSummary[]
}

interface LocalStorageMessages {
  version: string
  messages: Message[]
}

// Get all chats from localStorage
export function getLocalStorageChats(): ChatSummary[] {
  if (typeof window === 'undefined') return []
  
  try {
    const data = localStorage.getItem(CHATS_KEY)
    if (!data) return []
    
    const parsed: LocalStorageData = JSON.parse(data)
    if (parsed.version !== STORAGE_VERSION) {
      // Handle version mismatch if needed
      return []
    }
    
    return parsed.chats.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  } catch (error) {
    console.error('Error reading chats from localStorage:', error)
    return []
  }
}

// Save a chat to localStorage
export function saveLocalStorageChat(chat: Chat | ChatSummary): void {
  if (typeof window === 'undefined') return
  
  try {
    const chats = getLocalStorageChats()
    const existingIndex = chats.findIndex(c => c.id === chat.id)
    
    const chatSummary: ChatSummary = {
      id: chat.id,
      title: chat.title,
      created_at: chat.created_at,
      updated_at: new Date().toISOString(),
      last_message: null,
      message_count: 0,
      model: 'model' in chat ? chat.model : 'gemini-2.0-flash'
    }
    
    if (existingIndex >= 0) {
      chats[existingIndex] = { ...chats[existingIndex], ...chatSummary }
    } else {
      chats.push(chatSummary)
    }
    
    const data: LocalStorageData = {
      version: STORAGE_VERSION,
      chats
    }
    
    localStorage.setItem(CHATS_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving chat to localStorage:', error)
  }
}

// Create a new chat in localStorage
export function createLocalStorageChat(title: string, model: string): Chat {
  console.log('[LocalStorage] Creating chat with title:', title, 'model:', model)
  
  const chat: Chat = {
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    model,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  console.log('[LocalStorage] Created chat object:', chat)
  saveLocalStorageChat(chat)
  console.log('[LocalStorage] Chat saved to localStorage')
  
  return chat
}

// Update chat title
export function updateLocalStorageChatTitle(chatId: string, title: string): void {
  if (typeof window === 'undefined') return
  
  const chats = getLocalStorageChats()
  const chatIndex = chats.findIndex(c => c.id === chatId)
  
  if (chatIndex >= 0) {
    chats[chatIndex].title = title
    chats[chatIndex].updated_at = new Date().toISOString()
    
    const data: LocalStorageData = {
      version: STORAGE_VERSION,
      chats
    }
    
    localStorage.setItem(CHATS_KEY, JSON.stringify(data))
  }
}

// Delete a chat from localStorage
export function deleteLocalStorageChat(chatId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    // Remove chat from list
    const chats = getLocalStorageChats()
    const filteredChats = chats.filter(c => c.id !== chatId)
    
    const data: LocalStorageData = {
      version: STORAGE_VERSION,
      chats: filteredChats
    }
    
    localStorage.setItem(CHATS_KEY, JSON.stringify(data))
    
    // Remove associated messages
    localStorage.removeItem(MESSAGES_KEY_PREFIX + chatId)
  } catch (error) {
    console.error('Error deleting chat from localStorage:', error)
  }
}

// Get messages for a chat
export function getLocalStorageMessages(chatId: string): Message[] {
  if (typeof window === 'undefined') return []
  
  try {
    const data = localStorage.getItem(MESSAGES_KEY_PREFIX + chatId)
    if (!data) return []
    
    const parsed: LocalStorageMessages = JSON.parse(data)
    if (parsed.version !== STORAGE_VERSION) {
      return []
    }
    
    return parsed.messages
  } catch (error) {
    console.error('Error reading messages from localStorage:', error)
    return []
  }
}

// Save messages for a chat
export function saveLocalStorageMessages(chatId: string, messages: any[]): void {
  if (typeof window === 'undefined') return
  
  try {
    // Convert AI SDK messages to our Message format
    const dbMessages: Message[] = messages
      .filter(m => m.id !== 'welcome-message')
      .map((m, index) => ({
        id: m.id || `msg-${Date.now()}-${index}`,
        chat_id: chatId,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        created_at: new Date().toISOString()
      }))
    
    const data: LocalStorageMessages = {
      version: STORAGE_VERSION,
      messages: dbMessages
    }
    
    localStorage.setItem(MESSAGES_KEY_PREFIX + chatId, JSON.stringify(data))
    
    // Update chat summary
    const chats = getLocalStorageChats()
    const chatIndex = chats.findIndex(c => c.id === chatId)
    
    if (chatIndex >= 0) {
      const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .pop()
      
      chats[chatIndex].message_count = dbMessages.length
      chats[chatIndex].last_message = lastUserMessage?.content || null
      chats[chatIndex].updated_at = new Date().toISOString()
      
      const chatData: LocalStorageData = {
        version: STORAGE_VERSION,
        chats
      }
      
      localStorage.setItem(CHATS_KEY, JSON.stringify(chatData))
    }
  } catch (error) {
    console.error('Error saving messages to localStorage:', error)
  }
}

// Clear all chat data from localStorage
export function clearLocalStorageChats(): void {
  if (typeof window === 'undefined') return
  
  try {
    // Get all keys
    const keys = Object.keys(localStorage)
    
    // Remove chat-related keys
    keys.forEach(key => {
      if (key === CHATS_KEY || key.startsWith(MESSAGES_KEY_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Error clearing localStorage chats:', error)
  }
}