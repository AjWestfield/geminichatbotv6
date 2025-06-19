-- Complete Database Setup for geminichatbotv5
-- Run this entire script in Supabase SQL Editor

-- 1. Create videos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID,
    message_id UUID,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    prompt TEXT NOT NULL,
    duration INTEGER DEFAULT 5,
    aspect_ratio TEXT DEFAULT '16:9',
    model TEXT DEFAULT 'standard',
    source_image_url TEXT,
    status TEXT DEFAULT 'generating',
    final_elapsed_time INTEGER,
    error_message TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_chat_id ON public.videos(chat_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Allow all operations on videos" ON public.videos;
CREATE POLICY "Allow all operations on videos" ON public.videos
    FOR ALL 
    TO authenticated, anon
    USING (true) 
    WITH CHECK (true);

-- 5. Grant permissions
GRANT ALL ON public.videos TO authenticated;
GRANT ALL ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;

-- 6. Create or replace update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at 
    BEFORE UPDATE ON public.videos
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Verify images table exists
CREATE TABLE IF NOT EXISTS public.images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID,
    message_id UUID,
    url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    revised_prompt TEXT,
    quality TEXT DEFAULT 'standard',
    style TEXT,
    size TEXT DEFAULT '1024x1024',
    model TEXT NOT NULL,
    is_uploaded BOOLEAN DEFAULT false,
    original_image_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create indexes for images table
CREATE INDEX IF NOT EXISTS idx_images_chat_id ON public.images(chat_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON public.images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_original_image_id ON public.images(original_image_id);

-- 10. Enable RLS for images
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- 11. Create policy for images
DROP POLICY IF EXISTS "Allow all operations on images" ON public.images;
CREATE POLICY "Allow all operations on images" ON public.images
    FOR ALL 
    TO authenticated, anon
    USING (true) 
    WITH CHECK (true);

-- 12. Grant permissions for images
GRANT ALL ON public.images TO authenticated;
GRANT ALL ON public.images TO anon;
GRANT ALL ON public.images TO service_role;

-- 13. Test that tables were created
SELECT 
    'Tables created successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'videos') as videos_table_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'images') as images_table_exists,
    (SELECT COUNT(*) FROM public.images) as total_images,
    (SELECT COUNT(*) FROM public.videos) as total_videos;
