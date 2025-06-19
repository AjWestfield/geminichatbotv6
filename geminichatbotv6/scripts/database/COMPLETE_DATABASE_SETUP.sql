-- Complete Database Setup for Gemini Chatbot v5
-- This creates all missing tables (videos, audios, social_media_cookies)
-- Run this in Supabase SQL Editor: https://bsocqrwrikfmymklgart.supabase.com/project/bsocqrwrikfmymklgart/sql/new

-- ============================================
-- 1. VIDEOS TABLE
-- ============================================
DROP TABLE IF EXISTS public.videos CASCADE;

CREATE TABLE public.videos (
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

CREATE INDEX idx_videos_chat_id ON public.videos(chat_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_created_at ON public.videos(created_at DESC);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on videos" ON public.videos
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

GRANT ALL ON public.videos TO authenticated;
GRANT ALL ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;

-- ============================================
-- 2. AUDIOS TABLE
-- ============================================
DROP TABLE IF EXISTS public.audios CASCADE;

CREATE TABLE public.audios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID,
    message_id UUID,
    url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    model TEXT DEFAULT 'elevenlabs',
    voice_id TEXT,
    duration REAL,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'audio/mpeg',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audios_chat_id ON public.audios(chat_id);
CREATE INDEX idx_audios_created_at ON public.audios(created_at DESC);

ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on audios" ON public.audios
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

GRANT ALL ON public.audios TO authenticated;
GRANT ALL ON public.audios TO anon;
GRANT ALL ON public.audios TO service_role;

-- ============================================
-- 3. SOCIAL MEDIA COOKIES TABLE
-- ============================================
DROP TABLE IF EXISTS public.social_media_cookies CASCADE;

CREATE TABLE public.social_media_cookies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL,
    encrypted_cookies TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cookies_platform ON public.social_media_cookies(platform);
CREATE INDEX idx_cookies_active ON public.social_media_cookies(is_active);

ALTER TABLE public.social_media_cookies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on cookies" ON public.social_media_cookies
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

GRANT ALL ON public.social_media_cookies TO authenticated;
GRANT ALL ON public.social_media_cookies TO anon;
GRANT ALL ON public.social_media_cookies TO service_role;

-- ============================================
-- 4. UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Videos trigger
CREATE TRIGGER update_videos_updated_at 
    BEFORE UPDATE ON public.videos
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Audios trigger
CREATE TRIGGER update_audios_updated_at 
    BEFORE UPDATE ON public.audios
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Cookies trigger
CREATE TRIGGER update_cookies_updated_at 
    BEFORE UPDATE ON public.social_media_cookies
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. VERIFY INSTALLATION
-- ============================================
SELECT 
    'Tables created successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos') as videos_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audios') as audios_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_media_cookies') as cookies_exists;
