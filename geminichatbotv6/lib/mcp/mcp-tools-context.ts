import { MCPServerManager } from './mcp-server-manager'
import { MCPTool } from './mcp-client'

export interface ToolContext {
  tools: Array<{
    serverId: string
    serverName: string
    toolName: string
    description?: string
    parameters?: any
  }>
  systemPrompt: string
}

export class MCPToolsContext {
  static async getAvailableTools(): Promise<ToolContext> {
    const serverManager = MCPServerManager.getInstance()
    
    // Load config first to ensure we have all servers
    console.log('[MCPToolsContext] Loading server configuration...')
    await serverManager.loadFromConfig()
    
    const servers = serverManager.getAllServers()
    console.log(`[MCPToolsContext] Found ${servers.length} servers`)
    
    const tools: ToolContext['tools'] = []
    
    // Connect to servers if needed and get tools
    for (const server of servers) {
      console.log(`[MCPToolsContext] Server ${server.config.name}: status=${server.status}, tools=${server.tools?.length || 0}`)
      
      // Auto-connect if disconnected
      if (server.status === 'disconnected' || server.status === 'error') {
        console.log(`[MCPToolsContext] Auto-connecting to ${server.config.name}...`)
        try {
          await serverManager.connectServer(server.config.id)
          console.log(`[MCPToolsContext] Successfully connected to ${server.config.name}`)
        } catch (error) {
          console.error(`[MCPToolsContext] Failed to connect to ${server.config.name}:`, error)
          continue
        }
      }
      
      if (server.status === 'connected') {
        // If tools aren't loaded, try to fetch them
        if (!server.tools) {
          console.log(`[MCPToolsContext] Tools not cached for ${server.config.name}, fetching...`)
          try {
            const freshTools = await serverManager.listTools(server.config.id)
            console.log(`[MCPToolsContext] Fetched ${freshTools.length} tools for ${server.config.name}`)
            server.tools = freshTools
          } catch (error) {
            console.error(`[MCPToolsContext] Failed to fetch tools for ${server.config.name}:`, error)
            continue
          }
        }
        
        if (server.tools && server.tools.length > 0) {
          for (const tool of server.tools) {
            tools.push({
              serverId: server.config.id,
              serverName: server.config.name,
              toolName: tool.name,
              description: tool.description,
              parameters: tool.inputSchema
            })
          }
        }
      }
    }
    
    console.log(`[MCPToolsContext] Total tools available: ${tools.length}`)
    
    
    // Generate system prompt for the AI
    const systemPrompt = this.generateSystemPrompt(tools)
    
    return { tools, systemPrompt }
  }
  
  private static generateSystemPrompt(tools: ToolContext['tools']): string {
    if (tools.length === 0) {
      console.log('[MCPToolsContext] No tools available for system prompt')
      return ''
    }
    
    console.log(`[MCPToolsContext] Generating system prompt for ${tools.length} tools`)
    
    let prompt = `You are an AI assistant with access to external tools via MCP (Model Context Protocol). You MUST use these tools when relevant to the user's request.

You also have VIDEO GENERATION capabilities using Replicate's Kling v1.6 models:

**Video Generation Models:**
- **Standard Model** (720p): Text-to-video or Image-to-video, 5-10 seconds
- **Pro Model** (1080p): Image-to-video only (requires image), higher quality

**How to Generate Videos:**
- Text prompts: "Generate a video of [description]"
- Image animation: Users can click the purple "Animate" button on images
- Duration options: 5s or 10s
- Aspect ratios: 16:9, 9:16, 1:1

When users request video generation:
1. For text-to-video: Use Standard model
2. For animating images: Can use either model (Pro requires image)
3. Be specific in prompts for better results
4. Videos appear in the Video tab when complete (2-8 minutes)

\n\n`
    prompt += `Available tools:\n\n`
    
    // Group tools by server
    const toolsByServer = new Map<string, typeof tools>()
    for (const tool of tools) {
      const serverTools = toolsByServer.get(tool.serverName) || []
      serverTools.push(tool)
      toolsByServer.set(tool.serverName, serverTools)
    }
    
    // Generate prompt with grouped tools
    for (const [serverName, serverTools] of toolsByServer) {
      prompt += `**Server: ${serverName}**\n`
      for (const tool of serverTools) {
        prompt += `  - ${tool.toolName}`
        if (tool.description) {
          prompt += `: ${tool.description}`
        }
        prompt += '\n'
        
        // Add parameter details if available
        if (tool.parameters && tool.parameters.properties) {
          const props = Object.entries(tool.parameters.properties)
          if (props.length > 0) {
            prompt += `    Parameters: ${props.map(([name, schema]: [string, any]) => 
              `${name}${schema.required ? ' (required)' : ' (optional)'}`
            ).join(', ')}\n`
          }
        }
      }
      prompt += '\n'
    }
    
    prompt += `**IMPORTANT WEB SEARCH PRIORITY**:\n`
    prompt += `When users ask for current information, news, real-time data, or anything requiring web search:\n`
    prompt += `1. ALWAYS use the "web_search" tool from "Web Search" server FIRST\n`
    prompt += `2. DO NOT use Desktop Commander or other tools for web searches\n`
    prompt += `3. The web_search tool provides real-time, multi-source results with citations\n\n`
    
    prompt += `To use a tool, include a tool call in your response using this EXACT format:
[TOOL_CALL]
{
  "tool": "tool_name",
  "server": "server_name",
  "arguments": {
    "param": "value"
  }
}
[/TOOL_CALL]

CRITICAL FORMATTING RULES:
- NEVER use [TOOL_CODE] - this is WRONG and will cause errors
- ALWAYS use [TOOL_CALL] and [/TOOL_CALL] - this is the ONLY correct format
- ONLY use tools that are listed above in the available tools section
- DO NOT invent tools like "TodoWrite", "Todo", or other non-existent tools

IMPORTANT INSTRUCTIONS:
- You MUST use tools when they are relevant to the user's request
- Use the EXACT tool name and server name as shown above (case-sensitive)
- Include all required parameters in the arguments
- Explain what you're doing before calling a tool
- DO NOT simulate or fake tool execution results - the system will execute tools for you
- DO NOT include any content after [/TOOL_CALL] that looks like execution results
- Simply state that you're calling the tool and wait for real results
- If a tool fails, explain the error and suggest alternatives

Examples of when to use tools:
- If the user asks for calculations and a calculator tool is available, USE IT
- If the user mentions a library/package and context7 tools are available, USE THEM
- If the user asks for information that a tool can provide, USE THE TOOL

Remember: You have these tools available to help users. Use them actively!

CRITICAL ANALYSIS REQUIREMENT:
When you execute any tool:
1. The tool results will be displayed
2. You MUST ALWAYS provide a detailed analysis after seeing the results
3. Your analysis must include:
   - Summary of what was found
   - Key insights and important information
   - Direct answer to the user's question
   - Recommendations or next steps
4. NEVER just show tool results without analysis
5. If you don't automatically receive a prompt to analyze, you should still provide analysis

After executing a tool, you will receive a MANDATORY ANALYSIS SECTION prompt. When you see this:
- 🔍 **MANDATORY ANALYSIS SECTION** means you MUST provide analysis immediately
- Follow the numbered structure provided exactly
- Your analysis should be comprehensive and directly address the user's question
- Connect the tool results to what the user asked for

Example format after tool execution:
"Based on the [tool name] results, here's what I found:
[Summary of results]
[Key insights]
[Answer to user's question]
[Recommendations]"

This is MANDATORY for every tool execution. The user cannot understand raw tool outputs without your analysis.

For multiple tool calls: Analyze EACH tool's results separately and thoroughly.

Your response is INCOMPLETE and UNACCEPTABLE without proper analysis of every tool execution.`
    
    console.log('[MCPToolsContext] System prompt generated, length:', prompt.length)
    return prompt
  }
  
