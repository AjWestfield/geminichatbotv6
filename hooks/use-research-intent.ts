import { useCallback, useMemo } from 'react';

interface ResearchIntent {
  isResearchQuery: boolean;
  researchTopic: string | null;
  suggestedMode: 'sync' | 'async' | 'interactive';
  suggestedDepth: 'surface' | 'moderate' | 'deep';
  confidence: number;
}

const RESEARCH_PATTERNS = [
  // Explicit deep research
  { pattern: /deep\s+research\s+(?:on|about|into)\s+(.+)/i, mode: 'async', depth: 'deep', confidence: 0.95 },
  { pattern: /comprehensive\s+(?:research|analysis|study)\s+(?:on|of|about)\s+(.+)/i, mode: 'async', depth: 'deep', confidence: 0.9 },
  { pattern: /thorough\s+(?:research|investigation|analysis)\s+(?:on|of|about|into)\s+(.+)/i, mode: 'async', depth: 'deep', confidence: 0.9 },
  { pattern: /investigate\s+(.+?)\s+(?:thoroughly|comprehensively|in-depth)/i, mode: 'async', depth: 'deep', confidence: 0.85 },
  
  // Interactive research
  { pattern: /(?:let\'s|can\s+we|could\s+you)\s+research\s+(.+?)\s+together/i, mode: 'interactive', depth: 'moderate', confidence: 0.8 },
  { pattern: /interactive\s+research\s+(?:on|about)\s+(.+)/i, mode: 'interactive', depth: 'moderate', confidence: 0.95 },
  { pattern: /research\s+(.+?)\s+with\s+web\s+(?:view|browsing)/i, mode: 'interactive', depth: 'moderate', confidence: 0.9 },
  
  // Moderate research
  { pattern: /research\s+(?:on|about)\s+(.+)/i, mode: 'async', depth: 'moderate', confidence: 0.7 },
  { pattern: /(?:find|gather)\s+information\s+(?:on|about)\s+(.+)/i, mode: 'sync', depth: 'moderate', confidence: 0.6 },
  { pattern: /what\s+(?:is|are)\s+the\s+latest\s+(?:on|about)\s+(.+)/i, mode: 'async', depth: 'moderate', confidence: 0.65 },
  
  // Surface level research
  { pattern: /quick\s+research\s+(?:on|about)\s+(.+)/i, mode: 'sync', depth: 'surface', confidence: 0.75 },
  { pattern: /brief\s+(?:overview|summary)\s+(?:of|on|about)\s+(.+)/i, mode: 'sync', depth: 'surface', confidence: 0.7 },
  { pattern: /summarize\s+(?:the\s+)?(?:latest|current)\s+(.+)/i, mode: 'sync', depth: 'surface', confidence: 0.65 },
];

export function useResearchIntent() {
  const detectIntent = useCallback((query: string): ResearchIntent => {
    const trimmedQuery = query.trim();
    
    // Check each pattern
    for (const { pattern, mode, depth, confidence } of RESEARCH_PATTERNS) {
      const match = trimmedQuery.match(pattern);
      if (match && match[1]) {
        return {
          isResearchQuery: true,
          researchTopic: match[1].trim(),
          suggestedMode: mode as 'sync' | 'async' | 'interactive',
          suggestedDepth: depth as 'surface' | 'moderate' | 'deep',
          confidence
        };
      }
    }
    
    // Check for implicit research queries
    const implicitPatterns = [
      { keyword: 'latest', confidence: 0.4 },
      { keyword: 'current', confidence: 0.4 },
      { keyword: 'trends', confidence: 0.5 },
      { keyword: 'developments', confidence: 0.5 },
      { keyword: 'advances', confidence: 0.5 },
      { keyword: 'state of', confidence: 0.6 },
      { keyword: 'overview', confidence: 0.4 },
      { keyword: 'explain', confidence: 0.3 },
    ];
    
    const lowerQuery = trimmedQuery.toLowerCase();
    for (const { keyword, confidence } of implicitPatterns) {
      if (lowerQuery.includes(keyword)) {
        // Extract topic (rough heuristic)
        const topic = trimmedQuery
          .replace(/^(what|how|when|where|why|who|which)\s+/i, '')
          .replace(/\?$/, '')
          .trim();
        
        return {
          isResearchQuery: true,
          researchTopic: topic,
          suggestedMode: 'sync',
          suggestedDepth: 'surface',
          confidence
        };
      }
    }
    
    return {
      isResearchQuery: false,
      researchTopic: null,
      suggestedMode: 'sync',
      suggestedDepth: 'surface',
      confidence: 0
    };
  }, []);

  const shouldAutoTrigger = useCallback((intent: ResearchIntent): boolean => {
    // Auto-trigger if confidence is high enough
    return intent.isResearchQuery && intent.confidence >= 0.7;
  }, []);

  const formatResearchPrompt = useCallback((topic: string, depth: 'surface' | 'moderate' | 'deep'): string => {
    const depthDescriptions = {
      surface: 'a brief overview',
      moderate: 'a comprehensive analysis',
      deep: 'an in-depth, thorough investigation'
    };
    
    return `Please provide ${depthDescriptions[depth]} of ${topic}, including recent developments, key insights, and relevant sources.`;
  }, []);

  return {
    detectIntent,
    shouldAutoTrigger,
    formatResearchPrompt
  };
}