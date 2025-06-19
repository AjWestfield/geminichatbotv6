-- Add canvas_state column to chats table for persistent Canvas view
-- Run this in Supabase SQL Editor: https://bsocqrwrikfmymklgart.supabase.com/project/bsocqrwrikfmymklgart/sql/new

-- ============================================
-- 1. ADD CANVAS STATE COLUMN TO CHATS TABLE
-- ============================================
ALTER TABLE public.chats 
ADD COLUMN IF NOT EXISTS canvas_state JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.chats.canvas_state IS 'Stores Canvas view state including selected images, layout preferences, and display settings';

-- ============================================
-- 2. CREATE FILE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.file_references (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document'
    file_size BIGINT,
    content_type TEXT,
    original_name TEXT,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    message_id UUID,
    user_id UUID,
    reference_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    storage_location TEXT, -- 'blob', 'gemini', 'external'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_references_chat_id ON public.file_references(chat_id);
CREATE INDEX IF NOT EXISTS idx_file_references_file_url ON public.file_references(file_url);
CREATE INDEX IF NOT EXISTS idx_file_references_last_accessed ON public.file_references(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_file_references_user_id ON public.file_references(user_id);

-- Enable RLS
ALTER TABLE public.file_references ENABLE ROW LEVEL SECURITY;

-- Create policy for file references
CREATE POLICY "Allow all operations on file_references" ON public.file_references
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.file_references TO authenticated;
GRANT ALL ON public.file_references TO anon;
GRANT ALL ON public.file_references TO service_role;

-- ============================================
-- 3. CREATE USER STORAGE QUOTAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_storage_quotas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    storage_used BIGINT DEFAULT 0, -- in bytes
    storage_limit BIGINT DEFAULT 1073741824, -- 1GB default
    file_count INTEGER DEFAULT 0,
    file_count_limit INTEGER DEFAULT 1000, -- 1000 files default
    last_cleanup_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_storage_quotas_user_id ON public.user_storage_quotas(user_id);

-- Enable RLS
ALTER TABLE public.user_storage_quotas ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on user_storage_quotas" ON public.user_storage_quotas
    FOR ALL TO authenticated, anon
    USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.user_storage_quotas TO authenticated;
GRANT ALL ON public.user_storage_quotas TO anon;
GRANT ALL ON public.user_storage_quotas TO service_role;

-- ============================================
-- 4. CREATE TRIGGERS FOR UPDATED_AT
-- ============================================
-- File references trigger
CREATE TRIGGER update_file_references_updated_at 
    BEFORE UPDATE ON public.file_references
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- User storage quotas trigger
CREATE TRIGGER update_user_storage_quotas_updated_at 
    BEFORE UPDATE ON public.user_storage_quotas
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. CREATE FUNCTION TO UPDATE CANVAS STATE
-- ============================================
CREATE OR REPLACE FUNCTION update_canvas_state(
    p_chat_id UUID,
    p_canvas_state JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.chats
    SET 
        canvas_state = p_canvas_state,
        updated_at = NOW()
    WHERE id = p_chat_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE FUNCTION TO TRACK FILE USAGE
-- ============================================
CREATE OR REPLACE FUNCTION track_file_usage(
    p_file_url TEXT,
    p_file_type TEXT,
    p_chat_id UUID DEFAULT NULL,
    p_message_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_content_type TEXT DEFAULT NULL,
    p_original_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_file_id UUID;
BEGIN
    -- Check if file already exists
    SELECT id INTO v_file_id
    FROM public.file_references
    WHERE file_url = p_file_url
    LIMIT 1;
    
    IF v_file_id IS NOT NULL THEN
        -- Update existing file reference
        UPDATE public.file_references
        SET 
            reference_count = reference_count + 1,
            last_accessed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_file_id;
    ELSE
        -- Insert new file reference
        INSERT INTO public.file_references (
            file_url,
            file_type,
            chat_id,
            message_id,
            user_id,
            file_size,
            content_type,
            original_name
        ) VALUES (
            p_file_url,
            p_file_type,
            p_chat_id,
            p_message_id,
            p_user_id,
            p_file_size,
            p_content_type,
            p_original_name
        )
        RETURNING id INTO v_file_id;
    END IF;
    
    -- Update user storage quota if user_id provided
    IF p_user_id IS NOT NULL AND p_file_size IS NOT NULL THEN
        INSERT INTO public.user_storage_quotas (user_id, storage_used, file_count)
        VALUES (p_user_id, p_file_size, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            storage_used = user_storage_quotas.storage_used + p_file_size,
            file_count = user_storage_quotas.file_count + 1,
            updated_at = NOW();
    END IF;
    
    RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE VIEW FOR CANVAS IMAGES
-- ============================================
CREATE OR REPLACE VIEW canvas_images AS
SELECT 
    i.id,
    i.url,
    i.prompt,
    i.chat_id,
    i.message_id,
    i.is_uploaded,
    i.created_at,
    c.canvas_state,
    CASE 
        WHEN c.canvas_state ? 'selectedImages' 
        AND c.canvas_state->'selectedImages' ? i.id::text 
        THEN true 
        ELSE false 
    END as is_in_canvas
FROM public.images i
LEFT JOIN public.chats c ON i.chat_id = c.id
WHERE i.chat_id IS NOT NULL;

-- Grant permissions on view
GRANT SELECT ON canvas_images TO authenticated;
GRANT SELECT ON canvas_images TO anon;
GRANT SELECT ON canvas_images TO service_role;

-- ============================================
-- 8. VERIFY INSTALLATION
-- ============================================
SELECT 
    'Canvas state migration completed!' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'chats' AND column_name = 'canvas_state') as canvas_state_column_exists,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name = 'file_references') as file_references_table_exists,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name = 'user_storage_quotas') as user_storage_quotas_table_exists;