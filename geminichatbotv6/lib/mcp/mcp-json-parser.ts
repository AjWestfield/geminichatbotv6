import { MCPServerConfig } from './mcp-client'

/**
 * Intelligent MCP JSON configuration parser that handles multiple formats
 */
export class MCPJSONParser {
  /**
   * Parse MCP configuration from various formats
   * Supports:
   * - Claude Desktop format: { "mcpServers": { "name": {...} } }
   * - Array format: [{ "name": "...", "command": "..." }, ...]
   * - Single server: { "name": "...", "command": "..." }
   * - Wrapped format: { "servers": [...] }
   * - NPX shorthand: { "name": "package-name" } (auto-expands to npx command)
   */
  static parse(input: string | object): MCPServerConfig[] {
    const data = typeof input === 'string' ? JSON.parse(input) : input
    const servers: MCPServerConfig[] = []
    
    // Handle Claude Desktop format: { "mcpServers": { "serverName": {...} } }
    if (data.mcpServers && typeof data.mcpServers === 'object') {
      for (const [name, config] of Object.entries(data.mcpServers)) {
        servers.push(this.normalizeServer(name, config as any))
      }
      return servers
    }
    
    // Handle Smithery CLI format: { "@smithery/cli": { "serverName": { "--key": "..." } } }
    if (data['@smithery/cli'] && typeof data['@smithery/cli'] === 'object') {
      for (const [serverName, config] of Object.entries(data['@smithery/cli'])) {
        const smitheryConfig = {
          command: 'npx',
          args: ['-y', '@smithery/cli@latest', 'run', serverName],
        };
        
        // Add any additional arguments from the config
        if (typeof config === 'object' && config !== null) {
          for (const [key, value] of Object.entries(config as any)) {
            smitheryConfig.args.push(key, String(value));
          }
        }
        
        servers.push(this.normalizeServer(serverName, smitheryConfig));
      }
      return servers;
    }
    
    // Handle VSCode/Cursor format: { "mcp-servers": [...] }
    if (data['mcp-servers']) {
      const mcpServers = data['mcp-servers']
      if (Array.isArray(mcpServers)) {
        return mcpServers.map((server, index) => 
          this.normalizeServer(server.name || `Server ${index + 1}`, server)
        )
      }
    }
    
    // Handle wrapped format: { "servers": [...] }
    if (data.servers && Array.isArray(data.servers)) {
      return data.servers.map((server: any, index: number) => 
        this.normalizeServer(server.name || `Server ${index + 1}`, server)
      )
    }
    
    // Handle array format: [{ "name": "...", "command": "..." }, ...]
    if (Array.isArray(data)) {
      return data.map((server, index) => 
        this.normalizeServer(server.name || `Server ${index + 1}`, server)
      )
    }
    
    // Handle single server object
    if (data.command || data.name) {
      return [this.normalizeServer(data.name || 'Unnamed Server', data)]
    }
    
    // Handle package.json style: { "mcp": { "servers": {...} } }
    if (data.mcp && data.mcp.servers) {
      if (Array.isArray(data.mcp.servers)) {
        return data.mcp.servers.map((server: any, index: number) => 
          this.normalizeServer(server.name || `Server ${index + 1}`, server)
        )
      } else if (typeof data.mcp.servers === 'object') {
        const servers: MCPServerConfig[] = []
        for (const [name, config] of Object.entries(data.mcp.servers)) {
          servers.push(this.normalizeServer(name, config as any))
        }
        return servers
      }
    }
    
    throw new Error('Unrecognized MCP configuration format. Please check the documentation for supported formats.')
  }
  
