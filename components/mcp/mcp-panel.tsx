"use client"

import { useState } from 'react'
import { useMCPServers } from '@/hooks/mcp/use-mcp-servers'
import { MCPServerList } from './mcp-server-list'
import { MCPAddServerForm } from './mcp-add-server-form'
import { MCPToolsPanel } from './mcp-tools-panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Server, Terminal, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MCPPanelProps {
  onToolResult?: (result: any) => void
}

export function MCPPanel({ onToolResult }: MCPPanelProps) {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const {
    servers,
    loading,
    error,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    refreshServers,
  } = useMCPServers()

  // Select first connected server by default
  const connectedServer = servers.find(s => s.status === 'connected')
  const activeServerId = selectedServerId || connectedServer?.id || null

  const handleToolResult = (result: any) => {
    // Format the result for display
    const formattedResult = {
      serverId: activeServerId,
      timestamp: new Date().toISOString(),
      result,
    }
    onToolResult?.(formattedResult)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="w-5 h-5" />
            MCP Servers
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshServers}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      <Tabs defaultValue="servers" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="servers" className="flex-1 rounded-none">
            <Server className="w-4 h-4 mr-2" />
            Servers
          </TabsTrigger>
          <TabsTrigger 
            value="tools" 
            className="flex-1 rounded-none"
            disabled={!activeServerId}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Tools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <MCPAddServerForm onAdd={addServer} />
              <Separator />
              <MCPServerList
                servers={servers}
                onConnect={connectServer}
                onDisconnect={disconnectServer}
                onRemove={removeServer}
                onSelectServer={setSelectedServerId}
                selectedServerId={activeServerId}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tools" className="flex-1 m-0">
          <MCPToolsPanel
            serverId={activeServerId}
            onToolResult={handleToolResult}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}