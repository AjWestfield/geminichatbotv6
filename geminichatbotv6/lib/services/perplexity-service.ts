import { PerplexityClient, PerplexityMessage, PerplexitySearchOptions, PerplexityResponse } from '../perplexity-client';
import { PerplexityAsyncClient, AsyncJob, DeepResearchOptions } from '../perplexity-async-client';
import { SearchIntentDetector } from '../search-intent-detector';
import { getPerplexityQueue } from '../perplexity-queue';
import { getPerplexityCache } from '../perplexity-cache';
import { EventEmitter } from 'events';

export interface UnifiedSearchOptions extends PerplexitySearchOptions {
  forceAsync?: boolean;
  forceSync?: boolean;
  priority?: 'high' | 'normal' | 'low';
  cacheTTL?: number;
  streamResults?: boolean;
}

export interface SearchResult {
  type: 'sync' | 'async';
  jobId?: string;
  response?: PerplexityResponse;
  asyncJob?: AsyncJob;
  cached: boolean;
  searchIntent?: any;
}

export interface StreamingOptions {
  onContent?: (content: string) => void;
  onMetadata?: (metadata: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class UnifiedPerplexityService extends EventEmitter {
  private syncClient: PerplexityClient;
  private asyncClient: PerplexityAsyncClient;
  private intentDetector: SearchIntentDetector;
  private queue = getPerplexityQueue();
  private cache = getPerplexityCache();
  
  // Thresholds for auto-detection
  private readonly ASYNC_QUERY_LENGTH = 200; // Characters
  private readonly ASYNC_KEYWORDS = [
    'comprehensive', 'detailed', 'thorough', 'in-depth',
    'research', 'analysis', 'investigation', 'deep dive'
  ];

  constructor() {
    super();
    this.syncClient = new PerplexityClient();
    this.asyncClient = new PerplexityAsyncClient();
    this.intentDetector = new SearchIntentDetector();
    
    // Forward queue events
    this.queue.on('queued', (data) => this.emit('queued', data));
    this.queue.on('processing', (data) => this.emit('processing', data));
    this.queue.on('completed', (data) => this.emit('completed', data));
    this.queue.on('failed', (data) => this.emit('failed', data));
    this.queue.on('rateLimited', (data) => this.emit('rateLimited', data));
  }

  /**
   * Unified search method that automatically chooses sync or async
   */
  async search(
    messages: PerplexityMessage[],
    options: UnifiedSearchOptions = {}
  ): Promise<SearchResult> {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage?.content || '';
    
    // Detect search intent
    const searchIntent = this.intentDetector.detectSearchIntent(query);
    
    // Determine if async is needed
    const shouldUseAsync = this.shouldUseAsync(query, options);
    
    if (shouldUseAsync && !options.forceSync) {
      return this.performAsyncSearch(query, options);
    } else if (!options.forceAsync) {
      return this.performSyncSearch(messages, options, searchIntent);
    } else {
      return this.performAsyncSearch(query, options);
    }
  }

  /**
   * Stream search results progressively
   */
  async streamSearch(
    messages: PerplexityMessage[],
    options: UnifiedSearchOptions = {},
    streamingOptions: StreamingOptions = {}
  ): Promise<void> {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage?.content || '';
    
    // Check cache first
    const cacheKey = this.cache.generateKey(query, options);
    const cached = this.cache.get(cacheKey);
    
    if (cached && streamingOptions.onContent) {
      // Stream cached content
      const content = cached.value?.choices?.[0]?.message?.content || '';
      const chunks = this.chunkContent(content);
      
      for (const chunk of chunks) {
        streamingOptions.onContent(chunk);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming
      }
      
      if (streamingOptions.onMetadata && cached.value) {
        streamingOptions.onMetadata({
          cached: true,
          searchResults: cached.value.search_results,
          images: cached.value.images,
          relatedQuestions: cached.value.related_questions
        });
      }
      
      if (streamingOptions.onComplete) {
        streamingOptions.onComplete();
      }
      
      return;
    }
    
    // Perform streaming search
    try {
      await this.syncClient.streamSearch(
        messages,
        options,
        (chunk) => {
          // Parse SSE chunk and forward to callbacks
          this.parseAndForwardChunk(chunk, streamingOptions);
        }
      );
      
      if (streamingOptions.onComplete) {
        streamingOptions.onComplete();
      }
    } catch (error) {
      if (streamingOptions.onError) {
        streamingOptions.onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Perform parallel searches for multi-faceted queries
   */
  async parallelSearch(
    queries: Array<{
      messages: PerplexityMessage[];
      options?: UnifiedSearchOptions;
    }>
  ): Promise<SearchResult[]> {
    const searchPromises = queries.map(({ messages, options }) =>
      this.search(messages, options)
    );
    
    return Promise.all(searchPromises);
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(query: string): Promise<string[]> {
    // This could be enhanced with a suggestion API or ML model
    const suggestions: string[] = [];
    
    // Extract key terms
    const terms = query.toLowerCase().split(' ').filter(term => term.length > 3);
    
    // Generate variations
    if (terms.includes('latest') || terms.includes('current')) {
      suggestions.push(`${query} 2025`);
      suggestions.push(`${query} news`);
      suggestions.push(`${query} updates`);
    }
    
    if (terms.includes('best') || terms.includes('top')) {
      suggestions.push(`${query} comparison`);
      suggestions.push(`${query} reviews`);
      suggestions.push(`${query} recommendations`);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Pre-warm cache with common queries
   */
  async warmCache(queries: string[]): Promise<void> {
    const warmupPromises = queries.map(query => {
      const messages: PerplexityMessage[] = [
        { role: 'user', content: query }
      ];
      
      return this.search(messages, {
        priority: 'low',
        cacheTTL: 1000 * 60 * 60 // 1 hour for pre-warmed queries
      });
    });
    
    await Promise.all(warmupPromises);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      queue: this.queue.getQueueStatus(),
      cache: this.cache.getStats(),
      asyncJobs: {
        total: this.asyncClient.getQueueStatus().completed
      }
    };
  }

  /**
   * Clear all caches and reset state
   */
  clear(): void {
    this.cache.clear();
    this.queue.clear();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clear();
    this.queue.destroy();
    this.asyncClient.cleanup();
    this.removeAllListeners();
  }

  private shouldUseAsync(query: string, options: UnifiedSearchOptions): boolean {
    if (options.forceAsync) return true;
    if (options.forceSync) return false;
    
    // Check query length
    if (query.length > this.ASYNC_QUERY_LENGTH) return true;
    
    // Check for async keywords
    const queryLower = query.toLowerCase();
    const hasAsyncKeyword = this.ASYNC_KEYWORDS.some(keyword => 
      queryLower.includes(keyword)
    );
    if (hasAsyncKeyword) return true;
    
    // Check search mode
    if (options.search_mode === 'academic') return true;
    
    return false;
  }

  private async performSyncSearch(
    messages: PerplexityMessage[],
    options: UnifiedSearchOptions,
    searchIntent: any
  ): Promise<SearchResult> {
    const response = await this.syncClient.search(messages, options);
    
    return {
      type: 'sync',
      response,
      cached: false, // The sync client handles its own caching
      searchIntent
    };
  }

  private async performAsyncSearch(
    query: string,
    options: UnifiedSearchOptions
  ): Promise<SearchResult> {
    const deepResearchOptions: Partial<DeepResearchOptions> = {
      reasoningEffort: options.priority === 'high' ? 'high' : 'medium',
      searchDomain: options.search_domain_filter?.[0],
      searchRecency: options.search_recency_filter,
      returnRelatedQuestions: options.return_related_questions,
      returnSearchResults: true
    };
    
    const asyncJob = await this.asyncClient.startAsyncJob(query, deepResearchOptions);
    
    return {
      type: 'async',
      jobId: asyncJob.jobId,
      asyncJob,
      cached: false // The async client handles its own caching
    };
  }

  private chunkContent(content: string, chunkSize: number = 100): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  private parseAndForwardChunk(chunk: string, streamingOptions: StreamingOptions): void {
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.choices?.[0]?.delta?.content && streamingOptions.onContent) {
            streamingOptions.onContent(parsed.choices[0].delta.content);
          }
          
          if ((parsed.citations || parsed.search_results || parsed.images || parsed.related_questions) && streamingOptions.onMetadata) {
            streamingOptions.onMetadata({
              citations: parsed.citations,
              searchResults: parsed.search_results,
              images: parsed.images,
              relatedQuestions: parsed.related_questions
            });
          }
        } catch (e) {
          console.error('Error parsing chunk:', e);
        }
      }
    }
  }
}

// Singleton instance
let serviceInstance: UnifiedPerplexityService | null = null;

export function getUnifiedPerplexityService(): UnifiedPerplexityService {
  if (!serviceInstance) {
    serviceInstance = new UnifiedPerplexityService();
  }
  return serviceInstance;
}