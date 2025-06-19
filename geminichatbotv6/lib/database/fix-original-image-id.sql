-- Fix for original_image_id UUID error
-- Changes the column type from UUID to TEXT to support local image IDs

-- Drop the existing foreign key constraint if it exists
ALTER TABLE images 
DROP CONSTRAINT IF EXISTS images_original_image_id_fkey;

-- Change the column type from UUID to TEXT
ALTER TABLE images 
ALTER COLUMN original_image_id TYPE TEXT;

-- Add a comment explaining the change
COMMENT ON COLUMN images.original_image_id IS 'ID of the original image (for edited images). Changed from UUID to TEXT to support local image IDs like img_1748976895957_5b516nlg2';