import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MCPServerState {
  id: string
  enabled: boolean
  connected: boolean
  tools: Record<string, boolean>
}

interface MCPStateStore {
  // Server states
  servers: Record<string, MCPServerState>
  
  // Global settings
  autoConnectByDefault: boolean
  
  // Actions
  setServerEnabled: (serverId: string, enabled: boolean) => void
  setServerConnected: (serverId: string, connected: boolean) => void
  setToolEnabled: (serverId: string, toolName: string, enabled: boolean) => void
  setAutoConnectByDefault: (enabled: boolean) => void
  initializeServer: (serverId: string, name: string, toolNames?: string[]) => void
  getEnabledToolsCount: () => number
}

export const useMCPState = create<MCPStateStore>()(
  persist(
    (set, get) => ({
      servers: {},
      autoConnectByDefault: true,
      
      setServerEnabled: (serverId, enabled) => set((state) => ({
        servers: {
          ...state.servers,
          [serverId]: {
            ...state.servers[serverId],
            enabled
          }
        }
      })),
      
      setServerConnected: (serverId, connected) => set((state) => ({
        servers: {
          ...state.servers,
          [serverId]: {
            ...state.servers[serverId],
            connected
          }
        }
      })),
      
      setToolEnabled: (serverId, toolName, enabled) => set((state) => ({
        servers: {
          ...state.servers,
          [serverId]: {
            ...state.servers[serverId],
            tools: {
              ...state.servers[serverId]?.tools,
              [toolName]: enabled
            }
          }
        }
      })),
      
      setAutoConnectByDefault: (enabled) => set({ autoConnectByDefault: enabled }),
      
      initializeServer: (serverId, name, toolNames = []) => set((state) => {
        const existingServer = state.servers[serverId]
        
        // Initialize tools state (all enabled by default)
        const tools: Record<string, boolean> = {}
        toolNames.forEach(toolName => {
          // Preserve existing tool state if available, otherwise default to true
          tools[toolName] = existingServer?.tools[toolName] ?? true
        })
        
        return {
          servers: {
            ...state.servers,
            [serverId]: {
              id: serverId,
              enabled: existingServer?.enabled ?? state.autoConnectByDefault,
              connected: existingServer?.connected ?? false,
              tools
            }
          }
        }
      }),
      
      getEnabledToolsCount: () => {
        const state = get()
        let count = 0
        
        Object.values(state.servers).forEach(server => {
          if (server.enabled && server.connected) {
            Object.values(server.tools).forEach(toolEnabled => {
              if (toolEnabled) count++
            })
          }
        })
        
        return count
      }
    }),
    {
      name: 'mcp-state',
      version: 1,
    }
  )
)