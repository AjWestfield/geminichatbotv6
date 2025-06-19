'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Download, 
  Trash2, 
  Edit, 
  Copy, 
  Archive, 
  Tag, 
  FolderPlus,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Image as ImageIcon
} from 'lucide-react'
import { GeneratedImage } from '@/lib/image-generation-types'
import { useToast } from '@/hooks/use-toast'

interface BatchOperationsPanelProps {
  images: GeneratedImage[]
  selectedImageIds: Set<string>
  onSelectionChange: (selectedIds: Set<string>) => void
  onImagesUpdate: (images: GeneratedImage[]) => void
}

interface BatchOperation {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  requiresInput?: boolean
  inputType?: 'text' | 'select' | 'number'
  inputOptions?: string[]
  inputPlaceholder?: string
}

interface OperationProgress {
  total: number
  completed: number
  failed: number
  current?: string
  errors: string[]
}

const batchOperations: BatchOperation[] = [
  {
    id: 'download',
    name: 'Download All',
    description: 'Download selected images as a ZIP file',
    icon: <Download className="h-4 w-4" />
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Permanently delete selected images',
    icon: <Trash2 className="h-4 w-4" />
  },
  {
    id: 'add-tags',
    name: 'Add Tags',
    description: 'Add tags to selected images for organization',
    icon: <Tag className="h-4 w-4" />,
    requiresInput: true,
    inputType: 'text',
    inputPlaceholder: 'Enter tags separated by commas'
  },
  {
    id: 'change-quality',
    name: 'Change Quality',
    description: 'Update quality setting for selected images',
    icon: <Edit className="h-4 w-4" />,
    requiresInput: true,
    inputType: 'select',
    inputOptions: ['standard', 'hd']
  },
  {
    id: 'export-prompts',
    name: 'Export Prompts',
    description: 'Export prompts as text file',
    icon: <FileText className="h-4 w-4" />
  },
  {
    id: 'create-collection',
    name: 'Create Collection',
    description: 'Group selected images into a named collection',
    icon: <FolderPlus className="h-4 w-4" />,
    requiresInput: true,
    inputType: 'text',
    inputPlaceholder: 'Collection name'
  }
]

