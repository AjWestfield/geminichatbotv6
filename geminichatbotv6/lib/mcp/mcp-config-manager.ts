import { MCPServerConfig } from './mcp-client'
import fs from 'fs/promises'
import path from 'path'

export interface MCPConfig {
  servers: MCPServerConfig[]
  version: string
  lastModified: string
}

export class MCPConfigManager {
  private static configPath = path.join(process.cwd(), 'mcp.config.json')
  
  static async loadConfig(): Promise<MCPConfig | null> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8')
      const parsed = JSON.parse(data)
      
      // Handle both old and new format
      if (parsed.mcpServers) {
        // Convert mcpServers format to servers array
        const servers = Object.entries(parsed.mcpServers).map(([name, cfg]: [string, any]) => ({
          id: `${name}-${Date.now()}`,
          name,
          ...cfg
        }))
        return { servers, version: '1.0', lastModified: new Date().toISOString() }
      }
      
      return parsed
    } catch (error) {
      // File doesn't exist or is invalid
      return null
    }
  }
  
  static async saveConfig(servers: MCPServerConfig[]): Promise<void> {
    // Check current format by reading existing file
    let useServersFormat = true
    try {
      const existing = await fs.readFile(this.configPath, 'utf-8')
      const parsed = JSON.parse(existing)
      if (parsed.mcpServers) {
        useServersFormat = false
      }
    } catch {
      // Default to servers format if no file exists
    }
    
    if (useServersFormat) {
      // Save in servers array format
      const config: MCPConfig = {
        servers,
        version: '1.0',
        lastModified: new Date().toISOString()
      }
      
      await fs.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      )
    } else {
      // Convert servers array to mcpServers object format
      const mcpServers: Record<string, any> = {}
      
      for (const server of servers) {
        const { id, name, ...config } = server
        mcpServers[name] = config
      }
      
      // Save in the mcpServers format
      const configData = { mcpServers }
      
      await fs.writeFile(
        this.configPath,
        JSON.stringify(configData, null, 2),
        'utf-8'
      )
    }
  }
  
  static async addServer(server: MCPServerConfig): Promise<void> {
    const config = await this.loadConfig() || { servers: [], version: '1.0', lastModified: '' }
    
    // Check if server with same ID already exists
    const existingIndex = config.servers.findIndex(s => s.id === server.id)
    if (existingIndex >= 0) {
      // Update existing server
      config.servers[existingIndex] = server
    } else {
      // Add new server
      config.servers.push(server)
    }
    
    await this.saveConfig(config.servers)
  }
  
  static async removeServer(serverId: string): Promise<void> {
    const config = await this.loadConfig()
    if (!config) return
    
    config.servers = config.servers.filter(s => s.id !== serverId)
    await this.saveConfig(config.servers)
  }
  
  static async exportConfig(): Promise<string> {
    const config = await this.loadConfig()
    if (!config) {
      return JSON.stringify({ servers: [] }, null, 2)
    }
    return JSON.stringify(config, null, 2)
  }
  
  static async importConfig(jsonString: string): Promise<void> {
    const imported = JSON.parse(jsonString)
    
    // Handle both full config format and simple server array
    const servers = imported.servers || (Array.isArray(imported) ? imported : [imported])
    
    // Validate servers
    for (const server of servers) {
      if (!server.name) {
        throw new Error('Each server must have a name')
      }
      
      // Validate based on transport type
      if (server.url || server.transportType === 'http') {
        // HTTP transport - URL is required
        if (!server.url) {
          throw new Error('HTTP transport servers must have a URL')
        }
      } else {
        // Stdio transport - command is required
        if (!server.command) {
          throw new Error('Stdio transport servers must have a command')
        }
      }
      
      // Ensure each server has an ID
      if (!server.id) {
        server.id = `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }
    }
    
    await this.saveConfig(servers)
  }
}

// Client-side version for browser usage
export class MCPConfigManagerClient {
  private static storageKey = 'mcp-config'
  
  static loadConfig(): MCPConfig | null {
    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) return null
      return JSON.parse(data)
    } catch (error) {
      return null
    }
  }
  
  static saveConfig(servers: MCPServerConfig[]): void {
    const config: MCPConfig = {
      servers,
      version: '1.0',
      lastModified: new Date().toISOString()
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(config))
  }
  
  static addServer(server: MCPServerConfig): void {
    const config = this.loadConfig() || { servers: [], version: '1.0', lastModified: '' }
    
    const existingIndex = config.servers.findIndex(s => s.id === server.id)
    if (existingIndex >= 0) {
      config.servers[existingIndex] = server
    } else {
      config.servers.push(server)
    }
    
    this.saveConfig(config.servers)
  }
  
  static removeServer(serverId: string): void {
    const config = this.loadConfig()
    if (!config) return
    
    config.servers = config.servers.filter(s => s.id !== serverId)
    this.saveConfig(config.servers)
  }
  
  static exportConfig(): string {
    const config = this.loadConfig()
    if (!config) {
      return JSON.stringify({ servers: [] }, null, 2)
    }
    return JSON.stringify(config, null, 2)
  }
  
  static importConfig(jsonString: string): void {
    const imported = JSON.parse(jsonString)
    const servers = imported.servers || (Array.isArray(imported) ? imported : [imported])
    
    for (const server of servers) {
      if (!server.name) {
        throw new Error('Each server must have a name')
      }
      
      // Validate based on transport type
      if (server.url || server.transportType === 'http') {
        // HTTP transport - URL is required
        if (!server.url) {
          throw new Error('HTTP transport servers must have a URL')
        }
      } else {
        // Stdio transport - command is required
        if (!server.command) {
          throw new Error('Stdio transport servers must have a command')
        }
      }
      
      if (!server.id) {
        server.id = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID()
          : `server-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      }
    }
    
    this.saveConfig(servers)
  }
}