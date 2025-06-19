'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Download,
  Upload,
  FileText,
  Database,
  Image as ImageIcon,
  Video,
  Settings,
  Archive,
  Import,
  ArrowUpFromLine as Export,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { GeneratedImage } from '@/lib/image-generation-types'
import { useToast } from '@/hooks/use-toast'

interface ExportImportSystemProps {
  images: GeneratedImage[]
  videos?: any[]
  onImagesUpdate: (images: GeneratedImage[]) => void
  onVideosUpdate?: (videos: any[]) => void
}

interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'html'
  includeImages: boolean
  includeVideos: boolean
  includeSettings: boolean
  includeMetadata: boolean
  dateRange?: {
    start: string
    end: string
  }
  quality?: 'all' | 'hd' | 'standard'
  models?: string[]
}

interface ImportResult {
  success: boolean
  imported: {
    images: number
    videos: number
    settings: number
  }
  errors: string[]
  warnings: string[]
}

export function ExportImportSystem({
  images,
  videos = [],
  onImagesUpdate,
  onVideosUpdate
}: ExportImportSystemProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeImages: true,
    includeVideos: true,
    includeSettings: false,
    includeMetadata: true
  })
  const [importData, setImportData] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<ImportResult | null>(null)

  const handleExport = useCallback(async () => {
    setIsProcessing(true)

    try {
      // Filter data based on options
      let filteredImages = images
      let filteredVideos = videos

      // Apply date range filter
      if (exportOptions.dateRange?.start && exportOptions.dateRange?.end) {
        const startDate = new Date(exportOptions.dateRange.start)
        const endDate = new Date(exportOptions.dateRange.end)

        filteredImages = images.filter(img => {
          const imgDate = new Date(img.timestamp)
          return imgDate >= startDate && imgDate <= endDate
        })

        filteredVideos = videos.filter(video => {
          const videoDate = new Date(video.timestamp || video.createdAt)
          return videoDate >= startDate && videoDate <= endDate
        })
      }

      // Apply quality filter
      if (exportOptions.quality && exportOptions.quality !== 'all') {
        filteredImages = filteredImages.filter(img => img.quality === exportOptions.quality)
      }

      // Apply model filter
      if (exportOptions.models && exportOptions.models.length > 0) {
        filteredImages = filteredImages.filter(img => exportOptions.models!.includes(img.model))
        filteredVideos = filteredVideos.filter(video => exportOptions.models!.includes(video.model))
      }

      // Prepare export data
      const exportData: any = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        options: exportOptions
      }

      if (exportOptions.includeImages) {
        exportData.images = filteredImages.map(img => ({
          ...img,
          // Remove sensitive data if needed
          geminiUri: exportOptions.includeMetadata ? img.geminiUri : undefined
        }))
      }

      if (exportOptions.includeVideos) {
        exportData.videos = filteredVideos
      }

      if (exportOptions.includeSettings) {
        // Get current settings from localStorage
        const settings = {
          imageGenerationModel: localStorage.getItem('imageGenerationModel'),
          imageEditingModel: localStorage.getItem('imageEditingModel'),
          imageStyle: localStorage.getItem('imageStyle'),
          imageSize: localStorage.getItem('imageSize'),
          imageQuality: localStorage.getItem('imageQuality'),
          videoModel: localStorage.getItem('videoModel'),
          videoDuration: localStorage.getItem('videoDuration'),
          videoAspectRatio: localStorage.getItem('videoAspectRatio')
        }
        exportData.settings = settings
      }

      // Generate export based on format
      let content: string
      let filename: string
      let mimeType: string

      switch (exportOptions.format) {
        case 'json':
          content = JSON.stringify(exportData, null, 2)
          filename = `ai-chatbot-export-${Date.now()}.json`
          mimeType = 'application/json'
          break

        case 'csv':
          content = generateCSV(filteredImages, filteredVideos)
          filename = `ai-chatbot-export-${Date.now()}.csv`
          mimeType = 'text/csv'
          break

        case 'markdown':
          content = generateMarkdown(exportData)
          filename = `ai-chatbot-export-${Date.now()}.md`
          mimeType = 'text/markdown'
          break

        case 'html':
          content = generateHTML(exportData)
          filename = `ai-chatbot-export-${Date.now()}.html`
          mimeType = 'text/html'
          break

        default:
          throw new Error('Unsupported export format')
      }

      // Download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: `Exported ${filteredImages.length} images and ${filteredVideos.length} videos as ${exportOptions.format.toUpperCase()}`,
      })

    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [exportOptions, images, videos, toast])

  const handleImport = useCallback(async () => {
    if (!importData.trim()) {
      toast({
        title: "No Data",
        description: "Please paste or upload data to import",
        variant: "destructive"
      })
      return
    }

    setIsProcessing(true)

    try {
      const data = JSON.parse(importData)
      const result: ImportResult = {
        success: true,
        imported: { images: 0, videos: 0, settings: 0 },
        errors: [],
        warnings: []
      }

      // Import images
      if (data.images && Array.isArray(data.images)) {
        const validImages = data.images.filter((img: any) => {
          if (!img.id || !img.url || !img.prompt) {
            result.warnings.push(`Skipped invalid image: ${img.id || 'unknown'}`)
            return false
          }
          return true
        })

        // Check for duplicates
        const existingIds = new Set(images.map(img => img.id))
        const newImages = validImages.filter((img: any) => !existingIds.has(img.id))

        if (newImages.length > 0) {
          onImagesUpdate([...images, ...newImages])
          result.imported.images = newImages.length
        }

        if (validImages.length !== data.images.length) {
          result.warnings.push(`${data.images.length - validImages.length} images were invalid and skipped`)
        }
      }

      // Import videos
      if (data.videos && Array.isArray(data.videos) && onVideosUpdate) {
        const validVideos = data.videos.filter((video: any) => {
          if (!video.id || !video.url) {
            result.warnings.push(`Skipped invalid video: ${video.id || 'unknown'}`)
            return false
          }
          return true
        })

        if (validVideos.length > 0) {
          onVideosUpdate([...videos, ...validVideos])
          result.imported.videos = validVideos.length
        }
      }

      // Import settings
      if (data.settings) {
        Object.entries(data.settings).forEach(([key, value]) => {
          if (value && typeof value === 'string') {
            localStorage.setItem(key, value)
            result.imported.settings++
          }
        })
      }

      setLastResult(result)

      toast({
        title: "Import Successful",
        description: `Imported ${result.imported.images} images, ${result.imported.videos} videos, and ${result.imported.settings} settings`,
      })

    } catch (error) {
      console.error('Import failed:', error)
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : 'Invalid data format',
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }, [importData, images, videos, onImagesUpdate, onVideosUpdate, toast])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportData(content)
    }
    reader.readAsText(file)
  }, [])

  const generateCSV = (images: GeneratedImage[], videos: any[]): string => {
    const headers = ['Type', 'ID', 'Prompt', 'Model', 'Quality', 'Style', 'Size', 'Timestamp', 'URL']
    const rows = [headers.join(',')]

    images.forEach(img => {
      const row = [
        'Image',
        img.id,
        `"${img.prompt.replace(/"/g, '""')}"`,
        img.model,
        img.quality || '',
        img.style || '',
        img.size || '',
        new Date(img.timestamp).toISOString(),
        img.url
      ]
      rows.push(row.join(','))
    })

    videos.forEach(video => {
      const row = [
        'Video',
        video.id,
        `"${(video.prompt || '').replace(/"/g, '""')}"`,
        video.model || '',
        '',
        '',
        video.aspectRatio || '',
        new Date(video.timestamp || video.createdAt).toISOString(),
        video.url
      ]
      rows.push(row.join(','))
    })

    return rows.join('\n')
  }

  const generateMarkdown = (data: any): string => {
    let content = `# AI Chatbot Export\n\n`
    content += `**Exported:** ${new Date(data.exportedAt).toLocaleString()}\n\n`

    if (data.images) {
      content += `## Images (${data.images.length})\n\n`
      data.images.forEach((img: GeneratedImage, index: number) => {
        content += `### ${index + 1}. ${img.prompt.substring(0, 50)}...\n\n`
        content += `- **Model:** ${img.model}\n`
        content += `- **Quality:** ${img.quality}\n`
        content += `- **Style:** ${img.style}\n`
        content += `- **Size:** ${img.size}\n`
        content += `- **Created:** ${new Date(img.timestamp).toLocaleString()}\n`
        content += `- **URL:** ${img.url}\n\n`
        content += `**Full Prompt:** ${img.prompt}\n\n---\n\n`
      })
    }

    if (data.videos) {
      content += `## Videos (${data.videos.length})\n\n`
      data.videos.forEach((video: any, index: number) => {
        content += `### ${index + 1}. ${(video.prompt || 'Video').substring(0, 50)}...\n\n`
        content += `- **Model:** ${video.model}\n`
        content += `- **Duration:** ${video.duration}s\n`
        content += `- **Aspect Ratio:** ${video.aspectRatio}\n`
        content += `- **Created:** ${new Date(video.timestamp || video.createdAt).toLocaleString()}\n`
        content += `- **URL:** ${video.url}\n\n---\n\n`
      })
    }

    return content
  }

  const generateHTML = (data: any): string => {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chatbot Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .image { max-width: 300px; height: auto; border-radius: 4px; }
        .meta { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI Chatbot Export</h1>
        <p>Exported: ${new Date(data.exportedAt).toLocaleString()}</p>
    </div>`

    if (data.images) {
      html += `<h2>Images (${data.images.length})</h2>`
      data.images.forEach((img: GeneratedImage) => {
        html += `
        <div class="item">
            <img src="${img.url}" alt="${img.prompt}" class="image" />
            <h3>${img.prompt.substring(0, 100)}...</h3>
            <div class="meta">
                <p><strong>Model:</strong> ${img.model}</p>
                <p><strong>Quality:</strong> ${img.quality}</p>
                <p><strong>Style:</strong> ${img.style}</p>
                <p><strong>Created:</strong> ${new Date(img.timestamp).toLocaleString()}</p>
            </div>
        </div>`
      })
    }

    html += `</body></html>`
    return html
  }

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Archive className="h-5 w-5" />
          Export & Import System
        </CardTitle>
        <CardDescription>
          Export your data or import from backups
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tab Selection */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'export' ? 'default' : 'outline'}
            onClick={() => setActiveTab('export')}
            className="flex-1"
          >
            <Export className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant={activeTab === 'import' ? 'default' : 'outline'}
            onClick={() => setActiveTab('import')}
            className="flex-1"
          >
            <Import className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>

        {activeTab === 'export' && (
          <div className="space-y-4">
            {/* Export Format */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Export Format</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(value: any) => setExportOptions(prev => ({ ...prev, format: value }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="json" className="text-white hover:bg-gray-700">JSON (Full Data)</SelectItem>
                  <SelectItem value="csv" className="text-white hover:bg-gray-700">CSV (Spreadsheet)</SelectItem>
                  <SelectItem value="markdown" className="text-white hover:bg-gray-700">Markdown (Documentation)</SelectItem>
                  <SelectItem value="html" className="text-white hover:bg-gray-700">HTML (Web Page)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-300">Include</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-images"
                    checked={exportOptions.includeImages}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeImages: !!checked }))
                    }
                  />
                  <Label htmlFor="include-images" className="text-sm text-gray-300">
                    Images ({images.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-videos"
                    checked={exportOptions.includeVideos}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeVideos: !!checked }))
                    }
                  />
                  <Label htmlFor="include-videos" className="text-sm text-gray-300">
                    Videos ({videos.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-settings"
                    checked={exportOptions.includeSettings}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeSettings: !!checked }))
                    }
                  />
                  <Label htmlFor="include-settings" className="text-sm text-gray-300">
                    Settings & Preferences
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-metadata"
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeMetadata: !!checked }))
                    }
                  />
                  <Label htmlFor="include-metadata" className="text-sm text-gray-300">
                    Metadata & Technical Details
                  </Label>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Upload File</Label>
              <Input
                type="file"
                accept=".json,.txt"
                onChange={handleFileUpload}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Manual Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">Or Paste Data</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON data here..."
                className="bg-gray-800 border-gray-600 text-white min-h-[200px]"
              />
            </div>

            {/* Import Results */}
            {lastResult && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Last Import Result</Label>
                <div className="bg-gray-800 p-3 rounded border border-gray-600">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-400 text-sm">Import Successful</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Images: {lastResult.imported.images}</div>
                    <div>Videos: {lastResult.imported.videos}</div>
                    <div>Settings: {lastResult.imported.settings}</div>
                    {lastResult.warnings.length > 0 && (
                      <div className="text-yellow-400">
                        Warnings: {lastResult.warnings.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Import Button */}
            <Button
              onClick={handleImport}
              disabled={isProcessing || !importData.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
