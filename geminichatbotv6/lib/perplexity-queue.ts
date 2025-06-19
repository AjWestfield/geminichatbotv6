import { EventEmitter } from 'events';

export interface QueuedRequest<T = any> {
  id: string;
  priority: 'high' | 'normal' | 'low';
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
}

export interface QueueOptions {
  maxConcurrent?: number;
  maxQueueSize?: number;
  requestTimeout?: number;
  retryDelay?: number;
  retryBackoff?: number;
  rateLimitPerMinute?: number;
}

export class PerplexityRequestQueue extends EventEmitter {
  private queue: Map<string, QueuedRequest> = new Map();
  private processing: Map<string, QueuedRequest> = new Map();
  private completed: Map<string, QueuedRequest> = new Map();
  private requestTimestamps: number[] = [];
  
  private options: Required<QueueOptions>;
  private isProcessing = false;

  constructor(options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      maxQueueSize: options.maxQueueSize ?? 100,
      requestTimeout: options.requestTimeout ?? 60000, // 60 seconds
      retryDelay: options.retryDelay ?? 1000, // 1 second
      retryBackoff: options.retryBackoff ?? 2,
      rateLimitPerMinute: options.rateLimitPerMinute ?? 20
    };
  }

  async add<T>(
    request: () => Promise<T>,
    options: {
      priority?: QueuedRequest['priority'];
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const id = this.generateId();
    const { priority = 'normal', maxRetries = 3 } = options;

    // Check queue size limit
    if (this.queue.size >= this.options.maxQueueSize) {
      throw new Error('Queue is full');
    }

    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id,
        priority,
        request,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        createdAt: new Date()
      };

      this.queue.set(id, queuedRequest);
      this.emit('queued', { id, priority, queueSize: this.queue.size });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }
    });
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.size > 0 || this.processing.size > 0) {
      // Check if we can process more requests
      if (this.processing.size < this.options.maxConcurrent && this.queue.size > 0) {
        // Check rate limit
        if (this.isRateLimited()) {
          await this.waitForRateLimit();
          continue;
        }

        // Get next request by priority
        const nextRequest = this.getNextRequest();
        if (nextRequest) {
          this.processRequest(nextRequest);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  private async processRequest<T>(queuedRequest: QueuedRequest<T>): Promise<void> {
    const { id } = queuedRequest;
    
    // Move from queue to processing
    this.queue.delete(id);
    this.processing.set(id, queuedRequest);
    queuedRequest.startedAt = new Date();

    // Track request timestamp for rate limiting
    this.requestTimestamps.push(Date.now());
    this.cleanOldTimestamps();

    this.emit('processing', { 
      id, 
      processingCount: this.processing.size,
      queueSize: this.queue.size 
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.options.requestTimeout);
      });

      // Race between request and timeout
      const result = await Promise.race([
        queuedRequest.request(),
        timeoutPromise
      ]);

      // Success
      queuedRequest.completedAt = new Date();
      this.processing.delete(id);
      this.completed.set(id, queuedRequest);
      queuedRequest.resolve(result);

      this.emit('completed', { 
        id, 
        duration: queuedRequest.completedAt.getTime() - queuedRequest.startedAt!.getTime() 
      });

      // Clean up old completed requests
      this.cleanupCompleted();

    } catch (error) {
      // Handle error
      queuedRequest.error = error as Error;
      queuedRequest.retries++;

      if (queuedRequest.retries < queuedRequest.maxRetries) {
        // Retry with exponential backoff
        const delay = this.options.retryDelay * Math.pow(this.options.retryBackoff, queuedRequest.retries - 1);
        
        this.emit('retry', { 
          id, 
          attempt: queuedRequest.retries,
          maxRetries: queuedRequest.maxRetries,
          delay 
        });

        // Move back to queue after delay
        this.processing.delete(id);
        setTimeout(() => {
          this.queue.set(id, queuedRequest);
          if (!this.isProcessing) {
            this.startProcessing();
          }
        }, delay);

      } else {
        // Max retries reached
        this.processing.delete(id);
        this.completed.set(id, queuedRequest);
        queuedRequest.reject(error);

        this.emit('failed', { 
          id, 
          error: error instanceof Error ? error.message : 'Unknown error',
          retries: queuedRequest.retries 
        });
      }
    }
  }

  private getNextRequest(): QueuedRequest | null {
    // Sort by priority and creation time
    const priorities: QueuedRequest['priority'][] = ['high', 'normal', 'low'];
    
    for (const priority of priorities) {
      const requests = Array.from(this.queue.values())
        .filter(r => r.priority === priority)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (requests.length > 0) {
        return requests[0];
      }
    }

    return null;
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    return recentRequests.length >= this.options.rateLimitPerMinute;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oldestRequest = this.requestTimestamps.find(ts => ts > oneMinuteAgo);
    
    if (oldestRequest) {
      const waitTime = 60000 - (now - oldestRequest) + 1000; // Add 1 second buffer
      this.emit('rateLimited', { waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private cleanOldTimestamps(): void {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
  }

  private cleanupCompleted(): void {
    // Keep only last 100 completed requests
    if (this.completed.size > 100) {
      const sorted = Array.from(this.completed.entries())
        .sort((a, b) => b[1].completedAt!.getTime() - a[1].completedAt!.getTime());
      
      const toKeep = sorted.slice(0, 100);
      this.completed.clear();
      toKeep.forEach(([id, request]) => this.completed.set(id, request));
    }
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for monitoring
  getQueueStatus() {
    return {
      queued: this.queue.size,
      processing: this.processing.size,
      completed: this.completed.size,
      requestsPerMinute: this.requestTimestamps.length
    };
  }

  getRequest(id: string): QueuedRequest | undefined {
    return this.queue.get(id) || this.processing.get(id) || this.completed.get(id);
  }

  cancel(id: string): boolean {
    const request = this.queue.get(id);
    if (request) {
      this.queue.delete(id);
      request.reject(new Error('Request cancelled'));
      this.emit('cancelled', { id });
      return true;
    }
    return false;
  }

  clear(): void {
    // Cancel all queued requests
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue.clear();
    this.emit('cleared', { count: this.queue.size });
  }

  destroy(): void {
    this.clear();
    this.removeAllListeners();
    this.isProcessing = false;
  }
}

// Singleton instance
let queueInstance: PerplexityRequestQueue | null = null;

export function getPerplexityQueue(options?: QueueOptions): PerplexityRequestQueue {
  if (!queueInstance) {
    queueInstance = new PerplexityRequestQueue(options);
  }
  return queueInstance;
}