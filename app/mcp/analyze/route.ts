import { NextRequest, NextResponse } from 'next/server'
import { MCPServerIntelligence } from '@/lib/mcp/mcp-server-intelligence'
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager'
import { MCPConfigManager } from '@/lib/mcp/mcp-config-manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input, type = 'json' } = body

    if (!input) {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400 }
      )
    }

    if (type === 'json') {
      // Analyze and correct JSON configuration
      const result = await MCPServerIntelligence.analyzeAndCorrectJSON(input)
      
      return NextResponse.json({
        success: result.isValid || !!result.correctedJSON,
        ...result
      })
    } else if (type === 'natural_language') {
      // Process natural language request
      const serverManager = MCPServerManager.getInstance()
      const result = await MCPServerIntelligence.processNaturalLanguageRequest(input, serverManager)
      
      // If it's an add request with a suggestion, add the server
      if (result.action === 'add' && result.suggestion && result.suggestion.confidence > 0.5) {
        const config = await MCPConfigManager.loadConfig() || { servers: [] as any[] }
        
        // Convert suggestion to proper format
        const serverConfig: any = {
          name: result.suggestion.name,
          transportType: result.suggestion.transportType
        }
        
        if (result.suggestion.transportType === 'stdio') {
          serverConfig.command = result.suggestion.command
          if (result.suggestion.args) serverConfig.args = result.suggestion.args
          if (result.suggestion.env) serverConfig.env = result.suggestion.env
        } else {
          serverConfig.url = result.suggestion.url
          if (result.suggestion.apiKey) serverConfig.apiKey = result.suggestion.apiKey
        }
        
        // Add to config
        if (!config.servers) config.servers = []
        
        // Check if server already exists
        const existingIndex = config.servers.findIndex((s: any) => s.name === serverConfig.name)
        if (existingIndex >= 0) {
          config.servers[existingIndex] = serverConfig
        } else {
          config.servers.push(serverConfig)
        }
        
        await MCPConfigManager.saveConfig(config.servers)
        
        return NextResponse.json({
          success: true,
          action: result.action,
          serverName: result.serverName,
          config: serverConfig,
          message: `Successfully added ${result.serverName} server`,
          confidence: result.suggestion.confidence
        })
      } else if (result.action === 'remove' && result.serverName) {
        const config = await MCPConfigManager.loadConfig() || { servers: [] as any[] }
        
        if (config.servers) {
          config.servers = config.servers.filter((s: any) => s.name !== result.serverName)
          await MCPConfigManager.saveConfig(config.servers)
          
          return NextResponse.json({
            success: true,
            action: result.action,
            serverName: result.serverName,
            message: `Successfully removed ${result.serverName} server`
          })
        }
      } else if (result.action === 'list') {
        const config = await MCPConfigManager.loadConfig() || { servers: [] as any[] }
        
        return NextResponse.json({
          success: true,
          action: result.action,
          servers: config.servers || [],
          message: result.message
        })
      }
      
      return NextResponse.json({
        success: false,
        ...result
      })
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be "json" or "natural_language"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('MCP analyze error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}