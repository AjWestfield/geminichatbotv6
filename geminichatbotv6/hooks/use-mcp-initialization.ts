import { useEffect, useRef } from 'react'
import { useMCPServers } from '@/hooks/mcp/use-mcp-servers'
import { useMCPState } from '@/hooks/use-mcp-state'

/**
 * Hook to initialize MCP server state from API data
 * This should only be used in one place to prevent circular updates
 */
export function useMCPInitialization() {
  const { servers, getServerTools, connectServer } = useMCPServers()
  const mcpState = useMCPState()
  const hasInitialized = useRef(false)
  const serverVersions = useRef<Record<string, string>>({})
  
  useEffect(() => {
    // Create a version string for current servers to detect changes
    const currentVersion = servers.map(s => `${s.id}:${s.status}:${s.tools?.length || 0}`).join(',')
    
    // Only run initialization if servers have actually changed
    if (serverVersions.current.servers === currentVersion) {
      return
    }
    
    serverVersions.current.servers = currentVersion
    
    // Initialize each server
    servers.forEach(server => {
      const tools = getServerTools(server.id)
      const toolNames = tools.map(t => t.name)
      
      // Initialize server (this is idempotent in the store)
      mcpState.initializeServer(server.id, server.name, toolNames)
      
      // Update connection status
      mcpState.setServerConnected(server.id, server.status === 'connected')
      
      // If server is connected, it should be enabled
      if (server.status === 'connected') {
        mcpState.setServerEnabled(server.id, true)
      }
    })
    
    hasInitialized.current = true
  }, [servers, getServerTools, mcpState.initializeServer, mcpState.setServerConnected, mcpState.setServerEnabled]) // Include all used methods
  
  // Auto-connect enabled servers on startup
  useEffect(() => {
    const connectEnabledServers = async () => {
      // Wait a bit for state to settle
      await new Promise(resolve => setTimeout(resolve, 500))
      
      for (const server of servers) {
        const serverState = mcpState.servers[server.id]
        const isEnabled = serverState?.enabled ?? false
        
        // If server is enabled but not connected, connect it
        if (isEnabled && server.status === 'disconnected') {
          try {
            console.log(`[MCPInitialization] Auto-connecting enabled server: ${server.name}`)
            await connectServer(server.id)
          } catch (error) {
            console.error(`[MCPInitialization] Failed to auto-connect ${server.name}:`, error)
          }
        }
      }
    }
    
    // Run once when servers are loaded and initialized
    if (hasInitialized.current && servers.length > 0) {
      connectEnabledServers()
    }
  }, [hasInitialized.current, servers.length]) // Minimal deps to run once
  
  return hasInitialized.current
}