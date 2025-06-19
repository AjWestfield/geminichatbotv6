-- Add source image relationships for multi-image edits
-- This allows tracking which images were used as sources for multi-image edits

-- Create junction table for image source relationships
CREATE TABLE IF NOT EXISTS public.image_source_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    edited_image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    source_image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    source_order INTEGER NOT NULL DEFAULT 0, -- Preserve the order of source images
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique combination of edited image and source image
    UNIQUE(edited_image_id, source_image_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_source_relations_edited ON public.image_source_relations(edited_image_id);
CREATE INDEX IF NOT EXISTS idx_image_source_relations_source ON public.image_source_relations(source_image_id);

-- Enable Row Level Security
ALTER TABLE public.image_source_relations ENABLE ROW LEVEL SECURITY;

-- Create policy for image source relations
DROP POLICY IF EXISTS "Allow all operations on image_source_relations" ON public.image_source_relations;
CREATE POLICY "Allow all operations on image_source_relations" ON public.image_source_relations
    FOR ALL 
    TO authenticated, anon
    USING (true) 
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.image_source_relations TO authenticated;
GRANT ALL ON public.image_source_relations TO anon;
GRANT ALL ON public.image_source_relations TO service_role;

-- Add helper function to get source images for an edited image
CREATE OR REPLACE FUNCTION get_source_images(edited_id UUID)
RETURNS TABLE (
    image_id UUID,
    url TEXT,
    prompt TEXT,
    source_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as image_id,
        i.url,
        i.prompt,
        isr.source_order
    FROM public.image_source_relations isr
    JOIN public.images i ON i.id = isr.source_image_id
    WHERE isr.edited_image_id = edited_id
    ORDER BY isr.source_order;
END;
$$ LANGUAGE plpgsql;

-- Test the table creation
SELECT 
    'Image source relations table created successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'image_source_relations') as table_exists;