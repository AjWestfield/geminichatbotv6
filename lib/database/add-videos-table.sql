-- Add videos table to existing database

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
CREATE INDEX IF NOT EXISTS idx_videos_chat_id ON videos(chat_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- Update the chat_summaries view to include video count
DROP VIEW IF EXISTS chat_summaries;

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
  COUNT(DISTINCT v.id) as video_count,
  MAX(m.created_at) as last_message_at
FROM chats c
LEFT JOIN messages m ON c.id = m.chat_id
LEFT JOIN images i ON c.id = i.chat_id
LEFT JOIN videos v ON c.id = v.chat_id
GROUP BY c.id;