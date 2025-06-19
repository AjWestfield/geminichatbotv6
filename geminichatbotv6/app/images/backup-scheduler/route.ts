import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_API_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('[Backup Scheduler] Starting automated backup process')

    const { action } = await request.json()

    if (action !== 'run-backup') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Find images that need backup checking
    const { data: images, error } = await supabase
      .from('images')
      .select('id, url, created_at, metadata')
      .like('url', '%replicate.delivery%')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Backup Scheduler] Error fetching images:', error)
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    console.log('[Backup Scheduler] Found images to check:', images.length)

    const results = {
      total: images.length,
      checked: 0,
      stillAccessible: 0,
      needsBackup: 0,
      errors: [] as string[]
    }

    // Check each image URL
    for (const image of images) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await fetch(image.url, {
          method: 'HEAD',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        const isAccessible = response.ok
        const ageInHours = (Date.now() - new Date(image.created_at).getTime()) / (1000 * 60 * 60)

        // Update metadata
        await supabase
          .from('images')
          .update({
            metadata: {
              ...image.metadata,
              lastChecked: new Date().toISOString(),
              stillAccessible: isAccessible,
              ageInHours: Math.round(ageInHours),
              needsBackup: !isAccessible && ageInHours > 24
            }
          })
          .eq('id', image.id)

        if (isAccessible) {
          results.stillAccessible++
        } else {
          results.needsBackup++

          // If image is not accessible and old enough, try to create a backup entry
          if (ageInHours > 24) {
            console.log(`[Backup Scheduler] Image ${image.id} needs backup (${Math.round(ageInHours)}h old)`)
          }
        }

        results.checked++

      } catch (error) {
        console.error(`[Backup Scheduler] Error checking image ${image.id}:`, error)
        results.errors.push(`Image ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        // Mark as needs backup due to error
        await supabase
          .from('images')
          .update({
            metadata: {
              ...image.metadata,
              lastChecked: new Date().toISOString(),
              stillAccessible: false,
              checkError: error instanceof Error ? error.message : 'Unknown error',
              needsBackup: true
            }
          })
          .eq('id', image.id)

        results.needsBackup++
        results.checked++
      }
    }

    console.log('[Backup Scheduler] Backup check completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Automated backup check completed',
      results,
      nextRunRecommended: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now
    })

  } catch (error) {
    console.error('[Backup Scheduler] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Backup scheduler failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get backup status and statistics
    const { data: stats, error } = await supabase
      .from('images')
      .select('metadata, created_at, url')
      .like('url', '%replicate.delivery%')

    if (error) {
      console.error('[Backup Scheduler] Error fetching stats:', error)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    const now = Date.now()
    const analysis = {
      total: stats.length,
      needsBackup: 0,
      stillAccessible: 0,
      notChecked: 0,
      recentlyChecked: 0,
      oldImages: 0
    }

    stats.forEach(image => {
      const ageInHours = (now - new Date(image.created_at).getTime()) / (1000 * 60 * 60)
      const lastChecked = image.metadata?.lastChecked
      const stillAccessible = image.metadata?.stillAccessible
      const needsBackup = image.metadata?.needsBackup

      if (ageInHours > 24) {
        analysis.oldImages++
      }

      if (needsBackup) {
        analysis.needsBackup++
      } else if (stillAccessible === true) {
        analysis.stillAccessible++
      } else if (!lastChecked) {
        analysis.notChecked++
      } else {
        const checkAge = (now - new Date(lastChecked).getTime()) / (1000 * 60 * 60)
        if (checkAge < 24) {
          analysis.recentlyChecked++
        }
      }
    })

    return NextResponse.json({
      success: true,
      analysis,
      lastRun: stats.find(s => s.metadata?.lastChecked)?.metadata?.lastChecked,
      recommendations: {
        shouldRunBackup: analysis.notChecked > 10 || analysis.needsBackup > 0,
        priority: analysis.needsBackup > 5 ? 'high' : analysis.notChecked > 20 ? 'medium' : 'low'
      }
    })

  } catch (error) {
    console.error('[Backup Scheduler] Error getting status:', error)
    return NextResponse.json(
      { error: 'Failed to get backup status' },
      { status: 500 }
    )
  }
}
