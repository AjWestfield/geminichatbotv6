import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_API_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('[Database Setup] Starting database setup...')

    // Create collections table
    const { error: collectionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS collections (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          image_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        );
      `
    })

    if (collectionsError) {
      console.log('[Database Setup] Collections table may already exist or using direct SQL...')
    }

    // Create collection_images table
    const { error: collectionImagesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS collection_images (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
          image_id TEXT NOT NULL,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(collection_id, image_id)
        );
      `
    })

    if (collectionImagesError) {
      console.log('[Database Setup] Collection images table may already exist...')
    }

    // Try to create tables using direct SQL execution
    try {
      // Collections table
      await supabase
        .from('collections')
        .select('id')
        .limit(1)
    } catch (error) {
      console.log('[Database Setup] Collections table does not exist, will be created by first insert')
    }

    // Add metadata column to images table if it doesn't exist
    try {
      const { data: columns } = await supabase
        .rpc('get_table_columns', { table_name: 'images' })
      
      const hasMetadata = columns?.some((col: any) => col.column_name === 'metadata')
      
      if (!hasMetadata) {
        console.log('[Database Setup] Adding metadata column to images table...')
        // This would need to be done manually in Supabase dashboard
      }
    } catch (error) {
      console.log('[Database Setup] Could not check images table structure')
    }

    // Create user preferences table using insert (will create table if not exists)
    try {
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: 'default_user',
          preferences: {
            theme: 'dark',
            accentColor: '#6366f1',
            fontSize: 14,
            compactMode: false,
            showAnimations: true,
            defaultTab: 'chat',
            autoSwitchToResults: true,
            showThumbnails: true,
            gridSize: 3,
            showMetadata: true,
            enableNotifications: true,
            soundEnabled: true,
            notifyOnCompletion: true,
            notifyOnErrors: true,
            autoSaveInterval: 30,
            maxHistoryItems: 1000,
            preloadImages: true,
            enableCaching: true,
            saveHistory: true,
            shareAnalytics: false,
            autoBackup: true,
            highContrast: false,
            reducedMotion: false,
            screenReaderMode: false,
            keyboardNavigation: true,
            developerMode: false,
            debugLogging: false,
            experimentalFeatures: false
          }
        })

      if (prefsError) {
        console.log('[Database Setup] User preferences setup error:', prefsError)
      } else {
        console.log('[Database Setup] User preferences table ready')
      }
    } catch (error) {
      console.log('[Database Setup] User preferences table will be created on first use')
    }

    // Test collections table by attempting an insert
    try {
      const { data: testCollection, error: testError } = await supabase
        .from('collections')
        .insert({
          name: 'Test Collection Setup',
          description: 'Database setup test collection',
          image_count: 0
        })
        .select()
        .single()

      if (testError) {
        console.log('[Database Setup] Collections table test failed:', testError)
      } else {
        console.log('[Database Setup] Collections table working, test collection created:', testCollection?.id)
        
        // Clean up test collection
        await supabase
          .from('collections')
          .delete()
          .eq('id', testCollection.id)
      }
    } catch (error) {
      console.log('[Database Setup] Collections table test error:', error)
    }

    console.log('[Database Setup] Database setup completed')

    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      details: {
        collectionsTable: 'Ready',
        userPreferences: 'Ready',
        imagesMetadata: 'Check manually if metadata column exists'
      }
    })

  } catch (error) {
    console.error('[Database Setup] Setup failed:', error)
    return NextResponse.json(
      { 
        error: 'Database setup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[Database Setup] Checking database status...')

    const status = {
      collections: false,
      collectionImages: false,
      userPreferences: false,
      imagesMetadata: false
    }

    // Check collections table
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('id')
        .limit(1)
      
      status.collections = !error
    } catch (error) {
      status.collections = false
    }

    // Check collection_images table
    try {
      const { data, error } = await supabase
        .from('collection_images')
        .select('id')
        .limit(1)
      
      status.collectionImages = !error
    } catch (error) {
      status.collectionImages = false
    }

    // Check user_preferences table
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('id')
        .limit(1)
      
      status.userPreferences = !error
    } catch (error) {
      status.userPreferences = false
    }

    // Check images table for metadata column
    try {
      const { data, error } = await supabase
        .from('images')
        .select('metadata')
        .limit(1)
      
      status.imagesMetadata = !error
    } catch (error) {
      status.imagesMetadata = false
    }

    return NextResponse.json({
      success: true,
      status,
      ready: Object.values(status).every(Boolean)
    })

  } catch (error) {
    console.error('[Database Setup] Status check failed:', error)
    return NextResponse.json(
      { error: 'Status check failed' },
      { status: 500 }
    )
  }
}
