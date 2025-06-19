export interface SearchIntent {
  needsSearch: boolean;
  searchQuery?: string;
  searchType?: 'current_events' | 'factual' | 'research' | 'comparison';
  timeFilter?: string;
  domainFilter?: string[];
  queryType?: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  estimatedDuration?: number; // seconds
  requiresAsync?: boolean;
}

// Export the detector function for backward compatibility
export function detectSearchIntent(userMessage: string): SearchIntent {
  const detector = new SearchIntentDetector();
  return detector.detectSearchIntent(userMessage);
}

export class SearchIntentDetector {
  // Keywords that indicate need for current information
  private currentInfoKeywords = [
    'latest', 'current', 'today', 'now', 'recent', 'news',
    'update', '2025', '2024', 'this year', 'this month',
    'right now', 'at the moment', 'currently', 'breaking',
    'live', 'ongoing', 'happening'
  ];

  // Keywords that indicate factual search needs
  private factualKeywords = [
    'what is', 'who is', 'when did', 'where is', 'how does',
    'price of', 'cost of', 'statistics', 'data', 'facts about'
  ];

  // Keywords for research/comparison
  private researchKeywords = [
    'compare', 'versus', 'vs', 'difference between', 'best',
    'top', 'review', 'analysis', 'research', 'study'
  ];

  // Action keywords that should NOT trigger search
  private actionExclusions = [
    'generate', 'create', 'make', 'produce', 'build', 'design',
    'draw', 'paint', 'compose', 'write', 'edit', 'modify',
    'dialogue', 'conversation', 'multi-speaker', 'voice', 'audio',
    'tts', 'text to speech', 'narrate', 'speak', 'say',
    'image', 'picture', 'photo', 'video', 'animation',
    'download', 'save', 'extract'
  ];

  // Patterns that indicate creative/generative intent
  private generativePatterns = [
    /\b(create|generate|make|produce)\s+(a|an|some)?\s*(dialogue|conversation|audio|voice|image|video)/i,
    /\b(dia\s*tts|wavespeed|multi.?speaker|voice\s*acting)\b/i,
    /\b(alice|bob|charlie|speaker\s*\d+).{0,20}(say|speak|voice)/i,
    /\bcharacters?\s+(talking|speaking|conversing)\b/i,
    /\b(draw|paint|design|illustrate)\s+(a|an|some)?\s*(picture|image|scene)/i
  ];

  detectSearchIntent(userMessage: string): SearchIntent {
    const lowerMessage = userMessage.toLowerCase();
    
    // First check for action/generation exclusions
    const hasActionKeyword = this.actionExclusions.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Check for generative patterns
    const hasGenerativePattern = this.generativePatterns.some(pattern =>
      pattern.test(userMessage)
    );
    
    // If it's a generative/action request, don't search
    if (hasActionKeyword || hasGenerativePattern) {
      return { needsSearch: false };
    }
    
    // Check for current information needs
    const needsCurrentInfo = this.currentInfoKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Check for factual information needs
    const needsFactualInfo = this.factualKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Check for research/comparison needs
    const needsResearch = this.researchKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // Determine if search is needed
    const needsSearch = needsCurrentInfo || needsFactualInfo || needsResearch;

    if (!needsSearch) {
      return { needsSearch: false };
    }

    // Extract time filter if present
    let timeFilter: string | undefined;
    if (lowerMessage.includes('today')) timeFilter = 'day';
    else if (lowerMessage.includes('this week')) timeFilter = 'week';
    else if (lowerMessage.includes('this month')) timeFilter = 'month';
    else if (lowerMessage.includes('this year')) timeFilter = 'year';

    // Determine search type
    let searchType: SearchIntent['searchType'] = 'factual';
    if (needsCurrentInfo) searchType = 'current_events';
    else if (needsResearch) searchType = 'research';

    // Extract potential domain filters
    const domainFilter = this.extractDomainFilter(lowerMessage);

    // Assess query complexity
    const complexity = this.assessComplexity(userMessage, searchType);
    const requiresAsync = complexity === 'complex' || searchType === 'research';
    const estimatedDuration = this.estimateDuration(complexity, searchType);

    return {
      needsSearch: true,
      searchQuery: this.extractSearchQuery(userMessage),
      searchType,
      timeFilter,
      domainFilter,
      queryType: searchType,
      complexity,
      estimatedDuration,
      requiresAsync
    };
  }

  private extractSearchQuery(message: string): string {
    // Remove common question words to create better search query
    return message
      .replace(/^(what|who|when|where|how|why|is|are|can|could|would|should)\s+/i, '')
      .replace(/\?$/, '')
      .trim();
  }

  private extractDomainFilter(message: string): string[] | undefined {
    // Look for specific domain mentions
    const domains: string[] = [];
    
    if (message.includes('reddit')) domains.push('reddit.com');
    if (message.includes('wikipedia')) domains.push('wikipedia.org');
    if (message.includes('github')) domains.push('github.com');
    if (message.includes('stackoverflow')) domains.push('stackoverflow.com');
    
    return domains.length > 0 ? domains : undefined;
  }

  private assessComplexity(message: string, searchType: SearchIntent['searchType']): SearchIntent['complexity'] {
    const wordCount = message.split(/\s+/).length;
    const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
    const hasComplexTerms = /\b(analyze|compare|evaluate|investigate|comprehensive|detailed)\b/i.test(message);
    const hasMultipleConcepts = this.countConcepts(message) > 2;
    
    // Research type queries are inherently complex
    if (searchType === 'research' || searchType === 'comparison') {
      return 'complex';
    }
    
    // Score complexity
    let complexityScore = 0;
    if (wordCount > 50) complexityScore += 2;
    else if (wordCount > 20) complexityScore += 1;
    
    if (hasMultipleQuestions) complexityScore += 2;
    if (hasComplexTerms) complexityScore += 1;
    if (hasMultipleConcepts) complexityScore += 1;
    
    // Determine complexity level
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'moderate';
    return 'simple';
  }

  private countConcepts(message: string): number {
    // Simple concept counting based on named entities and key terms
    const concepts = new Set<string>();
    
    // Extract potential concepts (simplified - could use NLP library)
    const words = message.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'when', 'where', 'who', 'how', 'why']);
    
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        concepts.add(word);
      }
    }
    
    return concepts.size;
  }

  private estimateDuration(complexity: SearchIntent['complexity'], searchType?: SearchIntent['searchType']): number {
    // Base duration estimates in seconds
    const baseDurations = {
      simple: { current_events: 2, factual: 3, research: 10, comparison: 8 },
      moderate: { current_events: 5, factual: 8, research: 30, comparison: 20 },
      complex: { current_events: 10, factual: 15, research: 60, comparison: 40 }
    };
    
    const complexityDurations = baseDurations[complexity || 'simple'];
    return complexityDurations[searchType || 'factual'] || 5;
  }
}
