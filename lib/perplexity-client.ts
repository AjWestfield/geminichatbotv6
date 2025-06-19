import axios from 'axios';
import { getPerplexityQueue } from './perplexity-queue';
import { getPerplexityCache } from './perplexity-cache';

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexitySearchOptions {
  search_mode?: 'web' | 'academic';
  search_domain_filter?: string[];
  search_recency_filter?: string;
  return_images?: boolean;
  return_related_questions?: boolean;
  max_search_depth?: number;
  citation_style?: 'inline' | 'footnote' | 'bibliography';
}

export interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  search_results?: Array<{
    title: string;
    url: string;
    date?: string;
    snippet?: string;
    author?: string;
    domain?: string;
  }>;
  images?: Array<{
    url: string;
    title?: string;
    source?: string;
  }>;
  related_questions?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Deep Research Session interface
export interface DeepResearchSession {
  sessionId: string;
  topic: string;
  status: 'active' | 'paused' | 'completed';
  currentPhase: string;
  progress: number;
  startedAt: Date;
  lastUpdated: Date;
}

export class PerplexityClient {
  private apiKey: string;
  private baseURL = 'https://api.perplexity.ai';
  private model: string;
  private researchSessions: Map<string, DeepResearchSession> = new Map();
  private queue = getPerplexityQueue();
  private cache = getPerplexityCache();

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.model = process.env.PERPLEXITY_MODEL || 'sonar-pro';

    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is required. Add it to your .env.local file. Get one at https://www.perplexity.ai/settings/api');
    }

    // Validate API key format
    if (!this.apiKey.startsWith('pplx-')) {
      console.warn('[PerplexityClient] API key should start with "pplx-". Current key starts with:', this.apiKey.substring(0, 5));
    }
  }

  async search(
    messages: PerplexityMessage[],
    options?: PerplexitySearchOptions
  ): Promise<PerplexityResponse> {
    // Check cache first
    const cacheKey = this.cache.generateKey(
      messages.map(m => m.content).join('\n'),
      options
    );

    const cached = await this.cache.getOrSet(
      cacheKey,
      async () => this._searchInternal(messages, options),
      {
        ttl: options?.search_mode === 'web' ? 1000 * 60 * 5 : 1000 * 60 * 15, // 5min for web, 15min for academic
        metadata: {
          query: messages[messages.length - 1]?.content || '',
          searchType: options?.search_mode
        }
      }
    );

    return cached.value;
  }

  private async _searchInternal(
    messages: PerplexityMessage[],
    options?: PerplexitySearchOptions
  ): Promise<PerplexityResponse> {
    // Use queue for rate limiting
    return this.queue.add(
      async () => {
        try {
      // Build request body with only valid parameters
      const requestBody: any = {
        model: this.model,
        messages
      };

      // Add optional parameters only if they are provided
      if (options?.search_mode) {
        requestBody.search_mode = options.search_mode;
      }

      if (options?.search_recency_filter) {
        requestBody.search_recency_filter = options.search_recency_filter;
      }

      if (options?.search_domain_filter) {
        requestBody.search_domain_filter = options.search_domain_filter;
      }

      if (options?.return_images !== undefined) {
        requestBody.return_images = options.return_images;
      }

      if (options?.return_related_questions !== undefined) {
        requestBody.return_related_questions = options.return_related_questions;
      }

      console.log('Perplexity API request:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

          return response.data;
        } catch (error: any) {
          console.error('Perplexity API error:', error.response?.data || error);

          // Provide specific guidance for common errors
          if (error.response?.status === 401) {
            console.error('[PerplexityClient] 🔑 AUTHENTICATION ERROR: API key is invalid, expired, or missing permissions.');
            console.error('[PerplexityClient] 💡 Solution: Generate a new API key at https://www.perplexity.ai/account/api/group');
            throw new Error(`Perplexity API authentication failed. Please check your API key and account status.`);
          } else if (error.response?.status === 403) {
            console.error('[PerplexityClient] 🚫 PERMISSION ERROR: API key lacks permission for this model or feature.');
            throw new Error(`Perplexity API permission denied. Check your account plan and model access.`);
          } else if (error.response?.status === 429) {
            console.error('[PerplexityClient] ⏱️ RATE LIMIT ERROR: Too many requests. Please wait and try again.');
            throw new Error(`Perplexity API rate limit exceeded. Please wait before making more requests.`);
          }

          throw error;
        }
      },
      { priority: options?.search_mode === 'academic' ? 'high' : 'normal', maxRetries: 3 }
    );
  }

  // Deep Research Methods
  async startDeepResearch(
    topic: string,
    options?: {
      depth?: 'surface' | 'moderate' | 'deep';
      timeLimit?: number;
      focusAreas?: string[];
    }
  ): Promise<DeepResearchSession> {
    const sessionId = `deep_research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: DeepResearchSession = {
      sessionId,
      topic,
      status: 'active',
      currentPhase: 'initializing',
      progress: 0,
      startedAt: new Date(),
      lastUpdated: new Date()
    };

    this.researchSessions.set(sessionId, session);

    // Initial research prompt
    const systemPrompt = `You are conducting deep, comprehensive research on "${topic}".
Depth level: ${options?.depth || 'deep'}
${options?.focusAreas ? `Focus areas: ${options.focusAreas.join(', ')}` : ''}
${options?.timeLimit ? `Time limit: ${options.timeLimit} minutes` : ''}

Provide thorough, well-sourced analysis with citations.`;

    // Start initial search
    await this.search(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Begin comprehensive research on: ${topic}` }
      ],
      {
        search_mode: 'web',
        return_related_questions: true,
        return_images: false
      }
    );

    return session;
  }

  async continueDeepResearch(
    sessionId: string,
    phase: string,
    previousFindings?: string[]
  ): Promise<PerplexityResponse> {
    const session = this.researchSessions.get(sessionId);
    if (!session) {
      throw new Error(`Research session ${sessionId} not found`);
    }

    session.currentPhase = phase;
    session.lastUpdated = new Date();

    const phasePrompt = this.getPhasePrompt(phase, session.topic, previousFindings);

    return this.search(
      [
        { role: 'system', content: 'You are continuing deep research. Build upon previous findings.' },
        { role: 'user', content: phasePrompt }
      ],
      {
        search_mode: phase === 'academic_validation' ? 'academic' : 'web',
        return_related_questions: true
      }
    );
  }

  getResearchSession(sessionId: string): DeepResearchSession | undefined {
    return this.researchSessions.get(sessionId);
  }

  updateResearchProgress(sessionId: string, progress: number): void {
    const session = this.researchSessions.get(sessionId);
    if (session) {
      session.progress = progress;
      session.lastUpdated = new Date();
    }
  }

  completeResearchSession(sessionId: string): void {
    const session = this.researchSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.progress = 100;
      session.lastUpdated = new Date();
    }
  }

  private getPhasePrompt(phase: string, topic: string, previousFindings?: string[]): string {
    const phasePrompts: Record<string, string> = {
      'deep_dive': `Conduct deep dive research on specific aspects of "${topic}".
${previousFindings ? `Previous findings:\n${previousFindings.join('\n')}\n\nExplore areas not yet covered.` : ''}`,

      'cross_validation': `Cross-validate and fact-check the following findings about "${topic}":
${previousFindings?.join('\n')}
Look for contradictions, verify claims, and assess source reliability.`,

      'academic_validation': `Find academic and authoritative sources to validate research on "${topic}".
Focus on peer-reviewed papers, official reports, and expert opinions.`,

      'synthesis': `Synthesize all research findings about "${topic}" into coherent insights.
${previousFindings ? `Key findings to integrate:\n${previousFindings.join('\n')}` : ''}
Identify patterns, draw conclusions, and highlight important discoveries.`,

      'gap_analysis': `Identify knowledge gaps and areas for future research regarding "${topic}".
What questions remain unanswered? What contradictions exist? What needs further investigation?`
    };

    return phasePrompts[phase] || `Continue researching "${topic}" in the ${phase} phase.`;
  }

  async streamSearch(
    messages: PerplexityMessage[],
    options?: PerplexitySearchOptions & { model?: string; reasoning_effort?: number },
    onChunk?: (chunk: string) => void
  ): Promise<void> {
    console.log('[PerplexityClient] ============ STARTING STREAM SEARCH ============');
    console.log('[PerplexityClient] API Key available:', !!this.apiKey);
    console.log('[PerplexityClient] Default model:', this.model);
    console.log('[PerplexityClient] Messages count:', messages.length);
    console.log('[PerplexityClient] Options:', JSON.stringify(options, null, 2));

    // Build request body with only valid parameters
    const requestBody: any = {
      model: options?.model || this.model,
      messages,
      stream: true
    };

    console.log('[PerplexityClient] Initial request body:', JSON.stringify(requestBody, null, 2));

    // Add optional parameters only if they are provided
    if (options?.search_mode) {
      requestBody.search_mode = options.search_mode;
    }

    if (options?.search_recency_filter) {
      requestBody.search_recency_filter = options.search_recency_filter;
    }

    if (options?.search_domain_filter) {
      requestBody.search_domain_filter = options.search_domain_filter;
    }

    if (options?.return_images !== undefined) {
      requestBody.return_images = options.return_images;
    }

    if (options?.return_related_questions !== undefined) {
      requestBody.return_related_questions = options.return_related_questions;
    }

    // Add reasoning_effort for sonar-deep-research model
    if (options?.reasoning_effort !== undefined && requestBody.model === 'sonar-deep-research') {
      requestBody.reasoning_effort = options.reasoning_effort;
      console.log('[PerplexityClient] Added reasoning_effort:', options.reasoning_effort);
    }

    console.log('[PerplexityClient] Final request body:', JSON.stringify(requestBody, null, 2));
    console.log('[PerplexityClient] Making request to:', `${this.baseURL}/chat/completions`);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('[PerplexityClient] Response status:', response.status);
    console.log('[PerplexityClient] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const error = await response.text();
      console.error('[PerplexityClient] *** PERPLEXITY API ERROR ***:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        requestBody: requestBody
      });

      // Provide specific guidance for common errors
      if (response.status === 401) {
        console.error('[PerplexityClient] 🔑 AUTHENTICATION ERROR: API key is invalid, expired, or missing permissions.');
        console.error('[PerplexityClient] 💡 Solution: Generate a new API key at https://www.perplexity.ai/account/api/group');
        throw new Error(`Perplexity API authentication failed. Please check your API key and account status.`);
      } else if (response.status === 403) {
        console.error('[PerplexityClient] 🚫 PERMISSION ERROR: API key lacks permission for this model or feature.');
        throw new Error(`Perplexity API permission denied. Check your account plan and model access.`);
      } else if (response.status === 429) {
        console.error('[PerplexityClient] ⏱️ RATE LIMIT ERROR: Too many requests. Please wait and try again.');
        throw new Error(`Perplexity API rate limit exceeded. Please wait before making more requests.`);
      }

      throw new Error(`Perplexity API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    console.log('[PerplexityClient] Starting to read stream...');
    let chunkCount = 0;

    while (reader) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[PerplexityClient] Stream reading completed, total chunks:', chunkCount);
        break;
      }

      const chunk = decoder.decode(value);
      chunkCount++;
      console.log('[PerplexityClient] Received chunk', chunkCount, ':', chunk.substring(0, 100) + '...');

      if (onChunk) onChunk(chunk);
    }
  }
}
