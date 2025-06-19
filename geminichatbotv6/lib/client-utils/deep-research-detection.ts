// Client-safe deep research detection utility
// This file contains only browser-compatible code

export function shouldTriggerDeepResearch(message: string): {
  shouldTrigger: boolean;
  depth?: 'surface' | 'moderate' | 'deep';
  topic?: string;
} {
  const deepResearchPatterns = [
    {
      pattern: /(?:deep research|comprehensive research|thorough research|detailed research) (?:on|about) (.+)/i,
      depth: 'deep' as const
    },
    {
      pattern: /(?:research deeply|investigate thoroughly|analyze comprehensively) (.+)/i,
      depth: 'deep' as const
    },
    {
      pattern: /(?:moderate research|standard research) (?:on|about) (.+)/i,
      depth: 'moderate' as const
    },
    {
      pattern: /(?:quick research|brief research|surface research) (?:on|about) (.+)/i,
      depth: 'surface' as const
    }
  ];

  for (const { pattern, depth } of deepResearchPatterns) {
    const match = message.match(pattern);
    if (match) {
      return {
        shouldTrigger: true,
        depth,
        topic: match[1].trim()
      };
    }
  }

  return { shouldTrigger: false };
}