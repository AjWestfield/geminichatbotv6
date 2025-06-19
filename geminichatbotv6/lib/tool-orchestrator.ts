/**
 * Tool Orchestrator - Central system for routing requests to appropriate tools
 */

import { ToolIntentAnalyzer, IntentAnalysis } from './tool-intent-analyzer';
import { getToolById, ToolDefinition } from './tool-registry';
import { detectSearchIntent } from './search-intent-detector';

export interface OrchestrationResult {
  toolId: string;
  toolName: string;
  intent: string;
  confidence: number;
  shouldExecute: boolean;
  parameters?: Record<string, any>;
  alternativeTools?: Array<{
    toolId: string;
    toolName: string;
    confidence: number;
  }>;
  explanation: string;
  requiresConfirmation: boolean;
}

export interface OrchestrationContext {
  hasFiles?: boolean;
  previousTool?: string;
  fileTypes?: string[];
  conversationHistory?: string[];
  userPreferences?: {
    preferredImageModel?: string;
    preferredTTSVoice?: string;
  };
}

export class ToolOrchestrator {
  private analyzer: ToolIntentAnalyzer;

  constructor() {
    this.analyzer = new ToolIntentAnalyzer();
  }

  /**
   * Main orchestration method - routes requests to appropriate tools
   */
  async orchestrate(
    userInput: string,
    context?: OrchestrationContext
  ): Promise<OrchestrationResult> {
    // First, analyze intent with our advanced analyzer
    const analysis = this.analyzer.analyzeIntent(userInput, context);

    // Check if we need confirmation due to ambiguity
    const requiresConfirmation = analysis.isAmbiguous && analysis.confidence < 70;

    // Get the tool definition
    const tool = getToolById(analysis.toolId);
    if (!tool) {
      return this.createNoToolResult(userInput);
    }

    // Extract parameters based on tool type
    const parameters = await this.extractParameters(userInput, tool, context);

    // Build explanation
    const explanation = this.buildExplanation(analysis, tool, parameters);

    // Determine if we should auto-execute
    const shouldExecute = this.shouldAutoExecute(analysis, tool, context);

    return {
      toolId: analysis.toolId,
      toolName: analysis.toolName,
      intent: analysis.primaryIntent,
      confidence: analysis.confidence,
      shouldExecute,
      parameters,
      alternativeTools: analysis.secondaryIntents?.map(intent => {
        const altTool = getToolById(intent.toolId);
        return {
          toolId: intent.toolId,
          toolName: altTool?.name || 'Unknown',
          confidence: intent.confidence
        };
      }),
      explanation,
      requiresConfirmation
    };
  }

  /**
   * Extract parameters specific to each tool
   */
  private async extractParameters(
    input: string,
    tool: ToolDefinition,
    context?: OrchestrationContext
  ): Promise<Record<string, any>> {
    const params: Record<string, any> = {};

    switch (tool.id) {
      case 'dia-tts':
        params.speakers = this.extractSpeakers(input);
        params.dialogue = this.extractDialogue(input);
        params.emotions = this.extractEmotions(input);
        break;

      case 'wavespeed-tts':
        params.text = this.extractPlainText(input);
        params.voice = context?.userPreferences?.preferredTTSVoice || 'default';
        break;

      case 'image-generation':
        params.prompt = this.extractImagePrompt(input);
        params.aspectRatio = this.extractAspectRatio(input);
        params.model = this.extractImageModel(input) || context?.userPreferences?.preferredImageModel;
        params.quality = this.extractQuality(input);
        break;

      case 'video-generation':
        params.prompt = this.extractVideoPrompt(input);
        params.duration = this.extractDuration(input);
        params.model = this.extractVideoModel(input);
        break;

      case 'web-search':
        // Use existing search intent detector for consistency
        const searchIntent = detectSearchIntent(input);
        params.query = searchIntent.searchQuery || input;
        params.searchType = searchIntent.queryType;
        break;

      case 'social-media-download':
        params.urls = this.extractUrls(input);
        params.platform = this.detectPlatform(input);
        break;

      case 'image-editing':
        params.editInstructions = this.extractEditInstructions(input);
        params.maskArea = this.extractMaskArea(input);
        break;
    }

    return params;
  }

