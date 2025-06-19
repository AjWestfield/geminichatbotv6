import Anthropic from '@anthropic-ai/sdk';

// Initialize Claude client
export function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  
  return new Anthropic({
    apiKey,
  });
}

// Format messages for Claude
export function formatMessagesForClaude(messages: any[]) {
  // Filter out system messages and convert to Claude format
  return messages
    .filter((m) => m.role !== 'system' && m.id !== 'welcome-message')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
}

// Convert MCP tools to Claude tool format
export function convertMCPToolsToClaudeTools(mcpTools: any[]) {
  return mcpTools.map(tool => ({
    name: `${tool.serverName}_${tool.toolName}`.replace(/[^a-zA-Z0-9_]/g, '_'),
    description: tool.description || `Tool ${tool.toolName} from ${tool.serverName}`,
    input_schema: tool.inputSchema || {
      type: 'object',
      properties: {},
      required: []
    }
  }));
}

// Parse Claude tool calls from response
export function parseClaudeToolCalls(content: string) {
  const toolCallRegex = /\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g;
  const toolCalls = [];
  let match;
  
  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const toolCall = JSON.parse(match[1].trim());
      toolCalls.push(toolCall);
    } catch (e) {
      console.error('Failed to parse tool call:', e);
    }
  }
  
  return toolCalls;
}

// Format tool results for Claude
export function formatToolResultsForClaude(results: any[]) {
  return results.map(result => {
    if (result.error) {
      return `Tool execution failed: ${result.error}`;
    }
    return `Tool executed successfully. Result: ${JSON.stringify(result.result)}`;
  }).join('\n\n');
}