  /**
   * Normalize a server configuration into standard format
   */
  private static normalizeServer(name: string, config: any): MCPServerConfig {
    // If config is a string, assume it's an NPX package name
    if (typeof config === 'string') {
      return {
        id: this.generateId(name),
        name,
        command: 'npx',
        args: ['-y', config],
      }
    }
    
    // Extract command and args
    let command = config.command
    let args = config.args || config.arguments || []
    
    // Handle NPX shortcuts
    if (!command && config.package) {
      command = 'npx'
      args = ['-y', config.package, ...(args || [])]
    }
    
    // Handle common patterns
    if (!command && config.npm) {
      command = 'npm'
      args = ['run', config.npm]
    }
    
    if (!command && config.node) {
      command = 'node'
      args = [config.node, ...(args || [])]
    }
    
    if (!command && config.python) {
      command = 'python'
      args = [config.python, ...(args || [])]
    }
    
    // Auto-detect NPX commands from name
    if (!command && name.includes('@')) {
      command = 'npx'
      args = ['-y', name]
    }
    
    // Check if this is an HTTP server
    if (config.url || config.transportType === 'http') {
      return {
        id: config.id || this.generateId(name),
        name: name.trim(),
        url: config.url?.trim(),
        apiKey: config.apiKey?.trim(),
        transportType: 'http' as const,
      }
    }
    
    // Validate required fields for stdio servers
    if (!command) {
      throw new Error(`Server "${name}" is missing a command or URL. Please specify 'command' field for stdio servers or 'url' field for HTTP servers.`)
    }
    
    // Normalize environment variables
    let env = config.env || config.environment || {}
    
    // Handle common env patterns
    if (config.GITHUB_TOKEN) {
      env.GITHUB_PERSONAL_ACCESS_TOKEN = config.GITHUB_TOKEN
    }
    if (config.OPENAI_API_KEY) {
      env.OPENAI_API_KEY = config.OPENAI_API_KEY
    }
    
    return {
      id: config.id || this.generateId(name),
      name: name.trim(),
      command: command.trim(),
      args: Array.isArray(args) ? args : (args ? [args] : undefined),
      env: Object.keys(env).length > 0 ? env : undefined,
    }
  }
  
  /**
   * Generate a stable ID from server name
   */
  private static generateId(name: string): string {
    // Create a URL-safe ID from the name
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    // Add a short random suffix to ensure uniqueness
    const suffix = Math.random().toString(36).substring(2, 6)
    return `${baseId}-${suffix}`
  }
  
  /**
   * Detect configuration format and provide helpful hints
   */
  static detectFormat(input: string): {
    format: string
    confidence: number
    hint?: string
  } {
    try {
      const data = JSON.parse(input)
      
      if (data.mcpServers) {
        return {
          format: 'Claude Desktop',
          confidence: 1.0,
          hint: 'Standard Claude Desktop MCP configuration format'
        }
      }
      
      if (data['@smithery/cli']) {
        return {
          format: 'Smithery CLI',
          confidence: 1.0,
          hint: 'Smithery CLI configuration format'
        }
      }
      
      if (data['mcp-servers']) {
        return {
          format: 'VSCode/Cursor',
          confidence: 1.0,
          hint: 'VSCode or Cursor MCP configuration format'
        }
      }
      
      if (data.servers && Array.isArray(data.servers)) {
        return {
          format: 'Server Array',
          confidence: 0.9,
          hint: 'Array of server configurations'
        }
      }
      
      if (Array.isArray(data)) {
        return {
          format: 'Direct Array',
          confidence: 0.9,
          hint: 'Direct array of server objects'
        }
      }
      
      if (data.command || data.name) {
        return {
          format: 'Single Server',
          confidence: 0.8,
          hint: 'Single server configuration'
        }
      }
      
      if (data.mcp) {
        return {
          format: 'Package.json Style',
          confidence: 0.8,
          hint: 'Package.json style MCP configuration'
        }
      }
      
      return {
        format: 'Unknown',
        confidence: 0.0,
        hint: 'Unrecognized format - may need manual adjustment'
      }
    } catch (error) {
      return {
        format: 'Invalid JSON',
        confidence: 0.0,
        hint: 'Invalid JSON syntax'
      }
    }
  }
  
  /**
   * Get example configurations for user guidance
   */
  static getExamples(): Record<string, string> {
    return {
      'Claude Desktop': JSON.stringify({
        "mcpServers": {
          "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
          }
        }
      }, null, 2),
      
      'Simple Array': JSON.stringify([
        {
          "name": "Calculator",
          "command": "node",
          "args": ["calculator.js"]
        },
        {
          "name": "File System",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
        }
      ], null, 2),
      
      'NPX Shorthand': JSON.stringify({
        "name": "GitHub",
        "package": "@modelcontextprotocol/server-github",
        "env": {
          "GITHUB_TOKEN": "your-token"
        }
      }, null, 2),
      
      'Multiple Formats': JSON.stringify({
        "servers": [
          {
            "name": "Calculator",
            "node": "calculator.js"
          },
          {
            "name": "Python Script",
            "python": "server.py",
            "args": ["--port", "3000"]
          }
        ]
      }, null, 2),
      
      'HTTP Server (Context7)': JSON.stringify({
        "mcpServers": {
          "context7": {
            "url": "https://mcp.context7.com/mcp",
            "transportType": "http"
          }
        }
      }, null, 2)
    }
  }
}