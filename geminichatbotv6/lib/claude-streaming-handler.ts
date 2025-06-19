import Anthropic from '@anthropic-ai/sdk';
import { MCPToolsContext } from '@/lib/mcp/mcp-tools-context';
import { parseClaudeToolCalls } from './claude-client';
import { VideoGenerationHandler } from '@/lib/video-generation-handler';

export async function handleClaudeStreaming(
  claudeClient: Anthropic,
  messages: any[],
  systemPrompt: string,
  toolsContext: { tools: any[], systemPrompt: string }
) {
  // Create a text encoder for streaming
  const encoder = new TextEncoder();
  
  // Get the last user message to check for video requests
  const lastMessage = messages[messages.length - 1];
  const videoRequest = lastMessage && lastMessage.role === 'user' 
    ? VideoGenerationHandler.detectVideoRequest(lastMessage.content)
    : null;
  
  // Create a readable stream for the response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Format messages for Claude
        const formattedMessages = messages
          .filter((m) => m.role !== 'system' && m.id !== 'welcome-message')
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          }));

        // Create the stream
        const modelId = 'claude-3-5-sonnet-20241022'; // This is Claude Sonnet 3.5, the latest available
        console.log(`[Claude Streaming] Creating stream with model: ${modelId}`);
        console.log('[Claude Streaming] Note: Claude Sonnet 4 maps to claude-3-5-sonnet-20241022 (latest available)');
        
        const stream = await claudeClient.messages.create({
          model: modelId,
          max_tokens: 8192,
          temperature: 0.7,
          system: systemPrompt + '\n\n' + toolsContext.systemPrompt,
          messages: formattedMessages as any,
          stream: true,
        });

        let fullContent = '';
        
        // Process the stream
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullContent += text;
            
            // Send text in AI SDK format: data: 0:<json-encoded-string>
            controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
          }
        }

        // Check for video generation trigger in the response
        if (videoRequest && videoRequest.type === 'text-to-video' && (fullContent.includes('[VIDEO_GENERATION_TRIGGER]') || fullContent.includes('[VIDEO_GENERATION_STARTED]'))) {
          console.log('[Claude Streaming] Detected video generation trigger in response');
          
          try {
            // Extract video config from response - check both patterns
            const videoTriggerMatch = fullContent.match(/\[VIDEO_GENERATION_TRIGGER\]([\s\S]*?)\[\/VIDEO_GENERATION_TRIGGER\]/) ||
                                    fullContent.match(/\[VIDEO_GENERATION_STARTED\]([\s\S]*?)\[\/VIDEO_GENERATION_STARTED\]/);
            if (videoTriggerMatch) {
              const videoConfig = JSON.parse(videoTriggerMatch[1]);
              
              // Trigger actual video generation if REPLICATE_API_KEY is available
              if (process.env.REPLICATE_API_KEY) {
                const videoGenResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-video`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(videoConfig)
                });
                
                if (videoGenResponse.ok) {
                  const { id, status } = await videoGenResponse.json();
                  console.log('[Claude Streaming] Video generation started:', id);
                  
                  // Instead of sending a custom video: event, include the video info in the text response
                  const videoMessage = `\n\n🎬 **Video Generation Started**\n- ID: ${id}\n- Prompt: ${videoConfig.prompt}\n- Duration: ${videoConfig.duration}s\n- Status: Generating...\n\nThe video will appear in the Video tab once completed.`;
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(videoMessage)}\n`));
                } else {
                  const errorMessage = `\n\n❌ Failed to start video generation. Please ensure REPLICATE_API_TOKEN is configured correctly.`;
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(errorMessage)}\n`));
                }
              } else {
                const errorMessage = `\n\n⚠️ Video generation requires REPLICATE_API_TOKEN to be configured in your .env.local file.`;
                controller.enqueue(encoder.encode(`0:${JSON.stringify(errorMessage)}\n`));
              }
            }
          } catch (error) {
            console.error('[Claude Streaming] Error triggering video generation:', error);
            const errorMessage = `\n\n❌ Error during video generation: ${error instanceof Error ? error.message : 'Unknown error'}`;
            controller.enqueue(encoder.encode(`0:${JSON.stringify(errorMessage)}\n`));
          }
        }

        // Check for tool calls in the response
        const toolCalls = parseClaudeToolCalls(fullContent);
        
        if (toolCalls.length > 0) {
          // Process tool calls
          for (const toolCall of toolCalls) {
            try {
              // Execute the tool
              const result = await MCPToolsContext.executeToolCall(toolCall);
              
              // Ensure result is a string and properly escape it
              const resultString = typeof result === 'string' ? result : JSON.stringify(result);
              
              // Format the tool execution result to show in the UI
              // Note: We don't need to double-escape since JSON.stringify will handle it
              const formattedResult = `\n\n**Tool Execution: ${toolCall.server} - ${toolCall.tool}**\n${resultString}\n\n`;
              
              // Send each part separately to avoid JSON parsing issues
              controller.enqueue(encoder.encode(`0:${JSON.stringify('\n\n**Tool Execution: ' + toolCall.server + ' - ' + toolCall.tool + '**\n')}\n`));
              controller.enqueue(encoder.encode(`0:${JSON.stringify(resultString)}\n`));
              controller.enqueue(encoder.encode(`0:${JSON.stringify('\n\n')}\n`));
              
              // Small delay to ensure tool results are processed
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Send analysis instruction for the tool results
              const analysisInstruction = `I've executed the ${toolCall.tool} tool and the results are displayed above. Now I'll analyze these results to provide insights based on your request.`;
              controller.enqueue(encoder.encode(`0:${JSON.stringify(analysisInstruction)}\n`));
              
            } catch (error) {
              // Send tool error
              const errorMessage = `\n\n❌ Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
              controller.enqueue(encoder.encode(`0:${JSON.stringify(errorMessage)}\n`));
            }
          }
        }

        // Send completion signal
        controller.enqueue(encoder.encode(`e:{"finishReason":"stop"}\n`));
        controller.close();
      } catch (error) {
        console.error('Claude streaming error:', error);
        // Send error in the AI SDK format
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`3:${JSON.stringify(errorMessage)}\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Removed processToolCall function - using MCPToolsContext.executeToolCall directly