  static parseToolCall(content: string): {
    tool: string
    server: string
    arguments: any
  } | null {
    const toolCallRegex = /\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/
    const match = content.match(toolCallRegex)
    
    if (!match) {
      return null
    }
    
    try {
      const toolCallJson = match[1].trim()
      console.log('[MCPToolsContext] Parsing tool call:', toolCallJson)
      const toolCall = JSON.parse(toolCallJson)
      console.log('[MCPToolsContext] Parsed tool call:', toolCall)
      return toolCall
    } catch (error) {
      console.error('[MCPToolsContext] Failed to parse tool call:', error)
      console.error('[MCPToolsContext] Tool call content:', match[1])
      return null
    }
  }
  
  static async executeToolCall(toolCall: {
    tool: string
    server: string
    arguments: any
  }): Promise<string> {
    console.log(`[MCPToolsContext] Executing tool: ${toolCall.server}:${toolCall.tool}`);
    
    
    const serverManager = MCPServerManager.getInstance()
    
    try {
      // Find server by name instead of ID
      const servers = serverManager.getAllServers()
      const server = servers.find(s => s.config.name === toolCall.server)
      
      if (!server) {
        return `Error: Server '${toolCall.server}' not found or not connected`
      }
      
      const result = await serverManager.executeTool(
        server.config.id,
        toolCall.tool,
        toolCall.arguments
      )
      
      // Format the result for display
      let formattedResult = `Tool executed successfully.\n\n`
      
      // Special handling for sequential thinking results
      if (toolCall.tool === 'sequentialthinking' && typeof result === 'object' && !Array.isArray(result)) {
        const thinking = result as any
        formattedResult += `🧠 **Sequential Thinking Progress**\n\n`
        formattedResult += `**Thought ${thinking.thoughtNumber || 1} of ${thinking.totalThoughts || '?'}**\n\n`
        
        // Display the current thought if available
        if (thinking.thought) {
          formattedResult += `${thinking.thought}\n\n`
        }
        
        // Show progress if available
        if (thinking.progress && thinking.progress.length > 0) {
          formattedResult += `**Progress:**\n`
          thinking.progress.forEach((item: string, index: number) => {
            formattedResult += `${index + 1}. ${item}\n`
          })
          formattedResult += '\n'
        }
        
        // Show continuation status
        if (thinking.nextThoughtNeeded !== undefined) {
          formattedResult += thinking.nextThoughtNeeded 
            ? `🔄 More thinking needed... (${thinking.thoughtHistoryLength || 1} thoughts so far)\n` 
            : `✅ Thinking complete!\n`
        }
        
        // If there's any additional data, show it
        const additionalKeys = Object.keys(thinking).filter(key => 
          !['thoughtNumber', 'totalThoughts', 'thought', 'progress', 'nextThoughtNeeded', 'thoughtHistoryLength'].includes(key)
        )
        if (additionalKeys.length > 0) {
          formattedResult += `\n**Additional Information:**\n`
          additionalKeys.forEach(key => {
            formattedResult += `- ${key}: ${JSON.stringify(thinking[key], null, 2)}\n`
          })
        }
      } else if (Array.isArray(result)) {
        for (const item of result) {
          if (item.type === 'text') {
            formattedResult += item.text + '\n'
          } else {
            formattedResult += JSON.stringify(item, null, 2) + '\n'
          }
        }
      } else {
        formattedResult += JSON.stringify(result, null, 2)
      }
      
      return formattedResult
    } catch (error) {
      return `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}