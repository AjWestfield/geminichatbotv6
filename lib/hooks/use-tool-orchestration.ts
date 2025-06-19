/**
 * Hook for integrating the Tool Orchestration System into the chat interface
 */

import { useState, useCallback } from 'react';
import { ToolOrchestrator, OrchestrationResult, OrchestrationContext } from '../tool-orchestrator';
import { toast } from 'sonner';

export interface UseToolOrchestrationOptions {
  onToolSelected?: (result: OrchestrationResult) => void;
  autoExecute?: boolean;
}

export function useToolOrchestration(options?: UseToolOrchestrationOptions) {
  const [orchestrator] = useState(() => new ToolOrchestrator());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<OrchestrationResult | null>(null);

  /**
   * Analyze user input and determine the appropriate tool
   */
  const analyzeIntent = useCallback(async (
    userInput: string,
    context?: OrchestrationContext
  ): Promise<OrchestrationResult> => {
    setIsAnalyzing(true);
    
    try {
      const result = await orchestrator.orchestrate(userInput, context);
      setLastResult(result);
      
      // Show toast notification for tool selection
      if (result.toolId !== 'none') {
        toast.info(`🎯 Detected: ${result.toolName}`, {
          description: `Confidence: ${result.confidence}%`,
          duration: 3000,
        });
      }
      
      // Callback for external handling
      if (options?.onToolSelected) {
        options.onToolSelected(result);
      }
      
      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, [orchestrator, options]);

  /**
   * Get available tools for display
   */
  const getAvailableTools = useCallback(() => {
    return orchestrator.getAvailableTools();
  }, [orchestrator]);

  /**
   * Check if a specific tool is available
   */
  const isToolAvailable = useCallback((
    toolId: string,
    context?: OrchestrationContext
  ): boolean => {
    return orchestrator.isToolAvailable(toolId, context);
  }, [orchestrator]);

  /**
   * Execute the detected tool (integration point)
   */
  const executeDetectedTool = useCallback(async (result: OrchestrationResult) => {
    if (!result.shouldExecute && !options?.autoExecute) {
      return null;
    }

    // This is where you would integrate with existing tool execution logic
    switch (result.toolId) {
      case 'dia-tts':
        // Call Dia TTS handler with result.parameters
        console.log('Execute Dia TTS with:', result.parameters);
        break;
        
      case 'wavespeed-tts':
        // Call WaveSpeed TTS handler
        console.log('Execute WaveSpeed TTS with:', result.parameters);
        break;
        
      case 'image-generation':
        // Call image generation handler
        console.log('Generate image with:', result.parameters);
        break;
        
      case 'video-generation':
        // Call video generation handler
        console.log('Generate video with:', result.parameters);
        break;
        
      case 'web-search':
        // Call Perplexity search
        console.log('Search web with:', result.parameters);
        break;
        
      default:
        console.log('Unknown tool:', result.toolId);
    }
  }, [options?.autoExecute]);

  return {
    analyzeIntent,
    executeDetectedTool,
    getAvailableTools,
    isToolAvailable,
    isAnalyzing,
    lastResult,
  };
}

/**
 * Example usage in a component:
 * 
 * const { analyzeIntent, executeDetectedTool, isAnalyzing } = useToolOrchestration({
 *   onToolSelected: (result) => {
 *     console.log('Tool selected:', result);
 *   },
 *   autoExecute: true
 * });
 * 
 * // In your message handler:
 * const handleUserMessage = async (message: string) => {
 *   const context = {
 *     hasFiles: attachedFiles.length > 0,
 *     fileTypes: attachedFiles.map(f => f.type)
 *   };
 *   
 *   const result = await analyzeIntent(message, context);
 *   
 *   if (result.requiresConfirmation) {
 *     // Show confirmation dialog
 *   } else if (result.shouldExecute) {
 *     await executeDetectedTool(result);
 *   }
 * };
 */