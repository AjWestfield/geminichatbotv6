import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''


// Validate Supabase URL format
const isValidSupabaseUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && url.includes('.supabase.co')
  } catch {
    return false
  }
}

// Create a single supabase client for interacting with your database
// Returns null if not configured or invalid to allow graceful degradation
export const supabase: SupabaseClient | null = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Supabase not configured - missing credentials')
    return null
  }

  if (!isValidSupabaseUrl(supabaseUrl)) {
    console.warn('Invalid Supabase URL format:', supabaseUrl)
    return null
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    return null
  }
})()

// Helper to check if persistence is properly configured and working
export const isPersistenceConfigured = () => {
  return supabase !== null
}

// Database types
export interface Chat {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  user_id?: string
  metadata?: Record<string, any>
}

export interface Message {
  id: string
  chat_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  attachments?: any[]
  metadata?: Record<string, any>
}

export interface StoredImage {
  id: string
  chat_id?: string
  message_id?: string
  url: string
  prompt: string
  revised_prompt?: string
  quality: string
  style?: string
  size: string
  model: string
  is_uploaded: boolean
  original_image_id?: string
  created_at: string
  metadata?: Record<string, any>
}

export interface StoredVideo {
  id: string
  chat_id?: string
  message_id?: string
  url: string
  thumbnail_url?: string
  prompt: string
  duration: number
  aspect_ratio: string
  model: string
  source_image_url?: string
  status: string
  final_elapsed_time?: number
  error_message?: string
  created_at: string
  completed_at?: string
  metadata?: Record<string, any>
}

export interface ChatSummary {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  user_id?: string
  message_count: number
  image_count: number
  last_message_at?: string
}
