import { MCPServerManager } from './mcp-server-manager'
import { MCPJSONParser } from './mcp-json-parser'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

interface MCPServerSuggestion {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  apiKey?: string
  transportType?: 'stdio' | 'http'
  description?: string
  confidence: number
}

export class MCPServerIntelligence {
  private static knownServers: Record<string, Partial<MCPServerSuggestion>> = {
    'filesystem': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      description: 'File system operations (read, write, search)',
      transportType: 'stdio'
    },
    'git': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
      description: 'Git repository operations',
      transportType: 'stdio'
    },
    'github': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      description: 'GitHub API operations',
      transportType: 'stdio',
      env: { GITHUB_TOKEN: 'required' }
    },
    'postgres': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
      description: 'PostgreSQL database operations',
      transportType: 'stdio'
    },
    'sqlite': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', 'path/to/database.db'],
      description: 'SQLite database operations',
      transportType: 'stdio'
    },
    'slack': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      description: 'Slack workspace operations',
      transportType: 'stdio',
      env: { SLACK_TOKEN: 'required' }
    },
    'memory': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      description: 'Knowledge graph memory system',
      transportType: 'stdio'
    },
    'puppeteer': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      description: 'Browser automation',
      transportType: 'stdio'
    },
    'everything': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
      description: 'Everything search integration',
      transportType: 'stdio'
    },
    'aws-kb': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws-kb'],
      description: 'AWS knowledge base access',
      transportType: 'stdio'
    },
    'context7': {
      url: 'https://context7.ai/api/mcp/v1',
      apiKey: 'required',
      transportType: 'http',
      description: 'Web search and research'
    },
    'exa': {
      command: 'npx',
      args: ['-y', 'exa-mcp-server'],
      description: 'Exa search API',
      transportType: 'stdio',
      env: { EXA_API_KEY: 'required' }
    },
    'smithery': {
      url: 'https://smithery.ai/api/mcp',
      apiKey: 'required',
      transportType: 'http',
      description: 'Smithery AI platform'
    },
    'sequential-thinking': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
      description: 'Sequential thinking and reasoning (plan, execute, reflect)',
      transportType: 'stdio'
    },
    'sequentialthinking': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
      description: 'Sequential thinking and reasoning (plan, execute, reflect)',
      transportType: 'stdio'
    },
    'desktop-commander': {
      command: 'npx',
      args: ['-y', '@wonderwhy-er/desktop-commander@latest'],
      description: 'AI-powered system control (terminal, file operations, process management)',
      transportType: 'stdio'
    },
    'desktopcommander': {
      command: 'npx',
      args: ['-y', '@wonderwhy-er/desktop-commander@latest'],
      description: 'AI-powered system control (terminal, file operations, process management)',
      transportType: 'stdio'
    }
  }

  /**
   * Analyze and correct MCP server JSON configuration
   */
  static async analyzeAndCorrectJSON(jsonInput: string): Promise<{
    isValid: boolean
    correctedJSON?: any
    errors?: string[]
    suggestions?: string[]
  }> {
    const errors: string[] = []
    const suggestions: string[] = []

    // First try to parse with our intelligent parser
    let parsed: { success: boolean; config?: any; error?: string } = { success: false }
    try {
      const parsedConfig = MCPJSONParser.parse(jsonInput)
      parsed = { success: true, config: parsedConfig }
    } catch (parseError) {
      parsed = { 
        success: false, 
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }
    }
    
    if (!parsed.success) {
      errors.push(`JSON parsing failed: ${parsed.error || 'Invalid JSON format'}`)
      
      // Try to extract server name and intent
      const serverNameMatch = jsonInput.match(/"?name"?\s*:\s*"([^"]+)"/i) ||
                             jsonInput.match(/["']?([a-zA-Z0-9-_]+)["']?\s*:/i) ||
                             jsonInput.match(/"([a-zA-Z0-9-_]+)":\s*{/i)
      
      if (serverNameMatch) {
        const serverName = serverNameMatch[1].toLowerCase().replace(/-/g, '')
        const knownServer = this.knownServers[serverName] || this.knownServers[serverName.replace('thinking', '-thinking')]
        
        if (knownServer) {
          suggestions.push(`Detected "${serverName}" server. Here's the correct configuration:`)
          
          const correctedConfig: any = {
            name: serverNameMatch[1], // Use original name with hyphens
            ...knownServer
          }
          
          // Remove undefined values
          Object.keys(correctedConfig).forEach(key => {
            if (correctedConfig[key] === undefined) {
              delete correctedConfig[key]
            }
          })
          
          return {
            isValid: false,
            correctedJSON: correctedConfig,
            errors,
            suggestions
          }
        }
      }
      
      // Check for common incomplete patterns
      if (jsonInput.includes('"mcpServers"') || jsonInput.includes('"command"')) {
        // Try to extract what we can from the incomplete JSON
        const nameMatch = jsonInput.match(/"([^"]+)":\s*{/) || 
                         jsonInput.match(/"name":\s*"([^"]+)"/) ||
                         jsonInput.match(/"mcpServers":\s*{\s*"([^"]+)"/i)
        
        if (nameMatch) {
          const originalName = nameMatch[1]
          const serverName = originalName.toLowerCase().replace(/-/g, '')
          const knownServer = this.knownServers[serverName] || 
                             this.knownServers[serverName.replace('thinking', '-thinking')]
          
          if (knownServer) {
            suggestions.push(`Detected incomplete configuration for "${originalName}". Auto-completing...`)
            return {
              isValid: false,
              correctedJSON: {
                name: originalName,
                ...knownServer
              },
              errors,
              suggestions
            }
          }
        }
        
        // Also check for partial args array
        if (jsonInput.includes('"args"') && jsonInput.includes('"npx"')) {
          const serverNameFromContext = jsonInput.match(/"([^"]+)":\s*{\s*"command"/)?.[1] ||
                                       jsonInput.match(/"mcpServers":\s*{\s*"([^"]+)"/)?.[1]
          
          if (serverNameFromContext) {
            const serverName = serverNameFromContext.toLowerCase().replace(/-/g, '')
            const knownServer = this.knownServers[serverName] || 
                               this.knownServers[serverName.replace('thinking', '-thinking')]
            
            if (knownServer) {
              suggestions.push(`Detected NPX command for "${serverNameFromContext}". Auto-completing...`)
              return {
                isValid: false,
                correctedJSON: {
                  name: serverNameFromContext,
                  ...knownServer
                },
                errors,
                suggestions
              }
            }
          }
        }
      }
      
      // Try AI-powered correction
      try {
        const aiCorrected = await this.aiCorrectJSON(jsonInput)
        if (aiCorrected) {
          return {
            isValid: false,
            correctedJSON: aiCorrected,
            errors,
            suggestions: ['AI-corrected configuration based on your input']
          }
        }
      } catch (e) {
        console.error('AI correction failed:', e)
      }
    } else {
      // Validate the parsed configuration
      const validation = this.validateMCPConfig(parsed.config)
      
      if (!validation.isValid) {
        return {
          isValid: false,
          errors: validation.errors,
          suggestions: validation.suggestions,
          correctedJSON: validation.corrected
        }
      }
      
      return {
        isValid: true,
        correctedJSON: parsed.config
      }
    }
    
    return {
      isValid: false,
      errors,
      suggestions
    }
  }

  /**
   * Validate MCP configuration and provide corrections
   */
  private static validateMCPConfig(config: any): {
    isValid: boolean
    errors?: string[]
    suggestions?: string[]
    corrected?: any
  } {
    const errors: string[] = []
    const suggestions: string[] = []
    let corrected = { ...config }

    // Check if it's an array (multiple servers)
    if (Array.isArray(config)) {
      corrected = config.map((server, index) => {
        const result = this.validateSingleServer(server)
        if (result.errors) {
          errors.push(`Server ${index + 1}: ${result.errors.join(', ')}`)
        }
        return result.corrected || server
      })
      
      return {
        isValid: errors.length === 0,
        errors,
        suggestions,
        corrected
      }
    }

    // Check if it's a single server or mcpServers format
    if (config.mcpServers) {
      const correctedServers: any = {}
      
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const result = this.validateSingleServer({ name, ...serverConfig as any })
        if (result.errors) {
          errors.push(`${name}: ${result.errors.join(', ')}`)
        }
        if (result.suggestions) {
          suggestions.push(...result.suggestions)
        }
        correctedServers[name] = result.corrected || serverConfig
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        suggestions,
        corrected: { mcpServers: correctedServers }
      }
    }

    // Single server validation
    const result = this.validateSingleServer(config)
    return {
      isValid: !result.errors || result.errors.length === 0,
      errors: result.errors,
      suggestions: result.suggestions,
      corrected: result.corrected
    }
  }

  /**
   * Validate a single MCP server configuration
   */
  private static validateSingleServer(server: any): {
    errors?: string[]
    suggestions?: string[]
    corrected?: any
  } {
    const errors: string[] = []
    const suggestions: string[] = []
    const corrected = { ...server }

    // Check for required fields
    if (!server.name) {
      errors.push('Missing server name')
    }

    // Determine transport type
    const isHttp = server.url || server.transportType === 'http'
    const isStdio = server.command || server.transportType === 'stdio' || (!isHttp && !server.transportType)

    if (isHttp) {
      corrected.transportType = 'http'
      
      if (!server.url) {
        errors.push('HTTP transport requires a URL')
      } else if (!server.url.startsWith('http://') && !server.url.startsWith('https://')) {
        errors.push('URL must start with http:// or https://')
        corrected.url = `https://${server.url}`
        suggestions.push('Added https:// prefix to URL')
      }
      
      // Check for known HTTP servers that require API keys
      const serverName = (server.name || '').toLowerCase()
      if ((serverName.includes('context7') || serverName.includes('smithery')) && !server.apiKey) {
        suggestions.push(`${serverName} typically requires an API key`)
      }
    } else if (isStdio) {
      corrected.transportType = 'stdio'
      
      if (!server.command) {
        // Check if it's a known NPX package
        const serverName = (server.name || '').toLowerCase()
        const knownServer = this.knownServers[serverName]
        
        if (knownServer && knownServer.command) {
          corrected.command = knownServer.command
          corrected.args = knownServer.args
          suggestions.push(`Added default command for ${serverName} server`)
        } else if (server.name && server.name.startsWith('@')) {
          // Looks like an npm package
          corrected.command = 'npx'
          corrected.args = ['-y', server.name]
          suggestions.push('Converted package name to npx command')
        } else {
          errors.push('stdio transport requires a command')
        }
      }
    } else {
      errors.push('Unable to determine transport type (stdio or http)')
    }

    // Clean up fields based on transport type
    if (corrected.transportType === 'http') {
      delete corrected.command
      delete corrected.args
    } else if (corrected.transportType === 'stdio') {
      delete corrected.url
      delete corrected.apiKey
    }

    return {
      errors: errors.length > 0 ? errors : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      corrected
    }
  }

  /**
   * Use AI to correct malformed JSON
   */
  private static async aiCorrectJSON(input: string): Promise<any | null> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp', {
          apiKey: process.env.GEMINI_API_KEY
        }),
        messages: [{
          role: 'user',
          content: `You are an MCP (Model Context Protocol) server configuration expert. 
          
The user provided this malformed or incomplete MCP server configuration:
${input}

Please correct it and return ONLY valid JSON for an MCP server configuration. Common formats include:

1. Single server: {"name": "...", "command": "...", "args": [...]}
2. HTTP server: {"name": "...", "url": "...", "apiKey": "...", "transportType": "http"}
3. Multiple servers: [{"name": "..."}, {"name": "..."}]
4. Claude Desktop format: {"mcpServers": {"name1": {...}, "name2": {...}}}

Known MCP servers include: filesystem, git, github, postgres, sqlite, slack, memory, puppeteer, everything, aws-kb, context7, exa, smithery, sequential-thinking.

IMPORTANT: If the JSON is incomplete (missing closing brackets, etc.), try to understand the intent and complete it.
For example, if you see "sequential-thinking": { "command": "npx", "args": [ "-y",
Complete it as a proper MCP server configuration.

Common NPX patterns:
- filesystem: npx -y @modelcontextprotocol/server-filesystem
- sequential-thinking: npx -y @modelcontextprotocol/server-sequential-thinking
- github: npx -y @modelcontextprotocol/server-github (needs GITHUB_TOKEN env var)

Return ONLY the corrected JSON, no explanation.`
        }],
        maxTokens: 500,
        temperature: 0.1
      })

      try {
        return JSON.parse(text.trim())
      } catch (e) {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0]
        if (jsonMatch) {
          return JSON.parse(jsonMatch)
        }
        return null
      }
    } catch (error) {
      console.error('AI JSON correction failed:', error)
      return null
    }
  }

  /**
   * Search for MCP server configuration using context7 or other tools
   */
  static async searchForMCPServer(
    serverName: string, 
    mcpManager: MCPServerManager
  ): Promise<MCPServerSuggestion | null> {
    try {
      // First check if it's a known server
      const knownServer = this.knownServers[serverName.toLowerCase()]
      if (knownServer) {
        return {
          name: serverName,
          ...knownServer,
          confidence: 1.0
        } as MCPServerSuggestion
      }

      // Try to use context7 or exa to search for the server
      const searchTools = ['web_search', 'search', 'exa_search']
      let searchResult = null

      for (const toolName of searchTools) {
        try {
          const connectedServers = mcpManager.getAllServers().filter(s => s.status === 'connected')
          let searchTool: { tool: any; serverId: string } | undefined
          
          for (const server of connectedServers) {
            if (server.tools) {
              const tool = server.tools.find(t => 
                t.name.toLowerCase().includes(toolName.toLowerCase()) ||
                toolName.toLowerCase().includes(t.name.toLowerCase())
              )
              if (tool) {
                searchTool = { tool, serverId: server.config.id }
                break
              }
            }
          }

          if (searchTool) {
            const result = await mcpManager.executeTool(
              searchTool.serverId,
              searchTool.tool.name,
              {
                query: `MCP server ${serverName} configuration JSON Model Context Protocol`,
                limit: 5
              }
            )

            if (result) {
              searchResult = result
              break
            }
          }
        } catch (e) {
          console.error(`Search with ${toolName} failed:`, e)
        }
      }

      if (searchResult) {
        // Use AI to extract configuration from search results
        const config = await this.extractConfigFromSearchResults(serverName, searchResult)
        if (config) {
          return config
        }
      }

      // If no results, try to infer from the name
      return this.inferServerConfig(serverName)
    } catch (error) {
      console.error('Error searching for MCP server:', error)
      return null
    }
  }

  /**
   * Extract MCP configuration from search results using AI
   */
  private static async extractConfigFromSearchResults(
    serverName: string,
    searchResults: any
  ): Promise<MCPServerSuggestion | null> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp', {
          apiKey: process.env.GEMINI_API_KEY
        }),
        messages: [{
          role: 'user',
          content: `Extract MCP server configuration for "${serverName}" from these search results:

${JSON.stringify(searchResults, null, 2)}

Return ONLY a JSON object with the following structure:
{
  "name": "server-name",
  "command": "command to run",
  "args": ["array", "of", "arguments"],
  "transportType": "stdio or http",
  "url": "for http servers",
  "apiKey": "if required",
  "env": {"ENV_VAR": "value"},
  "description": "what this server does",
  "confidence": 0.8
}

If you cannot find reliable configuration, return null.`
        }],
        maxTokens: 500,
        temperature: 0.1
      })

      try {
        const parsed = JSON.parse(text.trim())
        return parsed === null ? null : parsed as MCPServerSuggestion
      } catch (e) {
        return null
      }
    } catch (error) {
      console.error('Failed to extract config from search results:', error)
      return null
    }
  }

  /**
   * Infer server configuration from name
   */
  private static inferServerConfig(serverName: string): MCPServerSuggestion | null {
    const name = serverName.toLowerCase()

    // Check if it's an npm package name
    if (name.includes('@') || name.includes('/')) {
      return {
        name: serverName,
        command: 'npx',
        args: ['-y', serverName],
        transportType: 'stdio',
        description: `MCP server from package ${serverName}`,
        confidence: 0.6
      }
    }

    // Check for common patterns
    if (name.includes('github') || name.includes('git')) {
      return {
        name: serverName,
        command: 'npx',
        args: ['-y', `@modelcontextprotocol/server-${name}`],
        transportType: 'stdio',
        description: 'Git/GitHub operations',
        env: name.includes('github') ? { GITHUB_TOKEN: 'required' } : undefined,
        confidence: 0.5
      }
    }

    if (name.includes('database') || name.includes('db') || name.includes('sql')) {
      return {
        name: serverName,
        command: 'npx',
        args: ['-y', `@modelcontextprotocol/server-${name}`],
        transportType: 'stdio',
        description: 'Database operations',
        confidence: 0.4
      }
    }

    // Generic npm package guess
    return {
      name: serverName,
      command: 'npx',
      args: ['-y', `${serverName}-mcp-server`, '@modelcontextprotocol/server-' + serverName, serverName].filter(Boolean),
      transportType: 'stdio',
      description: `Inferred MCP server for ${serverName}`,
      confidence: 0.3
    }
  }

  /**
   * Analyze GitHub repository to extract MCP server configuration
   */
  static async analyzeGitHubRepository(
    githubUrl: string,
    mcpManager?: MCPServerManager
  ): Promise<MCPServerSuggestion | null> {
    try {
      // Extract owner, repo, and path from GitHub URL
      const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/[^\/]+)?(?:\/(.+))?/
      const match = githubUrl.match(urlPattern)
      
      if (!match) {
        console.error('Invalid GitHub URL format')
        return null
      }
      
      const [, owner, repo, path] = match
      const serverPath = path?.replace(/^src\//, '') || repo
      
      console.log('[GitHub Analysis] Analyzing:', { owner, repo, path, serverPath })
      
      // First, try to use MCP tools to fetch GitHub content
      if (mcpManager) {
        try {
          // Search for the repository information
          const connectedServers = mcpManager.getAllServers().filter(s => s.status === 'connected')
          let searchTool: { tool: any; serverId: string } | undefined
          
          for (const server of connectedServers) {
            if (server.tools) {
              const tool = server.tools.find(t => 
                t.name.toLowerCase().includes('web_search') || 
                t.name.toLowerCase().includes('search')
              )
              if (tool) {
                searchTool = { tool, serverId: server.config.id }
                break
              }
            }
          }
          
          if (searchTool) {
            const searchQuery = `"${owner}/${repo}" MCP server "${serverPath}" installation configuration npm install command Model Context Protocol`
            const searchResult = await mcpManager.executeTool(
              searchTool.serverId,
              searchTool.tool.name,
              { query: searchQuery, limit: 10 }
            )
            
            // Try to extract configuration from search results
            if (searchResult) {
              const config = await this.extractConfigFromGitHubSearch(
                serverPath,
                owner,
                repo,
                searchResult
              )
              if (config) return config
            }
          }
        } catch (e) {
          console.error('MCP tool search failed:', e)
        }
      }
      
      // Fetch README directly from GitHub API
      try {
        const readmeUrls = [
          `https://api.github.com/repos/${owner}/${repo}/contents/${path ? path + '/' : ''}README.md`,
          `https://api.github.com/repos/${owner}/${repo}/contents/README.md`,
          `https://api.github.com/repos/${owner}/${repo}/readme`
        ]
        
        let readmeContent = ''
        for (const url of readmeUrls) {
          try {
            const response = await fetch(url, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            })
            if (response.ok) {
              const data = await response.json()
              readmeContent = Buffer.from(data.content, 'base64').toString('utf-8')
              break
            }
          } catch (e) {
            continue
          }
        }
        
        // Also try to fetch package.json
        let packageJson: any = null
        try {
          const packageUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path ? path + '/' : ''}package.json`
          const response = await fetch(packageUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
          })
          if (response.ok) {
            const data = await response.json()
            packageJson = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'))
          }
        } catch (e) {
          console.log('No package.json found')
        }
        
        // Analyze README and package.json with AI
        return await this.extractConfigFromRepository(
          serverPath,
          owner,
          repo,
          readmeContent,
          packageJson
        )
      } catch (error) {
        console.error('Failed to fetch GitHub content:', error)
      }
      
      // Fallback: infer from repository structure
      const inferredName = path ? path.split('/').pop() : repo
      return {
        name: inferredName || 'unknown',
        command: 'npx',
        args: ['-y', `@${owner}/${inferredName}`],
        transportType: 'stdio',
        description: `MCP server from ${owner}/${repo}`,
        confidence: 0.3
      }
    } catch (error) {
      console.error('GitHub analysis failed:', error)
      return null
    }
  }

  /**
   * Extract configuration from GitHub search results
   */
  private static async extractConfigFromGitHubSearch(
    serverName: string,
    owner: string,
    repo: string,
    searchResults: any
  ): Promise<MCPServerSuggestion | null> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp', {
          apiKey: process.env.GEMINI_API_KEY
        }),
        messages: [{
          role: 'user',
          content: `Extract MCP server installation and configuration for "${serverName}" from ${owner}/${repo} based on these search results:

${JSON.stringify(searchResults, null, 2)}

Look for:
1. NPM install commands (npm install, npx commands)
2. Configuration examples
3. Usage instructions
4. Any mention of how to run or configure the server

Return ONLY a JSON object with:
{
  "name": "server-name",
  "command": "npx or node",
  "args": ["array", "of", "arguments"],
  "transportType": "stdio or http",
  "url": "for http servers",
  "env": {"ENV_VAR": "description"},
  "description": "what this server does",
  "confidence": 0.8
}

If you cannot find reliable configuration, return null.`
        }],
        maxTokens: 800,
        temperature: 0.1
      })

      try {
        const parsed = JSON.parse(text.trim())
        return parsed === null ? null : parsed as MCPServerSuggestion
      } catch (e) {
        return null
      }
    } catch (error) {
      console.error('Failed to extract config from GitHub search:', error)
      return null
    }
  }

  /**
   * Extract configuration from repository content
   */
  private static async extractConfigFromRepository(
    serverName: string,
    owner: string,
    repo: string,
    readmeContent: string,
    packageJson: any
  ): Promise<MCPServerSuggestion | null> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp', {
          apiKey: process.env.GEMINI_API_KEY
        }),
        messages: [{
          role: 'user',
          content: `Analyze this MCP server "${serverName}" from ${owner}/${repo} and extract installation/configuration:

README.md:
${readmeContent.substring(0, 8000)}

${packageJson ? `package.json:
${JSON.stringify(packageJson, null, 2).substring(0, 2000)}` : ''}

Extract:
1. How to install (npm install command, npx usage)
2. How to run the server
3. Required environment variables
4. Whether it uses stdio or http transport
5. Package name if it's published to npm

Common patterns:
- npx @modelcontextprotocol/server-xyz
- npx xyz-mcp-server
- npm install -g xyz && xyz
- node path/to/server.js

Return ONLY a JSON object:
{
  "name": "server-name",
  "command": "npx or node",
  "args": ["arguments"],
  "transportType": "stdio or http",
  "env": {"ENV_VAR": "description"},
  "description": "what it does",
  "confidence": 0.9
}

Return null if no clear configuration found.`
        }],
        maxTokens: 800,
        temperature: 0.1
      })

      try {
        const parsed = JSON.parse(text.trim())
        return parsed === null ? null : parsed as MCPServerSuggestion
      } catch (e) {
        // Try to extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)?.[0]
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch) as MCPServerSuggestion
          } catch (e) {
            return null
          }
        }
        return null
      }
    } catch (error) {
      console.error('Failed to extract config from repository:', error)
      return null
    }
  }

  /**
   * Process natural language request to add MCP server
   */
  static async processNaturalLanguageRequest(
    request: string,
    mcpManager: MCPServerManager
  ): Promise<{
    action: 'add' | 'remove' | 'list' | 'unknown'
    serverName?: string
    suggestion?: MCPServerSuggestion
    message: string
    githubUrl?: string
  }> {
    // First check for GitHub URLs
    const githubUrlPattern = /https?:\/\/github\.com\/[^\s]+/i
    const githubMatch = request.match(githubUrlPattern)
    
    if (githubMatch) {
      const githubUrl = githubMatch[0]
      console.log('[NLP] Detected GitHub URL:', githubUrl)
      
      // Analyze the GitHub repository
      const suggestion = await this.analyzeGitHubRepository(githubUrl, mcpManager)
      
      if (suggestion) {
        return {
          action: 'add',
          serverName: suggestion.name,
          suggestion,
          githubUrl,
          message: `Found MCP server "${suggestion.name}" from GitHub repository. Ready to install with ${(suggestion.confidence * 100).toFixed(0)}% confidence.`
        }
      } else {
        return {
          action: 'add',
          githubUrl,
          message: `I'll analyze this GitHub repository and search for configuration details.`
        }
      }
    }
    
    // Detect intent
    const addPatterns = /add|install|setup|configure|enable|activate/i
    const removePatterns = /remove|uninstall|delete|disable|deactivate/i
    const listPatterns = /list|show|display|what|which/i

    let action: 'add' | 'remove' | 'list' | 'unknown' = 'unknown'
    
    if (addPatterns.test(request)) {
      action = 'add'
    } else if (removePatterns.test(request)) {
      action = 'remove'
    } else if (listPatterns.test(request)) {
      action = 'list'
    }

    // Extract server name for add/remove actions
    if (action === 'add' || action === 'remove') {
      // Common patterns to extract server name
      const patterns = [
        /(?:add|install|setup|configure|enable|activate|remove|uninstall|delete|disable|deactivate)\s+(?:the\s+)?(?:mcp\s+)?(?:server\s+)?(?:for\s+)?["']?([a-zA-Z0-9@/-]+)["']?/i,
        /["']([a-zA-Z0-9@/-]+)["']\s+(?:mcp\s+)?server/i,
        /(?:mcp\s+)?server\s+(?:for\s+)?["']?([a-zA-Z0-9@/-]+)["']?/i
      ]

      let serverName: string | undefined
      for (const pattern of patterns) {
        const match = request.match(pattern)
        if (match) {
          serverName = match[1]
          break
        }
      }

      if (!serverName) {
        // Try AI extraction
        serverName = await this.aiExtractServerName(request)
      }

      if (serverName && action === 'add') {
        const suggestion = await this.searchForMCPServer(serverName, mcpManager)
        
        if (suggestion) {
          return {
            action,
            serverName,
            suggestion,
            message: `Found configuration for ${serverName} server`
          }
        } else {
          return {
            action,
            serverName,
            message: `Could not find configuration for ${serverName}. Please provide the configuration manually.`
          }
        }
      } else if (serverName && action === 'remove') {
        return {
          action,
          serverName,
          message: `Ready to remove ${serverName} server`
        }
      }
    }

    if (action === 'list') {
      return {
        action,
        message: 'Listing available MCP servers'
      }
    }

    return {
      action: 'unknown',
      message: 'Could not understand the MCP server request. Please be more specific.'
    }
  }

  /**
   * Use AI to extract server name from request
   */
  private static async aiExtractServerName(request: string): Promise<string | undefined> {
    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp', {
          apiKey: process.env.GEMINI_API_KEY
        }),
        messages: [{
          role: 'user',
          content: `Extract the MCP server name from this request: "${request}"

Common MCP server names include: filesystem, git, github, postgres, sqlite, slack, memory, puppeteer, everything, aws-kb, context7, exa, smithery, or npm package names like @modelcontextprotocol/server-xyz.

Return ONLY the server name, or "none" if no server name is found.`
        }],
        maxTokens: 50,
        temperature: 0
      })

      const extracted = text.trim().toLowerCase()
      return extracted === 'none' ? undefined : extracted
    } catch (error) {
      console.error('Failed to extract server name:', error)
      return undefined
    }
  }
}