  /**
   * Helper methods for parameter extraction
   */
  private extractSpeakers(input: string): Array<{ name: string; voice?: string }> {
    const speakers: Array<{ name: string; voice?: string }> = [];

    // Look for explicit speaker names
    const speakerMatches = input.matchAll(/\b(Alice|Bob|Charlie|Sarah|John|Emma|Speaker\s*\d+)\b/gi);
    for (const match of speakerMatches) {
      speakers.push({ name: match[1] });
    }

    // Look for dialogue format "Name: text"
    const dialogueMatches = input.matchAll(/\b(\w+)\s*:\s*['""]?([^'""\\n]+)/g);
    for (const match of dialogueMatches) {
      const name = match[1];
      if (!speakers.find(s => s.name.toLowerCase() === name.toLowerCase())) {
        speakers.push({ name });
      }
    }

    // Default to Alice and Bob if no speakers found
    if (speakers.length === 0) {
      speakers.push({ name: 'Alice' }, { name: 'Bob' });
    }

    return speakers;
  }

  private extractDialogue(input: string): string {
    // Try to extract dialogue content
    const dialogueMatch = input.match(/```[\s\S]*```/);
    if (dialogueMatch) {
      return dialogueMatch[0].replace(/```/g, '').trim();
    }

    // Look for quoted sections
    const quotedSections = input.match(/["']([^"']+)["']/g);
    if (quotedSections && quotedSections.length > 0) {
      return quotedSections.join('\\n');
    }

    return input;
  }

  private extractEmotions(input: string): Record<string, string> {
    const emotions: Record<string, string> = {};
    const emotionWords = ['happy', 'sad', 'angry', 'excited', 'nervous', 'calm', 'confused', 'sarcastic'];

    for (const emotion of emotionWords) {
      if (input.toLowerCase().includes(emotion)) {
        // Try to associate with speaker
        const pattern = new RegExp(`(\\w+)\\s+\\b${emotion}\\b`, 'i');
        const match = input.match(pattern);
        if (match) {
          emotions[match[1]] = emotion;
        }
      }
    }

    return emotions;
  }

  private extractPlainText(input: string): string {
    // Remove tool-specific commands
    return input
      .replace(/\b(read|speak|say|narrate|tts)\s+(this|out loud|the following)?\s*/gi, '')
      .replace(/\b(text to speech|tts)\b/gi, '')
      .trim();
  }

  private extractImagePrompt(input: string): string {
    // Remove generation commands
    return input
      .replace(/\b(generate|create|make|draw|paint|design|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork|visual)\s+(of|with|showing)?\s*/gi, '')
      .trim();
  }

  private extractAspectRatio(input: string): string {
    const ratioMatch = input.match(/\b(16:9|9:16|1:1|4:3|3:4|3:2|2:3)\b/);
    if (ratioMatch) return ratioMatch[1];

    if (/\b(landscape|wide|horizontal)\b/i.test(input)) return '16:9';
    if (/\b(portrait|vertical|tall)\b/i.test(input)) return '9:16';
    if (/\b(square)\b/i.test(input)) return '1:1';

    return '1:1'; // default
  }

  private extractImageModel(input: string): string | undefined {
    if (/\bgpt.?image/i.test(input)) return 'gpt-image-1';
    if (/\bwave.?speed|flux/i.test(input)) return 'wavespeed-flux';
    if (/\breplicate/i.test(input)) return 'replicate';
    return undefined;
  }

  private extractQuality(input: string): string {
    if (/\b(hd|high.?definition|high.?quality|best)\b/i.test(input)) return 'hd';
    if (/\b(standard|normal|regular)\b/i.test(input)) return 'standard';
    return 'standard';
  }

  private extractVideoPrompt(input: string): string {
    return input
      .replace(/\b(generate|create|make|produce)\s+(a\s+)?(video|animation|motion)\s+(of|with|showing)?\s*/gi, '')
      .trim();
  }

  private extractDuration(input: string): number {
    const durationMatch = input.match(/\b(\d+)\s*(second|sec|s)\b/i);
    if (durationMatch) {
      return parseInt(durationMatch[1]);
    }
    return 5; // default 5 seconds
  }

  private extractVideoModel(input: string): string {
    if (/\bkling\s*v?1\.6/i.test(input)) return 'kling-v1.6';
    if (/\bkling\s*v?1\.5/i.test(input)) return 'kling-v1.5';
    return 'kling-v1.6'; // default to latest
  }

  private extractUrls(input: string): string[] {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const matches = input.match(urlPattern);
    return matches || [];
  }

  private detectPlatform(input: string): string {
    if (/youtube|youtu\.be/i.test(input)) return 'youtube';
    if (/instagram/i.test(input)) return 'instagram';
    if (/tiktok/i.test(input)) return 'tiktok';
    if (/twitter|x\.com/i.test(input)) return 'twitter';
    if (/facebook/i.test(input)) return 'facebook';
    if (/reddit/i.test(input)) return 'reddit';
    return 'unknown';
  }

  private extractEditInstructions(input: string): string {
    return input
      .replace(/\b(edit|modify|change|alter|update|fix|improve|enhance)\s+(the\s+)?(image|picture|photo)\s*/gi, '')
      .trim();
  }

  private extractMaskArea(input: string): string | undefined {
    // Look for specific area descriptions
    const areaMatch = input.match(/\b(background|foreground|sky|ground|left|right|top|bottom|center|face|object)\b/i);
    return areaMatch ? areaMatch[1] : undefined;
  }

  /**
   * Build user-friendly explanation
   */
  private buildExplanation(
    analysis: IntentAnalysis,
    tool: ToolDefinition,
    parameters: Record<string, any>
  ): string {
    let explanation = `I'll use ${tool.name} to ${analysis.primaryIntent.replace(/_/g, ' ')}.\\n\\n`;

    // Add parameter details
    if (Object.keys(parameters).length > 0) {
      explanation += 'Details:\\n';
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null) {
          explanation += `- ${this.humanizeKey(key)}: ${this.humanizeValue(value)}\\n`;
        }
      }
    }

    // Add confidence note if ambiguous
    if (analysis.isAmbiguous) {
      explanation += `\\nNote: I'm ${analysis.confidence}% confident about this choice.`;
      if (analysis.secondaryIntents && analysis.secondaryIntents.length > 0) {
        explanation += ' You might also mean:';
        for (const alt of analysis.secondaryIntents) {
          const altTool = getToolById(alt.toolId);
          explanation += `\\n- ${altTool?.name} (${alt.confidence}% match)`;
        }
      }
    }

    return explanation;
  }

  /**
   * Determine if tool should auto-execute
   */
  private shouldAutoExecute(
    analysis: IntentAnalysis,
    tool: ToolDefinition,
    context?: OrchestrationContext
  ): boolean {
    // Don't auto-execute if confidence is too low
    if (analysis.confidence < 60) return false;

    // Don't auto-execute if ambiguous
    if (analysis.isAmbiguous && analysis.confidence < 80) return false;

    // Action tools with high confidence can auto-execute
    if (tool.category === 'action' && analysis.confidence >= 80) return true;

    // Query tools can generally auto-execute
    if (tool.category === 'query') return true;

    // Utility tools need confirmation
    if (tool.category === 'utility') return false;

    return false;
  }

  /**
   * Create result when no tool matches
   */
  private createNoToolResult(input: string): OrchestrationResult {
    return {
      toolId: 'none',
      toolName: 'No matching tool',
      intent: 'unclear',
      confidence: 0,
      shouldExecute: false,
      explanation: `I couldn't determine which tool to use for: "${input}". Please be more specific about what you'd like to do.`,
      requiresConfirmation: false
    };
  }

  /**
   * Utility methods
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  }

  private humanizeValue(value: any): string {
    if (Array.isArray(value)) {
      if (value.length === 0) return 'none';
      if (typeof value[0] === 'object') {
        return value.map(v => v.name || JSON.stringify(v)).join(', ');
      }
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Get available tools for display
   */
  getAvailableTools(): ToolDefinition[] {
    return [...toolRegistry].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if a specific tool is available
   */
  isToolAvailable(toolId: string, context?: OrchestrationContext): boolean {
    const tool = getToolById(toolId);
    if (!tool) return false;

    // Check context requirements
    if (tool.contextRequirements) {
      return tool.contextRequirements.every(req => {
        if (req === 'existing_image' && !context?.hasFiles) return false;
        if (req === 'uploaded_file' && !context?.hasFiles) return false;
        return true;
      });
    }

    return true;
  }
}
