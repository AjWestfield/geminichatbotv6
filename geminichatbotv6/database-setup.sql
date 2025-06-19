-- Database setup for enhancement features
-- Run this in your Supabase SQL editor

-- Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create collection_images junction table
CREATE TABLE IF NOT EXISTS collection_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, image_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_images_collection_id ON collection_images(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_images_image_id ON collection_images(image_id);

-- Add metadata column to images table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'images' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE images ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create index on images metadata for better performance
CREATE INDEX IF NOT EXISTS idx_images_metadata ON images USING GIN(metadata);

-- Create index on images URL for backup operations
CREATE INDEX IF NOT EXISTS idx_images_url ON images(url);

-- Create index on images created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

-- Update function for collections
CREATE OR REPLACE FUNCTION update_collection_image_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE collections 
        SET image_count = image_count + 1, updated_at = NOW()
        WHERE id = NEW.collection_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE collections 
        SET image_count = image_count - 1, updated_at = NOW()
        WHERE id = OLD.collection_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic image count updates
DROP TRIGGER IF EXISTS trigger_update_collection_image_count_insert ON collection_images;
CREATE TRIGGER trigger_update_collection_image_count_insert
    AFTER INSERT ON collection_images
    FOR EACH ROW EXECUTE FUNCTION update_collection_image_count();

DROP TRIGGER IF EXISTS trigger_update_collection_image_count_delete ON collection_images;
CREATE TRIGGER trigger_update_collection_image_count_delete
    AFTER DELETE ON collection_images
    FOR EACH ROW EXECUTE FUNCTION update_collection_image_count();

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index on user preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Insert default user preferences
INSERT INTO user_preferences (user_id, preferences) 
VALUES ('default_user', '{
    "theme": "dark",
    "accentColor": "#6366f1",
    "fontSize": 14,
    "compactMode": false,
    "showAnimations": true,
    "defaultTab": "chat",
    "autoSwitchToResults": true,
    "showThumbnails": true,
    "gridSize": 3,
    "showMetadata": true,
    "enableNotifications": true,
    "soundEnabled": true,
    "notifyOnCompletion": true,
    "notifyOnErrors": true,
    "autoSaveInterval": 30,
    "maxHistoryItems": 1000,
    "preloadImages": true,
    "enableCaching": true,
    "saveHistory": true,
    "shareAnalytics": false,
    "autoBackup": true,
    "highContrast": false,
    "reducedMotion": false,
    "screenReaderMode": false,
    "keyboardNavigation": true,
    "developerMode": false,
    "debugLogging": false,
    "experimentalFeatures": false
}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- Create analytics table for tracking usage
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    user_id TEXT DEFAULT 'default_user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);

-- Create backup status table
CREATE TABLE IF NOT EXISTS backup_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_accessible BOOLEAN,
    needs_backup BOOLEAN DEFAULT FALSE,
    backup_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(image_id)
);

-- Create indexes for backup status
CREATE INDEX IF NOT EXISTS idx_backup_status_image_id ON backup_status(image_id);
CREATE INDEX IF NOT EXISTS idx_backup_status_needs_backup ON backup_status(needs_backup);
CREATE INDEX IF NOT EXISTS idx_backup_status_last_checked ON backup_status(last_checked DESC);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON collections TO authenticated;
-- GRANT ALL ON collection_images TO authenticated;
-- GRANT ALL ON user_preferences TO authenticated;
-- GRANT ALL ON analytics_events TO authenticated;
-- GRANT ALL ON backup_status TO authenticated;
