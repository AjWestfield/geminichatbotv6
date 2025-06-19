import { getClaudeClient } from '@/lib/claude-client';
import { handleClaudeStreaming } from '@/lib/claude-streaming-handler';
import { MCPToolsContext } from '@/lib/mcp/mcp-tools-context';
import { MCP_SYSTEM_PROMPT_ENHANCED, MCP_AGENT_INSTRUCTIONS_ENHANCED } from '@/lib/mcp/mcp-agent-instructions-enhanced';
import { VideoGenerationHandler } from '@/lib/video-generation-handler';

export async function handleClaudeRequest(
  messages: any[]
) {
  try {
    console.log('[Claude Handler] Processing request for Claude Sonnet 4');
    console.log('[Claude Handler] Messages count:', messages.length);
    
    // Get Claude client
    const claudeClient = getClaudeClient();
    
    // Get available MCP tools
    const toolsContext = await MCPToolsContext.getAvailableTools();
    console.log('[Claude Handler] Available tools:', toolsContext.tools.length);
    
    // Build system prompt - use only MCP_AGENT_INSTRUCTIONS_ENHANCED to avoid duplication
    const systemPrompt = MCP_AGENT_INSTRUCTIONS_ENHANCED;
    
    // Get the last message to check for video generation request
    const lastMessage = messages[messages.length - 1];
    
    // Check if this is a video generation request
    if (lastMessage && lastMessage.role === 'user') {
      const videoRequest = VideoGenerationHandler.detectVideoRequest(lastMessage.content);
      if (videoRequest) {
        console.log('[Claude Handler] Detected video generation request:', videoRequest);
        // Note: The actual video generation will be handled by the streaming handler
        // which will detect the VIDEO_GENERATION_TRIGGER in the response
      }
    }
    
    // Handle the streaming response
    console.log('[Claude Handler] Initiating streaming response with Claude Sonnet 4');
    return handleClaudeStreaming(
      claudeClient,
      messages,
      systemPrompt,
      toolsContext
    );
  } catch (error) {
    console.error('[Claude Handler] Error:', error);
    throw error;
  }
}