"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MCPServerConfig } from '@/lib/mcp/mcp-client'
import { Plus, Server, Globe, Terminal } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MCPAddServerFormProps {
  onAdd: (config: MCPServerConfig) => Promise<void>
}

export function MCPAddServerForm({ onAdd }: MCPAddServerFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    transportType: 'stdio' as 'stdio' | 'http',
    command: '',
    args: '',
    env: '',
    url: '',
    apiKey: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Parse args and env
      const args = formData.args
        .split('\n')
        .filter(Boolean)
        .map(arg => arg.trim())
        
      const envPairs = formData.env
        .split('\n')
        .filter(Boolean)
        .map(line => line.trim().split('='))
        .filter(pair => pair.length === 2)
        
      const env = envPairs.reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

      const config: MCPServerConfig = {
        id: `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: formData.name.trim(),
        transportType: formData.transportType,
      }
      
      if (formData.transportType === 'http') {
        config.url = formData.url.trim()
        if (formData.apiKey.trim()) {
          config.apiKey = formData.apiKey.trim()
        }
      } else {
        config.command = formData.command.trim()
        if (args.length > 0) config.args = args
        if (Object.keys(env).length > 0) config.env = env
      }

      await onAdd(config)
      
      // Reset form
      setFormData({
        name: '',
        transportType: 'stdio',
        command: '',
        args: '',
        env: '',
        url: '',
        apiKey: '',
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add MCP Server
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Add MCP Server
            </DialogTitle>
            <DialogDescription>
              Configure a new MCP server to add tools and capabilities to your AI assistant.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Server Name</Label>
              <Input
                id="name"
                placeholder="My MCP Server"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transport">Transport Type</Label>
              <Select
                value={formData.transportType}
                onValueChange={(value: 'stdio' | 'http') => setFormData({ ...formData, transportType: value })}
              >
                <SelectTrigger id="transport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>Standard I/O (Local)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="http">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>HTTP (Remote)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.transportType === 'stdio' 
                  ? 'For local MCP servers that communicate via standard I/O'
                  : 'For remote MCP servers like Smithery CLI that use HTTP'}
              </p>
            </div>

            {formData.transportType === 'http' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">Server URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://server.smithery.ai/cli"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The HTTP endpoint for the MCP server
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key (optional)</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    API key for authentication (if required)
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="command">Command</Label>
                  <Input
                    id="command"
                    placeholder="node server.js"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The command to start the MCP server
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="args">Arguments (optional)</Label>
                  <Textarea
                    id="args"
                    placeholder="--port&#10;3000&#10;--verbose"
                    value={formData.args}
                    onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    One argument per line
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="env">Environment Variables (optional)</Label>
                  <Textarea
                    id="env"
                    placeholder="NODE_ENV=production&#10;API_KEY=your-key"
                    value={formData.env}
                    onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    One KEY=VALUE pair per line
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Server'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}