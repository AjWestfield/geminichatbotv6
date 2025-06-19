import { z } from 'zod';
import { getPerplexityQueue } from './perplexity-queue';
import { getPerplexityCache } from './perplexity-cache';

// Types for Perplexity Async API
export const AsyncJobSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  createdAt: z.string().or(z.date()),
  estimatedDuration: z.number().optional(),
  response: z.any().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export type AsyncJob = z.infer<typeof AsyncJobSchema>;

export const DeepResearchOptionsSchema = z.object({
  model: z.literal('sonar-deep-research').default('sonar-deep-research'),
  reasoningEffort: z.enum(['low', 'medium', 'high']).default('high'),
  searchDomain: z.string().optional(),
  searchRecency: z.string().optional(),
  returnRelatedQuestions: z.boolean().default(true),
  returnSearchResults: z.boolean().default(true),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().default(8192)
});

export type DeepResearchOptions = z.infer<typeof DeepResearchOptionsSchema>;

export const ChatCompletionRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
  })),
  options: DeepResearchOptionsSchema.optional()
});

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

const PERPLEXITY_API_BASE = 'https://api.perplexity.ai';
const ASYNC_POLL_INTERVAL = 4000; // 4 seconds
const ASYNC_MAX_POLLS = 450; // 30 minutes max

export class PerplexityAsyncClient {
  private apiKey: string;
  private abortControllers: Map<string, AbortController> = new Map();
  private queue = getPerplexityQueue();
  private cache = getPerplexityCache();
  private connectionPool: Map<string, Promise<any>> = new Map();
  private maxPoolSize = 5;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Perplexity API key not found. Set PPLX_API_KEY or PERPLEXITY_API_KEY in environment.');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${PERPLEXITY_API_BASE}${endpoint}`;
    
    // Implement retry logic with exponential backoff
    let lastError: Error | null = null;
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          const error = await response.text();
          
          // Check for rate limit
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
            console.log(`Rate limited. Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw new Error(`Perplexity API error (${response.status}): ${error}`);
        }

        const data = await response.json();
        return schema.parse(data);
        
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) except rate limits
        if (error instanceof Error && error.message.includes('(4') && !error.message.includes('(429)')) {
          throw error;
        }
        
        // Exponential backoff for other errors
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Request failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Start an async deep research job with caching and queuing
   */
  async startAsyncJob(
    query: string,
    options: Partial<DeepResearchOptions> = {}
  ): Promise<AsyncJob> {
    // Check cache first
    const cacheKey = this.cache.generateKey(query, options);
    const cached = await this.cache.getOrSet(
      cacheKey,
      async () => this._startAsyncJobInternal(query, options),
      {
        ttl: 1000 * 60 * 30, // 30 minutes for deep research
        metadata: { query, searchType: 'deep-research' }
      }
    );

    return cached.value;
  }

  private async _startAsyncJobInternal(
    query: string,
    options: Partial<DeepResearchOptions> = {}
  ): Promise<AsyncJob> {
    const validatedOptions = DeepResearchOptionsSchema.parse({
      ...options,
      model: 'sonar-deep-research'
    });

    const controller = new AbortController();
    const tempJobId = `temp_${Date.now()}`;
    this.abortControllers.set(tempJobId, controller);

    // Use queue for rate limiting
    const response = await this.queue.add(
      () => this.makeRequest(
        '/chat/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            model: validatedOptions.model,
            messages: [{ role: 'user', content: query }],
            ...validatedOptions,
            stream: false,
            async: true // Enable async mode
          }),
          signal: controller.signal
        },
        z.object({
          id: z.string(),
          status: z.string().optional(),
          created_at: z.string().optional()
        })
      ),
      { priority: 'high', maxRetries: 3 }
    );

    try {
      const job: AsyncJob = {
        jobId: response.id,
        status: 'queued',
        createdAt: response.created_at || new Date().toISOString(),
        metadata: { query, options: validatedOptions }
      };

      // Update controller mapping with real job ID
      this.abortControllers.delete(tempJobId);
      this.abortControllers.set(job.jobId, controller);

      return job;
    } catch (error) {
      this.abortControllers.delete(tempJobId);
      throw error;
    }
  }

  /**
   * Poll an async job for status and results
   */
  async pollAsyncJob(jobId: string): Promise<AsyncJob> {
    const response = await this.makeRequest(
      `/chat/completions/${jobId}`,
      {
        method: 'GET'
      },
      z.object({
        id: z.string(),
        status: z.enum(['queued', 'processing', 'completed', 'failed']),
        created_at: z.string().optional(),
        completed_at: z.string().optional(),
        choices: z.array(z.object({
          message: z.object({
            content: z.string(),
            role: z.string()
          }),
          search_results: z.any().optional()
        })).optional(),
        error: z.object({
          message: z.string(),
          type: z.string().optional()
        }).optional()
      })
    );

    const job: AsyncJob = {
      jobId: response.id,
      status: response.status,
      createdAt: response.created_at || new Date().toISOString()
    };

    if (response.status === 'completed' && response.choices?.[0]) {
      job.response = {
        content: response.choices[0].message.content,
        searchResults: response.choices[0].search_results,
        completedAt: response.completed_at
      };
    }

    if (response.status === 'failed' && response.error) {
      job.error = response.error.message;
    }

    return job;
  }

  /**
   * Cancel an async job
   */
  async cancelAsyncJob(jobId: string): Promise<void> {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(jobId);
    }

    try {
      await this.makeRequest(
        `/chat/completions/${jobId}`,
        {
          method: 'DELETE'
        },
        z.object({ success: z.boolean() })
      );
    } catch (error) {
      // Ignore errors on cancel
      console.warn(`Failed to cancel job ${jobId}:`, error);
    }
  }

  /**
   * Wait for an async job to complete with automatic polling
   */
  async waitForCompletion(
    jobId: string,
    options: {
      pollInterval?: number;
      maxPolls?: number;
      onProgress?: (job: AsyncJob) => void;
    } = {}
  ): Promise<AsyncJob> {
    const {
      pollInterval = ASYNC_POLL_INTERVAL,
      maxPolls = ASYNC_MAX_POLLS,
      onProgress
    } = options;

    let polls = 0;

    while (polls < maxPolls) {
      const job = await this.pollAsyncJob(jobId);
      
      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'completed' || job.status === 'failed') {
        this.abortControllers.delete(jobId);
        return job;
      }

      polls++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job ${jobId} timed out after ${maxPolls * pollInterval / 1000} seconds`);
  }

  /**
   * Cleanup any active abort controllers and resources
   */
  cleanup(): void {
    for (const [jobId, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.connectionPool.clear();
    this.queue.destroy();
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    return this.queue.getQueueStatus();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(queries: string[]): Promise<void> {
    const warmupPromises = queries.map(query => ({
      query,
      factory: () => this._startAsyncJobInternal(query, { reasoningEffort: 'medium' })
    }));

    await this.cache.warmCache(warmupPromises);
  }
}

// Singleton instance
let clientInstance: PerplexityAsyncClient | null = null;

export function getPerplexityClient(): PerplexityAsyncClient {
  if (!clientInstance) {
    clientInstance = new PerplexityAsyncClient();
  }
  return clientInstance;
}