export function BatchOperationsPanel({ 
  images, 
  selectedImageIds, 
  onSelectionChange, 
  onImagesUpdate 
}: BatchOperationsPanelProps) {
  const { toast } = useToast()
  const [selectedOperation, setSelectedOperation] = useState<string>('')
  const [operationInput, setOperationInput] = useState<string>('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [progress, setProgress] = useState<OperationProgress | null>(null)

  const selectedImages = images.filter(img => selectedImageIds.has(img.id))

  const handleSelectAll = useCallback(() => {
    if (selectedImageIds.size === images.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(images.map(img => img.id)))
    }
  }, [images, selectedImageIds, onSelectionChange])

  const handleSelectByFilter = useCallback((filter: string) => {
    let filteredIds: string[] = []
    
    switch (filter) {
      case 'recent':
        filteredIds = images
          .filter(img => {
            const daysSinceCreation = (Date.now() - new Date(img.timestamp).getTime()) / (1000 * 60 * 60 * 24)
            return daysSinceCreation <= 7
          })
          .map(img => img.id)
        break
      case 'high-quality':
        filteredIds = images
          .filter(img => img.quality === 'hd')
          .map(img => img.id)
        break
      case 'generated':
        filteredIds = images
          .filter(img => !img.isUploaded)
          .map(img => img.id)
        break
      case 'uploaded':
        filteredIds = images
          .filter(img => img.isUploaded)
          .map(img => img.id)
        break
    }
    
    onSelectionChange(new Set(filteredIds))
  }, [images, onSelectionChange])

  const executeOperation = useCallback(async () => {
    if (!selectedOperation || selectedImageIds.size === 0) return

    const operation = batchOperations.find(op => op.id === selectedOperation)
    if (!operation) return

    if (operation.requiresInput && !operationInput.trim()) {
      toast({
        title: "Input Required",
        description: `Please provide ${operation.inputPlaceholder?.toLowerCase() || 'input'} for this operation.`,
        variant: "destructive"
      })
      return
    }

    setIsExecuting(true)
    setProgress({
      total: selectedImageIds.size,
      completed: 0,
      failed: 0,
      errors: []
    })

    try {
      switch (selectedOperation) {
        case 'download':
          await handleDownloadBatch()
          break
        case 'delete':
          await handleDeleteBatch()
          break
        case 'add-tags':
          await handleAddTags()
          break
        case 'change-quality':
          await handleChangeQuality()
          break
        case 'export-prompts':
          await handleExportPrompts()
          break
        case 'create-collection':
          await handleCreateCollection()
          break
      }

      toast({
        title: "Operation Completed",
        description: `Successfully processed ${progress?.completed || 0} images.`,
      })

    } catch (error) {
      console.error('Batch operation failed:', error)
      toast({
        title: "Operation Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      })
    } finally {
      setIsExecuting(false)
      setProgress(null)
      setSelectedOperation('')
      setOperationInput('')
    }
  }, [selectedOperation, selectedImageIds, operationInput, progress])

  const handleDownloadBatch = async () => {
    // Implementation for batch download
    const zip = await import('jszip')
    const JSZip = zip.default
    const zipFile = new JSZip()

    for (const imageId of selectedImageIds) {
      const image = images.find(img => img.id === imageId)
      if (!image) continue

      try {
        const response = await fetch(image.url)
        const blob = await response.blob()
        const filename = `${image.id}.${blob.type.split('/')[1] || 'jpg'}`
        zipFile.file(filename, blob)

        setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null)
      } catch (error) {
        setProgress(prev => prev ? { 
          ...prev, 
          failed: prev.failed + 1,
          errors: [...prev.errors, `Failed to download ${image.id}`]
        } : null)
      }
    }

    const zipBlob = await zipFile.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `images-batch-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteBatch = async () => {
    // Implementation for batch delete
    for (const imageId of selectedImageIds) {
      try {
        const response = await fetch(`/api/images/${imageId}`, { method: 'DELETE' })
        if (!response.ok) throw new Error('Delete failed')
        
        setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null)
      } catch (error) {
        setProgress(prev => prev ? { 
          ...prev, 
          failed: prev.failed + 1,
          errors: [...prev.errors, `Failed to delete ${imageId}`]
        } : null)
      }
    }

    // Update local state
    const updatedImages = images.filter(img => !selectedImageIds.has(img.id))
    onImagesUpdate(updatedImages)
    onSelectionChange(new Set())
  }

  const handleAddTags = async () => {
    const tags = operationInput.split(',').map(tag => tag.trim()).filter(Boolean)
    
    for (const imageId of selectedImageIds) {
      try {
        const response = await fetch(`/api/images/${imageId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags })
        })
        if (!response.ok) throw new Error('Tag addition failed')
        
        setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null)
      } catch (error) {
        setProgress(prev => prev ? { 
          ...prev, 
          failed: prev.failed + 1,
          errors: [...prev.errors, `Failed to tag ${imageId}`]
        } : null)
      }
    }
  }

  const handleChangeQuality = async () => {
    for (const imageId of selectedImageIds) {
      try {
        const response = await fetch(`/api/images/${imageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality: operationInput })
        })
        if (!response.ok) throw new Error('Quality update failed')
        
        setProgress(prev => prev ? { ...prev, completed: prev.completed + 1 } : null)
      } catch (error) {
        setProgress(prev => prev ? { 
          ...prev, 
          failed: prev.failed + 1,
          errors: [...prev.errors, `Failed to update ${imageId}`]
        } : null)
      }
    }
  }

  const handleExportPrompts = async () => {
    const prompts = selectedImages.map(img => ({
      id: img.id,
      prompt: img.prompt,
      model: img.model,
      timestamp: img.timestamp,
      quality: img.quality,
      style: img.style
    }))

    const content = prompts.map(p => 
      `# ${p.id}\n**Model:** ${p.model}\n**Quality:** ${p.quality}\n**Style:** ${p.style}\n**Date:** ${new Date(p.timestamp).toLocaleDateString()}\n\n${p.prompt}\n\n---\n`
    ).join('\n')

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prompts-export-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)

    setProgress({ total: 1, completed: 1, failed: 0, errors: [] })
  }

  const handleCreateCollection = async () => {
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: operationInput,
          imageIds: Array.from(selectedImageIds)
        })
      })
      
      if (!response.ok) throw new Error('Collection creation failed')
      
      setProgress({ total: 1, completed: 1, failed: 0, errors: [] })
    } catch (error) {
      setProgress({ total: 1, completed: 0, failed: 1, errors: ['Failed to create collection'] })
    }
  }

  if (selectedImageIds.size === 0) {
    return (
      <Card className="bg-gray-900/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-400">
            <ImageIcon className="h-5 w-5" />
            Batch Operations
          </CardTitle>
          <CardDescription>
            Select images to perform batch operations
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ImageIcon className="h-5 w-5" />
          Batch Operations
          <Badge variant="secondary">{selectedImageIds.size} selected</Badge>
        </CardTitle>
        <CardDescription>
          Perform operations on {selectedImageIds.size} selected image{selectedImageIds.size > 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-300">Quick Selection</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAll}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {selectedImageIds.size === images.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSelectByFilter('recent')}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Recent (7 days)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSelectByFilter('high-quality')}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              High Quality
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSelectByFilter('generated')}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Generated
            </Button>
          </div>
        </div>

        {/* Operation Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-300">Operation</Label>
          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue placeholder="Choose an operation" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {batchOperations.map(operation => (
                <SelectItem key={operation.id} value={operation.id} className="text-white hover:bg-gray-700">
                  <div className="flex items-center gap-2">
                    {operation.icon}
                    <div>
                      <div className="font-medium">{operation.name}</div>
                      <div className="text-xs text-gray-400">{operation.description}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operation Input */}
        {selectedOperation && batchOperations.find(op => op.id === selectedOperation)?.requiresInput && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-300">Input</Label>
            {batchOperations.find(op => op.id === selectedOperation)?.inputType === 'select' ? (
              <Select value={operationInput} onValueChange={setOperationInput}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {batchOperations.find(op => op.id === selectedOperation)?.inputOptions?.map(option => (
                    <SelectItem key={option} value={option} className="text-white hover:bg-gray-700">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={operationInput}
                onChange={(e) => setOperationInput(e.target.value)}
                placeholder={batchOperations.find(op => op.id === selectedOperation)?.inputPlaceholder}
                className="bg-gray-800 border-gray-600 text-white"
              />
            )}
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Progress</span>
              <span className="text-gray-300">
                {progress.completed + progress.failed} / {progress.total}
              </span>
            </div>
            <Progress 
              value={(progress.completed + progress.failed) / progress.total * 100} 
              className="h-2"
            />
            {progress.errors.length > 0 && (
              <div className="text-xs text-red-400">
                {progress.errors.length} error{progress.errors.length > 1 ? 's' : ''} occurred
              </div>
            )}
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={executeOperation}
          disabled={!selectedOperation || isExecuting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              {batchOperations.find(op => op.id === selectedOperation)?.icon}
              <span className="ml-2">
                Execute {batchOperations.find(op => op.id === selectedOperation)?.name}
              </span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
