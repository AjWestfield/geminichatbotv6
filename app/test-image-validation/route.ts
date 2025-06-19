import { NextRequest, NextResponse } from "next/server"
import { validateImageUrl, isReplicateDeliveryUrl, ensureImageUrlAccessible } from "@/lib/image-url-validator"

/**
 * Test endpoint for image URL validation functionality
 * This helps debug and test the image URL handling logic
 */
export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json()
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      )
    }

    console.log('[test-image-validation] Testing URL:', imageUrl)

    const testResults = {
      originalUrl: imageUrl,
      isReplicateDeliveryUrl: isReplicateDeliveryUrl(imageUrl),
      isAccessible: false,
      validatedUrl: null,
      error: null,
      timestamp: new Date().toISOString()
    }

    // Test URL accessibility
    try {
      testResults.isAccessible = await validateImageUrl(imageUrl)
      console.log('[test-image-validation] URL accessible:', testResults.isAccessible)
    } catch (error) {
      console.error('[test-image-validation] Error checking accessibility:', error)
      testResults.error = `Accessibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    // Test URL validation/recovery
    if (!testResults.isAccessible) {
      try {
        testResults.validatedUrl = await ensureImageUrlAccessible(imageUrl)
        console.log('[test-image-validation] URL recovered/validated successfully')
      } catch (error) {
        console.error('[test-image-validation] URL recovery failed:', error)
        testResults.error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      testResults.validatedUrl = imageUrl
    }

    return NextResponse.json({
      success: true,
      testResults,
      message: testResults.error ? 'Test completed with errors' : 'Test completed successfully'
    })
  } catch (error) {
    console.error('[test-image-validation] Test error:', error)
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}