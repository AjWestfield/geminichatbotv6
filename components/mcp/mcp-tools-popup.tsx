"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings2, Package, Plus, X, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMCPServers } from '@/hooks/mcp/use-mcp-servers'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SettingsDialog } from '@/components/settings-dialog'
import { useMCPState } from '@/hooks/use-mcp-state'

interface MCPToolsPopupProps {
  onToolToggle?: (serverId: string, toolName: string, enabled: boolean) => void
  onServerToggle?: (serverId: string, enabled: boolean) => void
}

export function MCPToolsPopup({ onToolToggle, onServerToggle }: MCPToolsPopupProps) {
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({})
  
  // Temporary image settings state (these would normally come from parent)
  const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('hd')
  const [imageStyle, setImageStyle] = useState<'vivid' | 'natural'>('vivid')
  const [imageSize, setImageSize] = useState<'1024x1024' | '1792x1024' | '1024x1536'>('1024x1024')
  
  // Only fetch MCP data when popup is actually open to prevent unnecessary updates
  const { servers, loading, connectServer, disconnectServer, getServerTools } = useMCPServers()
  const mcpState = useMCPState()

  // Don't initialize state here - initialization happens at app root
  // This component should only read state to prevent circular updates

  // Calculate total enabled tools count and connection status
  const { totalEnabledTools, isConnecting, potentialTools } = useMemo(() => {
    let count = 0
    let potential = 0
    let connecting = false
    
    servers.forEach(server => {
      const serverState = mcpState.servers[server.id]
      const isEnabled = serverState?.enabled ?? (server.status === 'connected')
      
      if (isEnabled) {
        if (server.status === 'connected') {
          // Count actual tools from connected servers
          const serverTools = getServerTools(server.id)
          serverTools.forEach(tool => {
            const isToolEnabled = serverState?.tools?.[tool.name] ?? true
            if (isToolEnabled) count++
          })
        } else if (server.status === 'connecting') {
          connecting = true
          // For connecting servers, estimate based on known servers or previous state
          const knownToolCount = serverState?.tools ? Object.keys(serverState.tools).length : 2
          potential += knownToolCount
        } else if (server.status === 'disconnected') {
          // For disconnected but enabled servers, use stored tool count
          const storedToolCount = serverState?.tools ? Object.keys(serverState.tools).length : 0
          potential += storedToolCount
        }
      }
    })
    
    return { 
      totalEnabledTools: count, 
      isConnecting: connecting,
      potentialTools: potential
    }
  }, [servers, mcpState.servers, getServerTools]) // Recalculate when servers or state changes

  const handleServerToggle = async (serverId: string) => {
    const server = servers.find(s => s.id === serverId)
    if (!server) return

    const currentState = mcpState.servers[serverId]
    const newEnabled = !currentState?.enabled

    // Update global state immediately
    mcpState.setServerEnabled(serverId, newEnabled)

    try {
      if (newEnabled && server.status === 'disconnected') {
        await connectServer(serverId)
      } else if (!newEnabled && server.status === 'connected') {
        await disconnectServer(serverId)
      }
      onServerToggle?.(serverId, newEnabled)
    } catch (error) {
      // Revert on error
      mcpState.setServerEnabled(serverId, !newEnabled)
      console.error('Failed to toggle server:', error)
    }
  }

  const handleToolToggle = (serverId: string, toolName: string) => {
    const currentEnabled = mcpState.servers[serverId]?.tools[toolName] ?? true
    const newEnabled = !currentEnabled
    
    mcpState.setToolEnabled(serverId, toolName, newEnabled)
    onToolToggle?.(serverId, toolName, newEnabled)
  }

  const toggleServerExpanded = (serverId: string) => {
    setExpandedServers(prev => ({ ...prev, [serverId]: !prev[serverId] }))
  }

  // Auto-connect enabled servers on component mount
  useEffect(() => {
    const connectEnabledServers = async () => {
      for (const server of servers) {
        const serverState = mcpState.servers[server.id]
        const isEnabled = serverState?.enabled ?? false
        
        // If server is enabled but not connected, connect it
        if (isEnabled && server.status === 'disconnected') {
          try {
            console.log(`[MCPToolsPopup] Auto-connecting enabled server: ${server.name}`)
            await connectServer(server.id)
          } catch (error) {
            console.error(`[MCPToolsPopup] Failed to auto-connect ${server.name}:`, error)
          }
        }
      }
    }
    
    // Only run when popup opens
    if (open && servers.length > 0) {
      connectEnabledServers()
    }
  }, [open, servers.length]) // Don't include servers array to avoid infinite loops

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "p-2 relative",
            "hover:bg-[#4A4A4A] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4A4A4A]",
            "text-[#B0B0B0] hover:text-white",
            open && "text-white bg-[#4A4A4A]"
          )}
          aria-label="MCP Tools"
        >
          <Settings2 className="w-4 h-4" />
          {(totalEnabledTools > 0 || potentialTools > 0) && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] flex items-center justify-center px-1.5 text-[11px] font-semibold bg-blue-500 text-white border-0"
            >
              {totalEnabledTools + potentialTools}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn(
          "w-96 p-0",
          "bg-[#3C3C3C] border-[#4A4A4A]",
          "shadow-xl"
        )}
        align="end"
        side="top"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#4A4A4A]">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#E0E0E0]" />
            <h3 className="text-base font-semibold text-white">MCP Tools</h3>
          </div>
          <Badge variant="secondary" className="text-sm bg-[#5A5A5A] text-white border-0 px-3 py-1">
            {totalEnabledTools + potentialTools} enabled{isConnecting && ' (connecting...)'}
          </Badge>
        </div>

        <ScrollArea className="h-[450px]">
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-[#E0E0E0]">Loading servers...</div>
              </div>
            ) : servers.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-[#9A9A9A]" />
                <p className="text-sm text-[#E0E0E0] mb-3">No MCP servers configured</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm bg-[#4A4A4A] hover:bg-[#5A5A5A] border-[#5A5A5A] text-white"
                  onClick={() => {
                    setOpen(false)
                    setShowSettings(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Server
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map(server => {
                  const serverState = mcpState.servers[server.id]
                  // Default to enabled if server is connected and state doesn't exist yet
                  const isEnabled = serverState?.enabled ?? (server.status === 'connected')
                  const isExpanded = expandedServers[server.id] || false
                  const serverTools = getServerTools(server.id)
                  const enabledToolsCount = isEnabled && server.status === 'connected'
                    ? serverTools.filter(tool => serverState?.tools?.[tool.name] ?? true).length 
                    : 0

                  return (
                    <div
                      key={server.id}
                      className={cn(
                        "rounded-lg border transition-all",
                        isEnabled 
                          ? "border-[#5A5A5A] bg-[#4A4A4A]" 
                          : "border-[#4A4A4A] bg-[#3C3C3C]"
                      )}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <button
                            className="flex items-center gap-2 text-left flex-1 min-w-0"
                            onClick={() => toggleServerExpanded(server.id)}
                          >
                            <ChevronRight 
                              className={cn(
                                "w-4 h-4 text-[#D0D0D0] transition-transform flex-shrink-0",
                                isExpanded && "rotate-90"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-sm font-medium truncate",
                                  isEnabled ? "text-white" : "text-[#D0D0D0]"
                                )}>
                                  {server.name}
                                </span>
                                {isEnabled && serverTools.length > 0 && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-[11px] px-2 h-5 bg-[#5A5A5A] text-white border-0"
                                  >
                                    {enabledToolsCount}/{serverTools.length}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => handleServerToggle(server.id)}
                            className={cn(
                              "p-1.5 rounded-md transition-colors flex-shrink-0",
                              "hover:bg-[#5A5A5A]",
                              server.status === 'connecting' && "opacity-50 cursor-wait"
                            )}
                            disabled={server.status === 'connecting'}
                          >
                            {isEnabled ? (
                              <ToggleRight className="w-6 h-6 text-blue-400" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-[#808080]" />
                            )}
                          </button>
                        </div>

                        {server.status === 'error' && server.lastError && (
                          <div className="mt-2 p-3 bg-red-500/20 rounded-md text-sm text-red-300">
                            {server.lastError}
                          </div>
                        )}
                      </div>

                      <AnimatePresence>
                        {isExpanded && serverTools.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {serverTools.map(tool => {
                                const isToolEnabled = serverState?.tools[tool.name] ?? true
                                
                                return (
                                  <div
                                    key={tool.name}
                                    className={cn(
                                      "flex items-center justify-between p-3 rounded-md",
                                      "hover:bg-[#5A5A5A] transition-colors",
                                      !isEnabled && "opacity-50"
                                    )}
                                  >
                                    <div className="flex-1 min-w-0 mr-2">
                                      <p className={cn(
                                        "text-sm font-medium",
                                        isEnabled && isToolEnabled ? "text-white" : "text-[#B0B0B0]"
                                      )}>
                                        {tool.name}
                                      </p>
                                      {tool.description && (
                                        <p className="text-xs text-[#9A9A9A] mt-1 leading-relaxed">
                                          {tool.description}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleToolToggle(server.id, tool.name)}
                                      disabled={!isEnabled}
                                      className={cn(
                                        "p-1 rounded-md transition-colors flex-shrink-0",
                                        isEnabled && "hover:bg-[#6A6A6A]",
                                        !isEnabled && "cursor-not-allowed"
                                      )}
                                    >
                                      {isToolEnabled ? (
                                        <ToggleRight className="w-5 h-5 text-blue-400" />
                                      ) : (
                                        <ToggleLeft className="w-5 h-5 text-[#808080]" />
                                      )}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-[#4A4A4A] bg-[#383838]">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-sm bg-[#4A4A4A] hover:bg-[#5A5A5A] border-[#5A5A5A]"
            onClick={() => {
              setOpen(false)
              setShowSettings(true)
            }}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Manage Servers
          </Button>
        </div>
      </PopoverContent>
    </Popover>
    
    <SettingsDialog
      open={showSettings}
      onOpenChange={setShowSettings}
      initialTab="mcp"
      imageQuality={imageQuality}
      onImageQualityChange={setImageQuality}
      imageStyle={imageStyle}
      onImageStyleChange={setImageStyle}
      imageSize={imageSize}
      onImageSizeChange={setImageSize}
    />
    </>
  )
}