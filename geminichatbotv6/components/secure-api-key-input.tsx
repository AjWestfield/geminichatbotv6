'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, Key, ExternalLink } from 'lucide-react'

interface SecureApiKeyInputProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (apiKey: string) => void
  serverName: string
  serverInfo?: {
    description?: string
    docUrl?: string
    instructions?: string
    envVarName?: string
  }
}

export function SecureApiKeyInput({
  isOpen,
  onClose,
  onSubmit,
  serverName,
  serverInfo
}: SecureApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key')
      return
    }
    
    // Clear form and close
    setError('')
    onSubmit(apiKey)
    setApiKey('')
    setShowKey(false)
    onClose()
  }

  const handleCancel = () => {
    setApiKey('')
    setError('')
    setShowKey(false)
    onClose()
  }

  // Encrypt API key for display (simple masking, real encryption would be server-side)
  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '•'.repeat(key.length)
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Key Required for {serverName}
          </DialogTitle>
          <DialogDescription>
            {serverInfo?.description || `This MCP server requires an API key to function.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {serverInfo?.envVarName || 'API Key'}
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setError('')
                }}
                placeholder="Enter your API key..."
                className="pr-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {serverInfo?.instructions && (
            <Alert>
              <AlertDescription className="space-y-2">
                <p className="font-medium">How to get an API key:</p>
                <p className="text-sm">{serverInfo.instructions}</p>
                {serverInfo.docUrl && (
                  <a
                    href={serverInfo.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Get API Key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Your API key will be stored securely
            </p>
            <p>It will appear as: {maskApiKey(apiKey || 'your-api-key-here')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!apiKey.trim()}>
            Add API Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}