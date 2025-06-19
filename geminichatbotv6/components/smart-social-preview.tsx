"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import './smart-social-preview.css'
import { analyzeSocialMediaUrl, getPlatformInfo } from '@/lib/social-media/enhanced-url-validator'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, Download, Loader2, Image as ImageIcon, Video, AlertCircle, Cookie } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CookieManager } from './cookie-manager'

interface SmartSocialPreviewProps {
  url: string
  onContentReady: (items: ProcessedContent[]) => void
  onCancel: () => void
  className?: string
}

interface ProcessedContent {
  file: File
  preview: string
  type: 'image' | 'video'
  metadata?: any
}

export function SmartSocialPreview({ url, onContentReady, onCancel, className }: SmartSocialPreviewProps) {
  console.log('[SmartSocialPreview] Component mounted for URL:', url)
  const [analysis] = useState(() => analyzeSocialMediaUrl(url))
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showCookieManager, setShowCookieManager] = useState(false)
  const [cookies, setCookies] = useState<string | null>(null)
  const hasDownloadedRef = useRef(false)
  const isRateLimitedRef = useRef(false)
  const downloadAttemptRef = useRef(0)

  const handleDownload = useCallback(async (cookieData?: string) => {
    if (!analysis.isValid || !analysis.platform || hasDownloadedRef.current || isRateLimitedRef.current) {
      console.log('[SmartSocialPreview] Skipping download - already downloaded, invalid, or rate limited')
      return
    }

    // Mark as downloaded immediately to prevent duplicate calls
    hasDownloadedRef.current = true
    downloadAttemptRef.current += 1

    setIsDownloading(true)
    setError(null)
    setShowCookieManager(false)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      // Try complex download first (which may actually get real content)
      let response = await fetch('/api/download-social-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          cookies: cookieData || cookies
        })
      })

      // If complex download fails and we don't need auth, try the simple method
      if (!response.ok && response.status !== 401) {
        console.log('[SmartSocialPreview] Complex download failed, trying simple method as fallback')
        response = await fetch('/api/simple-download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url })
        })
      }

      clearInterval(progressInterval)

      const data = await response.json()

      console.log('[SmartSocialPreview] Response status:', response.status)
      console.log('[SmartSocialPreview] Response data:', data)

      if (!response.ok) {
        // Check for rate limiting
        if (response.status === 429) {
          setError('Rate limit exceeded. Please wait a moment before trying again.')
          isRateLimitedRef.current = true
          // Reset rate limit flag after 60 seconds
          setTimeout(() => {
            isRateLimitedRef.current = false
            hasDownloadedRef.current = false
          }, 60000)
          return
        }

        // Check for age-restricted content (now treated as auth required)
        if (response.status === 401 && data.ageRestricted) {
          setError('This content is age-restricted. Please provide cookies to bypass this restriction.')
          setShowCookieManager(true) // Allow cookie authentication for age-restricted content
          return
        }

        // Check if authentication is required (401 Unauthorized)
        if (response.status === 401 && data.requiresAuth !== false) {
          const errorMessage = data.error || 'Authentication required. Please provide cookies.'
          setError(errorMessage)
          if (data.details) {
            console.log('[SmartSocialPreview] Auth details:', data.details)
          }
          setShowCookieManager(true)
          return
        }
        throw new Error(data.error || 'Failed to download content')
      }

      const { content } = data
      setProgress(100)

      // Convert to processed content
      const processedItems: ProcessedContent[] = []

      // Process each downloaded item
      for (const item of content.items) {
        // Convert data URL to blob and create a proper File object
        let file: File

        if (item.url.startsWith('data:')) {
          // Extract base64 data from data URL
          const [header, base64] = item.url.split(',')
          const mimeType = header.match(/data:([^;]+)/)?.[1] || item.mimeType

          // Convert base64 to blob
          const byteCharacters = atob(base64)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: mimeType })

          // Create File object
          file = new File([blob], item.filename, { type: mimeType })
        } else {
          // For non-data URLs (shouldn't happen with our API), create a placeholder
          console.warn('[SmartSocialPreview] Non-data URL received:', item.url)
          // Create a minimal placeholder image
          const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
            <rect width="400" height="400" fill="#E4405F"/>
            <text x="200" y="210" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
              ${content.platform || 'Social Media'}
            </text>
          </svg>`
          const blob = new Blob([placeholderSvg], { type: 'image/svg+xml' })
          file = new File([blob], item.filename, { type: item.mimeType })
        }

        // Determine the content type
        // For social media content, check the original content type from the API
        const itemType = content.type === 'video' || item.mimeType.startsWith('video/') ? 'video' : 'image'

        processedItems.push({
          file,
          preview: item.url,
          type: itemType,
          metadata: {
            ...content.metadata,
            platform: content.platform,
            sourceUrl: content.sourceUrl,
            thumbnail: item.thumbnail, // Include thumbnail in metadata
            originalType: content.type, // Include original content type
            isVideo: itemType === 'video' || content.type === 'video' // Explicitly mark as video
          }
        })
      }

      onContentReady(processedItems)
    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Download failed')
      // Only reset the download flag if not rate limited
      if (!isRateLimitedRef.current) {
        hasDownloadedRef.current = false
      }
    } finally {
      setIsDownloading(false)
    }
  }, [analysis, url, onContentReady, cookies])

  // Handle cookie submission
  const handleCookiesReady = useCallback((cookieData: string) => {
    setCookies(cookieData)
    handleDownload(cookieData)
  }, [handleDownload])

  // Auto-start download on mount
  useEffect(() => {
    let mounted = true
    if (analysis.isValid && !showCookieManager && mounted && !hasDownloadedRef.current && !isDownloading && !isRateLimitedRef.current) {
      handleDownload()
    }
    return () => { mounted = false }
  }, [analysis.isValid, showCookieManager, handleDownload, isDownloading])

  if (!analysis.isValid) {
    return null
  }

  // Show cookie manager if needed
  if (showCookieManager) {
    return (
      <div className={className}>
        <CookieManager
          onCookiesReady={handleCookiesReady}
          onClose={() => {
            setShowCookieManager(false)
            onCancel()
          }}
        />
      </div>
    )
  }

  const platformInfo = analysis.platform ? getPlatformInfo(analysis.platform) : null

  return (
    <Card className={cn("p-3 mb-2", className)}>
      <div className="flex items-start gap-3">
        {/* Platform Icon */}
        <div
          className={cn(
            "p-2 rounded-lg flex-shrink-0",
            analysis.platform ? `social-preview-${analysis.platform}` : 'social-preview-default'
          )}
        >
          {analysis.contentType === 'video' ? (
            <Video className="h-5 w-5 social-preview-icon" />
          ) : analysis.contentType === 'image' ? (
            <ImageIcon className="h-5 w-5 social-preview-icon" />
          ) : (
            <Download className="h-5 w-5 social-preview-icon" />
          )}
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {platformInfo?.name || 'Social Media'}
            </span>
            {analysis.contentType && (
              <span className="text-xs text-muted-foreground capitalize">
                {analysis.contentType === 'mixed' ? 'Post' : analysis.contentType}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground truncate">
            {url}
          </p>

          {/* Progress */}
          {isDownloading && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  Downloading...
                </span>
                <span className="text-xs font-medium">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span className="text-xs">{error}</span>
              </div>
              {error.includes('Authentication') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCookieManager(true)}
                  className="h-7 text-xs gap-1"
                >
                  <Cookie className="h-3 w-3" />
                  Provide Cookies
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isDownloading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-8 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
