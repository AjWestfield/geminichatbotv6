import { NextRequest, NextResponse } from 'next/server'
import { MCPServerIntelligence } from '@/lib/mcp/mcp-server-intelligence'
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager'
import { MCPConfigManager } from '@/lib/mcp/mcp-config-manager'
import { MCPGitHubPrompts } from '@/lib/mcp/mcp-github-prompts'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { githubUrl, searchResults } = body

    if (!githubUrl) {
      return NextResponse.json(
        { error: 'GitHub URL is required' },
        { status: 400 }
      )
    }

    // First try direct GitHub analysis
    const serverManager = MCPServerManager.getInstance()
    let suggestion = await MCPServerIntelligence.analyzeGitHubRepository(githubUrl, serverManager)
    
    // If we have search results and no good suggestion yet, analyze them
    if (searchResults && (!suggestion || suggestion.confidence < 0.7)) {
      // Extract configuration from search results
      const searchSuggestion = await analyzeSearchResultsForConfig(githubUrl, searchResults)
      
      // Use search suggestion if it's better
      if (searchSuggestion && (!suggestion || searchSuggestion.confidence > suggestion.confidence)) {
        suggestion = searchSuggestion
      }
    }
    
    if (suggestion && suggestion.confidence > 0.5) {
      // Add the server configuration
      const config = await MCPConfigManager.loadConfig() || { servers: [] as any[] }
      
      const serverConfig: any = {
        name: suggestion.name,
        transportType: suggestion.transportType || 'stdio'
      }
      
      if (suggestion.transportType === 'stdio' || !suggestion.transportType) {
        serverConfig.command = suggestion.command
        if (suggestion.args) serverConfig.args = suggestion.args
        if (suggestion.env) serverConfig.env = suggestion.env
      } else {
        serverConfig.url = suggestion.url
        if (suggestion.apiKey) serverConfig.apiKey = suggestion.apiKey
      }
      
      if (!config.servers) config.servers = []
      
      const existingIndex = config.servers.findIndex((s: any) => s.name === serverConfig.name)
      if (existingIndex >= 0) {
        config.servers[existingIndex] = serverConfig
      } else {
        config.servers.push(serverConfig)
      }
      
      await MCPConfigManager.saveConfig(config.servers)
      
      return NextResponse.json({
        success: true,
        suggestion,
        serverConfig,
        message: `Successfully configured ${suggestion.name} MCP server`
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'Could not determine MCP server configuration from the repository',
      suggestion
    })
  } catch (error) {
    console.error('GitHub analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

/**
 * Analyze search results to extract MCP configuration
 */
async function analyzeSearchResultsForConfig(
  githubUrl: string,
  searchResults: any
): Promise<any> {
  try {
    // Use Gemini to analyze search results
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    const prompt = `${MCPGitHubPrompts.searchResultAnalysis}

GitHub URL: ${githubUrl}

Search Results:
${JSON.stringify(searchResults, null, 2).substring(0, 10000)}

${MCPGitHubPrompts.configurationBuilder}

Based on the search results, extract the MCP server configuration.

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

Return null if no configuration can be determined.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    try {
      // Try to parse the response as JSON
      const parsed = JSON.parse(text.trim())
      return parsed
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch (e) {
          return null
        }
      }
      return null
    }
  } catch (error) {
    console.error('Failed to analyze search results:', error)
    return null
  }
}