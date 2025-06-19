/**
 * Tool Registry - Central registry of all available tools with their capabilities
 */

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'action' | 'query' | 'utility';
  priority: number; // Higher priority = checked first
  triggerPatterns: RegExp[];
  keywords: string[];
  capabilities: string[];
  exclusionPatterns?: RegExp[]; // Patterns that should NOT trigger this tool
  contextRequirements?: string[]; // Required context for this tool to be relevant
}

export const toolRegistry: ToolDefinition[] = [
  // Multi-Speaker TTS (Dia TTS)
  {
    id: 'dia-tts',
    name: 'Dia TTS - Multi-Speaker Audio',
    description: 'Generate multi-speaker dialogue audio with different voices',
    category: 'action',
    priority: 100,
    triggerPatterns: [
      /\b(dialogue|conversation|dialog|multi.?speaker|multiple.?speaker|different.?voice|voice.?acting|audio.?conversation|speaking.?parts)\b/i,
      /\b(create|generate|make).{0,20}(dialogue|conversation|voices|speakers|audio.{0,10}conversation)\b/i,
      /\b(alice|bob|charlie|speaker.?\d+).{0,20}(say|speak|voice)\b/i,
      /\bdia.?tts\b/i,
      /\b(two|three|four|five|\d+).{0,10}(speaker|voice|character|person)/i,
      /\bcharacters?.{0,10}(talking|speaking|conversing)\b/i
    ],
    keywords: ['dialogue', 'conversation', 'multi-speaker', 'voices', 'speakers', 'audio conversation', 'voice acting', 'dia tts'],
    capabilities: [
      'Generate dialogue with multiple speakers',
      'Create audio conversations',
      'Voice acting for scripts',
      'Different voices for different characters'
    ],
    exclusionPatterns: [
      /\b(information|search|find|what|how|why|when|where|explain)\b/i
    ]
  },

  // TTS (WaveSpeed)
  {
    id: 'wavespeed-tts',
    name: 'WaveSpeed TTS',
    description: 'Generate high-quality single or multi-speaker audio using WaveSpeed Dia TTS',
    category: 'action',
    priority: 90,
    triggerPatterns: [
      /\b(text.?to.?speech|tts)\b/i,
      /\b(narrat|voice.?over|read.?aloud)\b/i,
      /\b(read|speak|say).{0,20}(out.?loud|aloud|this.?text|this.?script)\b/i,
      /\b(generate|create|make).{0,20}(audio|voice|speech|narration)\b/i,
      /\bwavespeed?\b/i,
      /\b(convert|turn).{0,20}(text|script).{0,20}(to|into).{0,20}(audio|speech|voice)\b/i
    ],
    keywords: ['tts', 'text to speech', 'voice', 'narration', 'audio', 'speak', 'wavespeed', 'dia', 'multi-speaker'],
    capabilities: [
      'Generate single-speaker audio',
      'Generate multi-speaker dialogues',
      'High-quality voice synthesis',
      'Natural-sounding narration'
    ],
    exclusionPatterns: [
      /\b(reverse.?engineer|recreate|analyze|break.?down|deconstruct)\b/i,
      /\b(how.?to.?make|how.?was.?this|production.?breakdown)\b/i,
      /\b(video|image|photo|picture).{0,20}(analysis|breakdown|reverse)\b/i,
      /\bthis\s+(video|image|photo|file)\b/i,
      /\b(upload|attached|file).{0,20}(video|image)\b/i
    ]
  },

  // Image Generation
  {
    id: 'image-generation',
    name: 'Image Generation',
    description: 'Generate images using AI models (GPT-Image-1, WaveSpeed Flux, Replicate)',
    category: 'action',
    priority: 95,
    triggerPatterns: [
      /\b(generate|create|make|draw|paint|design|produce).{0,20}(image|picture|photo|illustration|artwork|visual|portrait|landscape)\b/i,
      /\b(image|picture|photo|illustration|artwork|visual).{0,20}(of|with|showing|depicting)\b/i,
      /\bgpt.?image|wave.?speed|flux|replicate.{0,10}image\b/i
    ],
    keywords: ['image', 'picture', 'photo', 'illustration', 'generate image', 'create image', 'artwork', 'visual'],
    capabilities: [
      'Generate images from text descriptions',
      'Multiple quality levels (HD, Standard, Pro)',
      'Various aspect ratios',
      'Style customization'
    ]
  },

  // Video Generation
  {
    id: 'video-generation',
    name: 'Video Generation',
    description: 'Generate videos using Replicate Kling models',
    category: 'action',
    priority: 94,
    triggerPatterns: [
      /\b(generate|create|make|produce).{0,20}(video|animation|motion|clip)\b/i,
      /\b(video|animation|motion.?picture).{0,20}(of|with|showing)\b/i,
      /\b(animate|bring.?to.?life|add.?motion)\b/i,
      /\bkling.?(v1\.5|v1\.6|model)?\b/i
    ],
    keywords: ['video', 'animation', 'motion', 'generate video', 'create video', 'animate', 'kling'],
    capabilities: [
      'Generate videos from text descriptions',
      'Image-to-video conversion',
      'Various durations and styles'
    ]
  },

  // Web Search (Perplexity)
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web for current information using Perplexity',
    category: 'query',
    priority: 50,
    triggerPatterns: [
      /\b(search|find|look.?up|research|investigate|explore)\b/i,
      /\b(what|how|why|when|where|who|which).{0,20}(is|are|was|were|does|do|did)\b/i,
      /\b(latest|current|recent|news|update|trend)\b/i,
      /\b(information|details|facts|data).{0,10}(about|on|regarding)\b/i,
      /\bperplexity\b/i
    ],
    keywords: ['search', 'find', 'research', 'information', 'facts', 'data', 'perplexity'],
    capabilities: [
      'Real-time web search',
      'Current information retrieval',
      'Citation sources',
      'Follow-up questions'
    ],
    exclusionPatterns: [
      /\b(generate|create|make|produce|draw|paint|design)\b/i,
      /\b(dialogue|conversation|voice|audio|tts|speak)\b/i,
      /\b(image|video|animation|picture|photo)\b/i
    ]
  },

  // Image Editing
  {
    id: 'image-editing',
    name: 'Image Editing',
    description: 'Edit existing images using AI',
    category: 'action',
    priority: 85,
    triggerPatterns: [
      /\b(edit|modify|change|alter|update|fix|improve|enhance).{0,20}(image|picture|photo)\b/i,
      /\b(remove|add|replace|mask|inpaint)\b/i,
      /\binpainting|masking|image.?editing\b/i
    ],
    keywords: ['edit', 'modify', 'change', 'image editing', 'inpaint', 'mask', 'enhance'],
    capabilities: [
      'AI-powered image editing',
      'Object removal and addition',
      'Inpainting and masking',
      'Style transfer'
    ],
    contextRequirements: ['existing_image']
  },

  // Social Media Downloads
  {
    id: 'social-media-download',
    name: 'Social Media Download',
    description: 'Download videos and content from social media platforms',
    category: 'action',
    priority: 80,
    triggerPatterns: [
      /\b(download|save|get|fetch|extract).{0,20}(video|content|media)\b/i,
      /\b(youtube|instagram|tiktok|twitter|facebook|reddit)\b/i,
      /https?:\/\/(www\.)?(youtube|youtu\.be|instagram|tiktok|twitter|x\.com|facebook|reddit)/i
    ],
    keywords: ['download', 'social media', 'youtube', 'instagram', 'tiktok', 'video download'],
    capabilities: [
      'Download videos from social platforms',
      'Extract audio from videos',
      'Handle age-restricted content',
      'Bulk downloads'
    ]
  },

  // File Analysis
  {
    id: 'file-analysis',
    name: 'File Analysis',
    description: 'Analyze uploaded files (images, audio, video, documents)',
    category: 'query',
    priority: 70,
    triggerPatterns: [
      /\b(analyze|examine|inspect|review|check).{0,20}(file|image|audio|video|document)\b/i,
      /\b(what|tell.?me|describe|explain).{0,20}(this|the).{0,10}(file|image|audio|video)\b/i,
      /\btranscribe|extract.?text|ocr\b/i
    ],
    keywords: ['analyze', 'examine', 'file analysis', 'transcribe', 'ocr'],
    capabilities: [
      'Image analysis with vision models',
      'Audio transcription',
      'Video frame extraction',
      'Document analysis'
    ],
    contextRequirements: ['uploaded_file']
  },

  // MCP Tools
  {
    id: 'mcp-tools',
    name: 'MCP Tools',
    description: 'Execute Model Context Protocol tools',
    category: 'utility',
    priority: 60,
    triggerPatterns: [
      /\b(mcp|model.?context.?protocol)\b/i,
      /\b(tool|execute|run).{0,20}(mcp|server)\b/i,
      /\bgithub.?repo|filesystem.?access\b/i
    ],
    keywords: ['mcp', 'tools', 'model context protocol', 'github', 'filesystem'],
    capabilities: [
      'Execute MCP server tools',
      'GitHub repository analysis',
      'Filesystem operations',
      'Custom tool execution'
    ]
  }
];

// Helper function to get tool by ID
export function getToolById(id: string): ToolDefinition | undefined {
  return toolRegistry.find(tool => tool.id === id);
}

// Helper function to get tools by category
export function getToolsByCategory(category: 'action' | 'query' | 'utility'): ToolDefinition[] {
  return toolRegistry.filter(tool => tool.category === category);
}

// Helper function to get all action tools (highest priority)
export function getActionTools(): ToolDefinition[] {
  return getToolsByCategory('action').sort((a, b) => b.priority - a.priority);
}