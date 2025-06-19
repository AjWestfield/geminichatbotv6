-- Supabase Database Schema for Chat Persistence

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-exp',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT, -- For future auth implementation
  metadata JSONB DEFAULT '{}'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attachments JSONB DEFAULT '[]', -- Store file attachments metadata
  metadata JSONB DEFAULT '{}' -- Store additional metadata like tool results
);

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  url TEXT NOT NULL, -- Blob storage URL
  prompt TEXT NOT NULL,
  revised_prompt TEXT,
  quality TEXT NOT NULL DEFAULT 'standard',
  style TEXT,
  size TEXT NOT NULL DEFAULT '1024x1024',
  model TEXT NOT NULL,
  is_uploaded BOOLEAN DEFAULT FALSE,
  original_image_id TEXT, -- Changed from UUID to TEXT to support local image IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  url TEXT NOT NULL, -- Video storage URL
  thumbnail_url TEXT, -- Thumbnail URL
  prompt TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5, -- Duration in seconds
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  model TEXT NOT NULL DEFAULT 'standard', -- 'standard' or 'pro'
  source_image_url TEXT, -- Source image for image-to-video
  status TEXT NOT NULL DEFAULT 'completed', -- 'generating', 'completed', 'failed'
  final_elapsed_time INTEGER, -- Final generation time in seconds
  error_message TEXT, -- Error message if failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_images_chat_id ON images(chat_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_chat_id ON videos(chat_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- Create updated_at trigger for chats table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for easier querying
CREATE OR REPLACE VIEW chat_summaries AS
SELECT 
  c.id,
  c.title,
  c.model,
  c.created_at,
  c.updated_at,
  c.user_id,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT i.id) as image_count,
  MAX(m.created_at) as last_message_at
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
LEFT JOIN images i ON c.id = i.chat_id
GROUP BY c.id;

-- Row Level Security (RLS) - Enable when auth is implemented
-- ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE images ENABLE ROW LEVEL SECURITY;