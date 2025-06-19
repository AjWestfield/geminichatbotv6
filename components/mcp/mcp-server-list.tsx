"use client"

import { useState } from 'react'
import { MCPServerInfo } from '@/hooks/mcp/use-mcp-servers'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Server, 
  Play, 
  Square, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface MCPServerListProps {
  servers: MCPServerInfo[]
  onConnect: (serverId: string) => Promise<void>
  onDisconnect: (serverId: string) => Promise<void>
  onRemove: (serverId: string) => Promise<void>
  onSelectServer: (serverId: string) => void
  selectedServerId?: string | null
}

export function MCPServerList({
  servers,
  onConnect,
  onDisconnect,
  onRemove,
  onSelectServer,
  selectedServerId,
}: MCPServerListProps) {
  const [serverToRemove, setServerToRemove] = useState<string | null>(null)
  const [loadingServer, setLoadingServer] = useState<string | null>(null)

  const handleConnect = async (serverId: string) => {
    try {
      setLoadingServer(serverId)
      await onConnect(serverId)
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setLoadingServer(null)
    }
  }

  const handleDisconnect = async (serverId: string) => {
    try {
      setLoadingServer(serverId)
      await onDisconnect(serverId)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setLoadingServer(null)
    }
  }

  const handleRemove = async () => {
    if (!serverToRemove) return
    
    try {
      await onRemove(serverToRemove)
    } catch (error) {
      console.error('Failed to remove server:', error)
    } finally {
      setServerToRemove(null)
    }
  }

  const getStatusBadge = (server: MCPServerInfo) => {
    switch (server.status) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        )
      case 'connecting':
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            Disconnected
          </Badge>
        )
    }
  }

  return (
    <>
      <div className="space-y-3">
        {servers.map((server) => (
          <Card
            key={server.id}
            className={`p-4 cursor-pointer transition-colors ${
              selectedServerId === server.id
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectServer(server.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">{server.name}</h3>
                  {getStatusBadge(server)}
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  {server.command}
                </p>
                {server.args && server.args.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Args: {server.args.join(' ')}
                  </p>
                )}
                {server.status === 'connected' && server.tools && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {server.tools.length} tools available
                  </p>
                )}
                {server.lastError && (
                  <p className="text-xs text-destructive mt-1">
                    {server.lastError}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {server.status === 'disconnected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnect(server.id)
                    }}
                    disabled={loadingServer === server.id}
                  >
                    {loadingServer === server.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                )}
                
                {server.status === 'connected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDisconnect(server.id)
                    }}
                    disabled={loadingServer === server.id}
                  >
                    {loadingServer === server.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setServerToRemove(server.id)
                  }}
                  disabled={server.status === 'connected'}
                  title={server.status === 'connected' ? 'Disconnect before removing' : 'Remove server'}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        
        {servers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No MCP servers configured</p>
            <p className="text-sm mt-1">Add a server to get started</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!serverToRemove} onOpenChange={() => setServerToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove MCP Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this server? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}