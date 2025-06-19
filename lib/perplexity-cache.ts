import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';

export interface CacheEntry {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  metadata?: {
    query: string;
    searchType?: string;
    sources?: number;
    cached?: boolean;
  };
}

export interface CacheOptions {
  maxSize?: number;
  maxAge?: number; // milliseconds
  staleWhileRevalidate?: number; // milliseconds
  updateAgeOnGet?: boolean;
  dispose?: (value: CacheEntry, key: string) => void;
}

export class PerplexityCache {
  private cache: LRUCache<string, CacheEntry>;
  private pendingRevalidations: Map<string, Promise<any>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    revalidations: 0,
    evictions: 0
  };

  constructor(options: CacheOptions = {}) {
    this.cache = new LRUCache<string, CacheEntry>({
      max: options.maxSize ?? 500,
      ttl: options.maxAge ?? 1000 * 60 * 15, // 15 minutes default
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      dispose: (value, key) => {
        this.stats.evictions++;
        if (options.dispose) {
          options.dispose(value, key);
        }
      }
    });
  }

  /**
   * Generate a cache key from query and options
   */
  generateKey(query: string, options?: any): string {
    const normalized = {
      query: query.toLowerCase().trim(),
      ...this.normalizeOptions(options)
    };
    
    const hash = createHash('sha256');
    hash.update(JSON.stringify(normalized));
    return hash.digest('hex');
  }

  /**
   * Get a value from cache
   */
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    
    if (entry) {
      entry.hits++;
      this.stats.hits++;
      
      // Check if stale
      if (this.isStale(entry)) {
        // Return stale value while revalidating in background
        this.revalidateInBackground(key, entry);
      }
      
      return entry;
    }
    
    this.stats.misses++;
    return undefined;
  }

  /**
   * Set a value in cache
   */
  set(
    key: string,
    value: any,
    options?: {
      ttl?: number;
      metadata?: CacheEntry['metadata'];
    }
  ): void {
    const ttl = options?.ttl ?? this.cache.ttl;
    const now = new Date();
    
    const entry: CacheEntry = {
      key,
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      hits: 0,
      metadata: options?.metadata
    };

    this.cache.set(key, entry);
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: {
      ttl?: number;
      metadata?: CacheEntry['metadata'];
      forceRefresh?: boolean;
    }
  ): Promise<{ value: T; cached: boolean }> {
    if (!options?.forceRefresh) {
      const cached = this.get(key);
      if (cached) {
        return { value: cached.value, cached: true };
      }
    }

    // Check if already fetching
    const pending = this.pendingRevalidations.get(key);
    if (pending) {
      const value = await pending;
      return { value, cached: false };
    }

    // Fetch new value
    const promise = factory();
    this.pendingRevalidations.set(key, promise);

    try {
      const value = await promise;
      this.set(key, value, options);
      return { value, cached: false };
    } finally {
      this.pendingRevalidations.delete(key);
    }
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.pendingRevalidations.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = new Date();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get cache entries matching a pattern
   */
  findByPattern(pattern: RegExp): CacheEntry[] {
    const results: CacheEntry[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (pattern.test(entry.metadata?.query || '')) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Warm the cache with predefined queries
   */
  async warmCache(
    queries: Array<{
      query: string;
      options?: any;
      factory: () => Promise<any>;
    }>
  ): Promise<void> {
    const promises = queries.map(({ query, options, factory }) => {
      const key = this.generateKey(query, options);
      return this.getOrSet(key, factory, {
        metadata: { query }
      });
    });

    await Promise.all(promises);
  }

  private isStale(entry: CacheEntry): boolean {
    return entry.expiresAt < new Date();
  }

  private async revalidateInBackground(key: string, entry: CacheEntry): Promise<void> {
    // Don't revalidate if already in progress
    if (this.pendingRevalidations.has(key)) {
      return;
    }

    this.stats.revalidations++;
    
    // Note: The actual revalidation logic would need to be passed in
    // This is a placeholder for the pattern
    console.log(`Background revalidation needed for key: ${key}`);
  }

  private normalizeOptions(options?: any): any {
    if (!options) return {};

    // Sort object keys for consistent hashing
    const normalized: any = {};
    const keys = Object.keys(options).sort();

    for (const key of keys) {
      const value = options[key];
      
      // Skip undefined values
      if (value === undefined) continue;

      // Normalize arrays
      if (Array.isArray(value)) {
        normalized[key] = [...value].sort();
      } else if (typeof value === 'object' && value !== null) {
        normalized[key] = this.normalizeOptions(value);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  /**
   * Export cache data for persistence
   */
  export(): Array<[string, CacheEntry]> {
    return Array.from(this.cache.entries());
  }

  /**
   * Import cache data from persistence
   */
  import(data: Array<[string, CacheEntry]>): void {
    const now = new Date();
    
    for (const [key, entry] of data) {
      // Only import non-expired entries
      if (entry.expiresAt > now) {
        this.cache.set(key, entry);
      }
    }
  }
}

// Singleton instance
let cacheInstance: PerplexityCache | null = null;

export function getPerplexityCache(options?: CacheOptions): PerplexityCache {
  if (!cacheInstance) {
    cacheInstance = new PerplexityCache(options);
  }
  return cacheInstance;
}

// Helper function to create a cache key from a message
export function createCacheKeyFromMessage(
  message: string,
  options?: {
    searchMode?: string;
    searchRecencyFilter?: string;
    searchDomainFilter?: string[];
  }
): string {
  const cache = getPerplexityCache();
  return cache.generateKey(message, options);
}