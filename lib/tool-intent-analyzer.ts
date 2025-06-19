/**
 * Tool Intent Analyzer - AI-powered intent analysis with semantic understanding
 */

import { toolRegistry, ToolDefinition } from './tool-registry';

export interface IntentAnalysis {
  primaryIntent: string;
  confidence: number;
  toolId: string;
  toolName: string;
  reasoning: string;
  matchedPatterns: string[];
  matchedKeywords: string[];
  secondaryIntents?: Array<{
    toolId: string;
    confidence: number;
    reasoning: string;
  }>;
  contextClues: string[];
  isAmbiguous: boolean;
}

export class ToolIntentAnalyzer {
  /**
   * Analyze user input to determine the most appropriate tool
   */
  analyzeIntent(input: string, context?: { hasFiles?: boolean; previousTool?: string }): IntentAnalysis {
    console.log(`[ToolIntentAnalyzer] Analyzing intent for: "${input}" with context:`, context);
    const normalizedInput = input.toLowerCase();
    const results: Array<{
      tool: ToolDefinition;
      score: number;
      matchedPatterns: string[];
      matchedKeywords: string[];
      reasoning: string;
    }> = [];

    // Analyze each tool
    for (const tool of toolRegistry) {
      // Check context requirements
      if (tool.contextRequirements) {
        const meetsRequirements = tool.contextRequirements.every(req => {
          if (req === 'existing_image' && !context?.hasFiles) return false;
          if (req === 'uploaded_file' && !context?.hasFiles) return false;
          return true;
        });
        if (!meetsRequirements) continue;
      }

      // Check exclusion patterns
      if (tool.exclusionPatterns) {
        const excluded = tool.exclusionPatterns.some(pattern => pattern.test(normalizedInput));
        if (excluded) {
          console.log(`[ToolIntentAnalyzer] Tool ${tool.id} excluded by pattern for input: "${normalizedInput}"`);
          continue;
        }
      }

      let score = 0;
      const matchedPatterns: string[] = [];
      const matchedKeywords: string[] = [];
      let reasoning = '';

      // Pattern matching
      for (const pattern of tool.triggerPatterns) {
        const match = normalizedInput.match(pattern);
        if (match) {
          score += 50;
          matchedPatterns.push(match[0]);
        }
      }

      // Keyword matching
      for (const keyword of tool.keywords) {
        if (normalizedInput.includes(keyword.toLowerCase())) {
          score += 30;
          matchedKeywords.push(keyword);
        }
      }

      // Priority boost
      score += tool.priority / 10;

      // Semantic analysis
      const semanticScore = this.analyzeSemantics(normalizedInput, tool);
      score += semanticScore.score;
      reasoning = semanticScore.reasoning;

      // Context bonus
      if (context?.previousTool === tool.id) {
        score += 10; // Slight boost for tool continuity
      }

      // File context penalty for TTS tools
      if (context?.hasFiles && ['wavespeed-tts', 'dia-tts'].includes(tool.id)) {
        // Check if it's explicitly asking for TTS despite having files
        const explicitTTS = /\b(tts|text.?to.?speech|read.*aloud|voice.*over|narrat)\b/i.test(normalizedInput);
        if (!explicitTTS) {
          score -= 40;
          reasoning = (reasoning ? reasoning + '; ' : '') + 'Files attached without explicit TTS request';
        }
      }

      if (score > 0) {
        results.push({ tool, score, matchedPatterns, matchedKeywords, reasoning });
      } else {
        console.log(`[ToolIntentAnalyzer] Tool ${tool.id} has negative score ${score}, excluding from results`);
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      return {
        primaryIntent: 'unclear',
        confidence: 0,
        toolId: 'none',
        toolName: 'No matching tool',
        reasoning: 'No tools matched the user input',
        matchedPatterns: [],
        matchedKeywords: [],
        contextClues: [],
        isAmbiguous: true
      };
    }

    const topResult = results[0];
    const secondBest = results[1];
    
    // Check for ambiguity
    const isAmbiguous = secondBest && (topResult.score - secondBest.score) < 30;

    // Extract context clues
    const contextClues = this.extractContextClues(normalizedInput);

    const result = {
      primaryIntent: this.determineIntent(topResult.tool),
      confidence: Math.min(100, Math.round((topResult.score / 200) * 100)),
      toolId: topResult.tool.id,
      toolName: topResult.tool.name,
      reasoning: topResult.reasoning,
      matchedPatterns: topResult.matchedPatterns,
      matchedKeywords: topResult.matchedKeywords,
      secondaryIntents: results.slice(1, 3).map(r => ({
        toolId: r.tool.id,
        confidence: Math.min(100, Math.round((r.score / 200) * 100)),
        reasoning: r.reasoning
      })),
      contextClues,
      isAmbiguous
    };
    
    console.log(`[ToolIntentAnalyzer] Final result: tool=${result.toolId}, confidence=${result.confidence}%, score=${topResult.score}`);
    return result;
  }

  /**
   * Semantic analysis for better understanding
   */
  private analyzeSemantics(input: string, tool: ToolDefinition): { score: number; reasoning: string } {
    let score = 0;
    const reasons: string[] = [];

    // Check for reverse engineering intent FIRST - this should suppress other tools
    const isReverseEngineering = /\b(reverse.?engineer|recreate|analyze.{0,20}production|break.?down|deconstruct|how.?was.?this.?made|production.?analysis)\b/i.test(input);
    
    if (isReverseEngineering) {
      // Heavily penalize all generation tools for reverse engineering requests
      if (['wavespeed-tts', 'dia-tts', 'image-generation', 'video-generation', 'image-editing'].includes(tool.id)) {
        score -= 100;
        reasons.push('Reverse engineering request - not a generation task');
        return { score, reasoning: reasons.join('; ') };
      }
    }

    // Multi-speaker TTS specific semantics
    if (tool.id === 'dia-tts') {
      // Check for multiple characters/speakers
      const speakerIndicators = input.match(/\b(alice|bob|charlie|speaker|character|person|voice)\b/gi);
      if (speakerIndicators && speakerIndicators.length > 1) {
        score += 40;
        reasons.push('Multiple speakers/characters mentioned');
      }

      // Check for dialogue indicators
      if (/\b(between|conversation|talking|discussing)\b/i.test(input)) {
        score += 30;
        reasons.push('Dialogue/conversation context detected');
      }

      // Check for script-like content
      if (input.includes(':') && /\b\w+\s*:/.test(input)) {
        score += 40;
        reasons.push('Script format detected');
      }
    }

    // Image generation semantics
    if (tool.id === 'image-generation') {
      // Visual descriptors
      if (/\b(beautiful|colorful|detailed|realistic|artistic|style)\b/i.test(input)) {
        score += 20;
        reasons.push('Visual descriptors found');
      }

      // Composition indicators
      if (/\b(foreground|background|composition|scene|landscape|portrait)\b/i.test(input)) {
        score += 20;
        reasons.push('Composition elements mentioned');
      }
    }

    // Search semantics
    if (tool.id === 'web-search') {
      // Question words at the beginning
      if (/^(what|how|why|when|where|who|which|is|are|does|do)/i.test(input)) {
        score += 30;
        reasons.push('Question pattern detected');
      }

      // Information seeking
      if (/\b(tell me|explain|describe|information about|details on)\b/i.test(input)) {
        score += 25;
        reasons.push('Information seeking language');
      }
    }

    // Action vs Query detection
    const actionWords = /\b(create|generate|make|produce|build|design|edit|modify)\b/i.test(input);
    const queryWords = /\b(what|how|why|explain|tell me|information|search|find out)\b/i.test(input);

    if (tool.category === 'action' && actionWords && !queryWords) {
      score += 25;
      reasons.push('Strong action intent');
    } else if (tool.category === 'query' && queryWords && !actionWords) {
      score += 25;
      reasons.push('Strong query intent');
    }

    // TTS specific - reduce score for wavespeed-tts when it seems like a file analysis request
    if (tool.id === 'wavespeed-tts') {
      // Check for file/video/image analysis indicators
      if (/\b(this\s+(video|image|file|photo|picture|audio))\b/i.test(input)) {
        score -= 50;
        reasons.push('Refers to attached file - likely not TTS');
      }
      
      // Check for analysis/reverse engineering language
      if (/\b(analyze|reverse|engineer|break.*down|how.*made|production|recreate)\b/i.test(input)) {
        score -= 50;
        reasons.push('Analysis language detected - not TTS');
      }
      
      // Require more explicit TTS indicators
      if (!/\b(tts|text.?to.?speech|voice|narrat|read.*aloud|speak.*out|audio.*from.*text)\b/i.test(input)) {
        score -= 30;
        reasons.push('No explicit TTS indicators');
      }
    }

    return {
      score,
      reasoning: reasons.join('; ') || 'Pattern matching only'
    };
  }

  /**
   * Extract context clues from the input
   */
  private extractContextClues(input: string): string[] {
    const clues: string[] = [];

    // Check for URLs
    if (/https?:\/\/\S+/i.test(input)) {
      clues.push('Contains URL');
    }

    // Check for file references
    if (/\.(jpg|jpeg|png|gif|mp4|mp3|wav|pdf|txt|doc)/i.test(input)) {
      clues.push('Contains file extension');
    }

    // Check for code/technical content
    if (/```[\s\S]*```/.test(input) || /\bcode\b/i.test(input)) {
      clues.push('Contains code or technical content');
    }

    // Check for numbers/quantities
    if (/\b\d+\b/.test(input)) {
      clues.push('Contains numeric values');
    }

    // Check for quotes (might indicate dialogue)
    if (/["'].*["']/.test(input)) {
      clues.push('Contains quoted text');
    }

    return clues;
  }

  /**
   * Determine high-level intent category
   */
  private determineIntent(tool: ToolDefinition): string {
    switch (tool.id) {
      case 'dia-tts':
        return 'create_multi_speaker_audio';
      case 'wavespeed-tts':
        return 'create_audio';
      case 'image-generation':
        return 'generate_image';
      case 'video-generation':
        return 'generate_video';
      case 'web-search':
        return 'search_information';
      case 'image-editing':
        return 'edit_image';
      case 'social-media-download':
        return 'download_media';
      case 'file-analysis':
        return 'analyze_file';
      case 'mcp-tools':
        return 'execute_tool';
      default:
        return 'unknown';
    }
  }

  /**
   * Get a human-readable explanation of the analysis
   */
  explainAnalysis(analysis: IntentAnalysis): string {
    let explanation = `I detected that you want to ${analysis.primaryIntent.replace(/_/g, ' ')}.\\n\\n`;
    
    explanation += `Primary tool: ${analysis.toolName} (${analysis.confidence}% confidence)\\n`;
    explanation += `Reasoning: ${analysis.reasoning}\\n\\n`;

    if (analysis.matchedPatterns.length > 0) {
      explanation += `Matched patterns: ${analysis.matchedPatterns.join(', ')}\\n`;
    }

    if (analysis.matchedKeywords.length > 0) {
      explanation += `Keywords found: ${analysis.matchedKeywords.join(', ')}\\n`;
    }

    if (analysis.isAmbiguous && analysis.secondaryIntents && analysis.secondaryIntents.length > 0) {
      explanation += `\\nNote: Your request could also mean:\\n`;
      for (const secondary of analysis.secondaryIntents) {
        const tool = toolRegistry.find(t => t.id === secondary.toolId);
        explanation += `- ${tool?.name} (${secondary.confidence}% confidence)\\n`;
      }
    }

    return explanation;
  }
}