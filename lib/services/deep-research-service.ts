import { z } from 'zod';
import { PerplexityClient, PerplexityMessage } from '../perplexity-client';
import { PerplexityAsyncClient, DeepResearchOptions } from '../perplexity-async-client';
import { getPerplexityQueue } from '../perplexity-queue';
import { getPerplexityCache } from '../perplexity-cache';
import { EventEmitter } from 'events';

// Deep Research Phase Schema
export const DeepResearchPhaseSchema = z.enum([
  'initializing',
  'gathering_context',
  'deep_analysis',
  'cross_validation',
  'synthesizing',
  'finalizing'
]);

export type DeepResearchPhase = z.infer<typeof DeepResearchPhaseSchema>;

// Deep Research Status Schema
export const DeepResearchStatusSchema = z.object({
  taskId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  phase: DeepResearchPhaseSchema,
  progress: z.number().min(0).max(100),
  startedAt: z.date(),
  updatedAt: z.date(),
  estimatedTimeRemaining: z.number().optional(), // in seconds
  findings: z.array(z.object({
    phase: DeepResearchPhaseSchema,
    content: z.string(),
    sources: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional()
  })).optional(),
  error: z.string().optional()
});

export type DeepResearchStatus = z.infer<typeof DeepResearchStatusSchema>;

// Deep Research Request Options
export interface DeepResearchRequestOptions {
  reasoningEffort?: number; // 1-100, default 75
  depth?: 'surface' | 'moderate' | 'deep'; // maps to reasoning effort
  timeLimit?: number; // in minutes, default 30
  focusAreas?: string[]; // specific aspects to focus on
  excludeDomains?: string[]; // domains to exclude from search
  language?: string; // response language
  streamProgress?: boolean; // stream intermediate findings
}

// Map depth to reasoning effort
const DEPTH_TO_EFFORT: Record<'surface' | 'moderate' | 'deep', number> = {
  surface: 25,
  moderate: 50,
  deep: 90
};

// Phase progress weights (total should be 100)
const PHASE_WEIGHTS: Record<DeepResearchPhase, number> = {
  initializing: 5,
  gathering_context: 20,
  deep_analysis: 35,
  cross_validation: 20,
  synthesizing: 15,
  finalizing: 5
};

export class DeepResearchService extends EventEmitter {
  private syncClient: PerplexityClient;
  private asyncClient: PerplexityAsyncClient;
  private queue = getPerplexityQueue();
  private cache = getPerplexityCache();
  private activeResearch: Map<string, DeepResearchStatus> = new Map();
  
  constructor() {
    console.log('[DeepResearchService] Initializing constructor...');
    super();
    console.log('[DeepResearchService] Creating PerplexityClient...');
    this.syncClient = new PerplexityClient();
    console.log('[DeepResearchService] Creating PerplexityAsyncClient...');
    this.asyncClient = new PerplexityAsyncClient();
    console.log('[DeepResearchService] Constructor completed successfully');
  }

  /**
   * Determine if a query should use async based on complexity
   */
  private shouldUseAsync(query: string, options?: DeepResearchRequestOptions): boolean {
    // Use async for deep research or long time limits
    if (options?.depth === 'deep' || (options?.reasoningEffort && options.reasoningEffort > 70)) {
      return true;
    }
    
    // Use async if time limit is over 5 minutes
    if (options?.timeLimit && options.timeLimit > 5) {
      return true;
    }
    
    // Check query complexity
    const complexityIndicators = [
      /comprehensive\s+analysis/i,
      /detailed\s+research/i,
      /in-depth\s+study/i,
      /thorough\s+investigation/i,
      /compare\s+and\s+contrast/i,
      /historical\s+analysis/i,
      /future\s+predictions/i,
      /multiple\s+perspectives/i
    ];
    
    return complexityIndicators.some(pattern => pattern.test(query));
  }

  /**
   * Calculate reasoning effort based on options
   */
  private calculateReasoningEffort(options?: DeepResearchRequestOptions): number {
    if (options?.reasoningEffort) {
      return Math.min(100, Math.max(1, options.reasoningEffort));
    }
    
    if (options?.depth) {
      return DEPTH_TO_EFFORT[options.depth];
    }
    
    return 75; // Default to high effort for deep research
  }

  /**
   * Start a deep research session
   */
  async startDeepResearch(
    query: string,
    options?: DeepResearchRequestOptions,
    onProgress?: (status: DeepResearchStatus) => void
  ): Promise<{ taskId: string; isAsync: boolean }> {
    const taskId = `deep_research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const reasoningEffort = this.calculateReasoningEffort(options);
    const useAsync = this.shouldUseAsync(query, options);
    
    // Initialize research status
    const status: DeepResearchStatus = {
      taskId,
      status: 'queued',
      phase: 'initializing',
      progress: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
      estimatedTimeRemaining: useAsync ? 300 : 60 // 5 min for async, 1 min for sync
    };
    
    this.activeResearch.set(taskId, status);
    this.emit('research:started', { taskId, query, options });
    
    if (useAsync) {
      // Start async deep research
      this.processAsyncDeepResearch(taskId, query, reasoningEffort, options, onProgress);
    } else {
      // Start sync streaming deep research
      this.processSyncDeepResearch(taskId, query, reasoningEffort, options, onProgress);
    }
    
    return { taskId, isAsync: useAsync };
  }

  /**
   * Process async deep research
   */
  private async processAsyncDeepResearch(
    taskId: string,
    query: string,
    reasoningEffort: number,
    options?: DeepResearchRequestOptions,
    onProgress?: (status: DeepResearchStatus) => void
  ): Promise<void> {
    const status = this.activeResearch.get(taskId);
    if (!status) return;
    
    try {
      // Update status to processing
      this.updateResearchStatus(taskId, {
        status: 'processing',
        phase: 'gathering_context'
      });
      
      // Start async job with Perplexity
      const job = await this.asyncClient.startAsyncJob(query, {
        reasoningEffort: reasoningEffort as any, // Will be converted to 'low' | 'medium' | 'high'
        searchRecency: 'month',
        returnRelatedQuestions: true,
        returnSearchResults: true
      });
      
      // Poll for completion with progress updates
      await this.asyncClient.waitForCompletion(job.jobId, {
        onProgress: (jobUpdate) => {
          // Map job progress to research phases
          const progress = this.mapJobProgressToPhases(jobUpdate);
          this.updateResearchStatus(taskId, progress);
          
          if (onProgress) {
            const currentStatus = this.activeResearch.get(taskId);
            if (currentStatus) onProgress(currentStatus);
          }
        }
      });
      
      // Process final results
      const finalJob = await this.asyncClient.pollAsyncJob(job.jobId);
      if (finalJob.status === 'completed' && finalJob.response) {
        this.updateResearchStatus(taskId, {
          status: 'completed',
          phase: 'finalizing',
          progress: 100,
          findings: [{
            phase: 'finalizing',
            content: finalJob.response.content,
            sources: finalJob.response.searchResults?.map((r: any) => r.url) || [],
            confidence: 0.95
          }]
        });
      } else {
        throw new Error(finalJob.error || 'Deep research failed');
      }
      
    } catch (error) {
      this.updateResearchStatus(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process sync streaming deep research
   */
  private async processSyncDeepResearch(
    taskId: string,
    query: string,
    reasoningEffort: number,
    options?: DeepResearchRequestOptions,
    onProgress?: (status: DeepResearchStatus) => void
  ): Promise<void> {
    const status = this.activeResearch.get(taskId);
    if (!status) return;
    
    try {
      // Update status to processing
      this.updateResearchStatus(taskId, {
        status: 'processing',
        phase: 'gathering_context'
      });
      
      // Build messages for deep research
      const messages: PerplexityMessage[] = [
        {
          role: 'system',
          content: `You are conducting deep, comprehensive research. 
          Reasoning effort level: ${reasoningEffort}/100.
          ${options?.focusAreas ? `Focus areas: ${options.focusAreas.join(', ')}` : ''}
          Provide thorough analysis with citations.`
        },
        {
          role: 'user',
          content: query
        }
      ];
      
      let accumulatedContent = '';
      let currentPhase: DeepResearchPhase = 'gathering_context';
      
      // Stream the research with phase detection
      await this.syncClient.streamSearch(messages, {
        search_mode: 'web',
        return_related_questions: true,
        return_images: false
      }, (chunk) => {
        accumulatedContent += chunk;
        
        // Detect phase transitions based on content markers
        const newPhase = this.detectPhaseFromContent(accumulatedContent);
        if (newPhase !== currentPhase) {
          currentPhase = newPhase;
          const progress = this.calculateProgressFromPhase(currentPhase);
          
          this.updateResearchStatus(taskId, {
            phase: currentPhase,
            progress,
            findings: [{
              phase: currentPhase,
              content: accumulatedContent,
              confidence: 0.85
            }]
          });
          
          if (onProgress) {
            const currentStatus = this.activeResearch.get(taskId);
            if (currentStatus) onProgress(currentStatus);
          }
        }
      });
      
      // Mark as completed
      this.updateResearchStatus(taskId, {
        status: 'completed',
        phase: 'finalizing',
        progress: 100,
        findings: [{
          phase: 'finalizing',
          content: accumulatedContent,
          confidence: 0.9
        }]
      });
      
    } catch (error) {
      this.updateResearchStatus(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Stream deep research results
   */
  async streamDeepResearch(
    query: string,
    options?: DeepResearchRequestOptions,
    callbacks?: {
      onContent?: (content: string) => void;
      onPhaseChange?: (phase: DeepResearchPhase, progress: number) => void;
      onMetadata?: (metadata: any) => void;
      onError?: (error: Error) => void;
      onComplete?: () => void;
    }
  ): Promise<void> {
    console.log('[DeepResearchService] ============ STARTING DEEP RESEARCH ============');
    console.log('[DeepResearchService] Query:', query.substring(0, 200) + '...');
    console.log('[DeepResearchService] Options:', JSON.stringify(options, null, 2));
    console.log('[DeepResearchService] API Key available:', !!process.env.PERPLEXITY_API_KEY);
    
    const reasoningEffort = this.calculateReasoningEffort(options);
    console.log('[DeepResearchService] Calculated reasoning effort:', reasoningEffort);
    
    try {
      // Create system message for deep research
      const systemMessage: PerplexityMessage = {
        role: 'system',
        content: `You are Perplexity's Deep Research Agent using the sonar-deep-research model.
        
        Conduct comprehensive, multi-phase research with reasoning effort: ${reasoningEffort}/100.
        
        Research phases:
        1. Context Gathering - Understand the query and gather initial information
        2. Deep Analysis - Dive deep into specific aspects
        3. Cross Validation - Verify findings across multiple sources
        4. Synthesis - Combine insights into coherent findings
        
        ${options?.focusAreas ? `Focus on: ${options.focusAreas.join(', ')}` : ''}
        ${options?.timeLimit ? `Complete within ${options.timeLimit} minutes` : ''}
        
        Provide citations for all claims and indicate confidence levels.`
      };
      
      const messages: PerplexityMessage[] = [
        systemMessage,
        { role: 'user', content: query }
      ];
      
      let currentPhase: DeepResearchPhase = 'initializing';
      let accumulatedContent = '';
      
      // Configure for sonar-deep-research model with fallback
      const preferredModel = 'sonar-deep-research';
      const fallbackModel = 'sonar-pro'; // Fallback if deep research model is not available
      
      const searchOptions = {
        search_mode: 'web' as const,
        return_related_questions: true,
        return_images: false,
        // Try preferred model first, fallback if not available
        model: preferredModel,
        reasoning_effort: reasoningEffort
      };
      
      console.log('[DeepResearchService] Preferred model:', preferredModel);
      console.log('[DeepResearchService] Fallback model:', fallbackModel);
      
      console.log('[DeepResearchService] Search options:', JSON.stringify(searchOptions, null, 2));
      console.log('[DeepResearchService] Messages to send:', messages.map(m => ({ role: m.role, contentLength: m.content.length })));
      console.log('[DeepResearchService] Starting streamSearch...');
      
      // Try with preferred model first, fallback on error
      try {
        await this.syncClient.streamSearch(messages, searchOptions, (chunk) => {
          console.log('[DeepResearchService] Received chunk:', chunk.substring(0, 100) + '...');
          accumulatedContent += chunk;
          
          // Extract content and metadata
          if (callbacks?.onContent) {
            callbacks.onContent(chunk);
          }
          
          // Detect phase changes
          const detectedPhase = this.detectPhaseFromContent(accumulatedContent);
          if (detectedPhase !== currentPhase) {
            currentPhase = detectedPhase;
            const progress = this.calculateProgressFromPhase(currentPhase);
            
            console.log('[DeepResearchService] Phase change detected:', { from: currentPhase, to: detectedPhase, progress });
            
            if (callbacks?.onPhaseChange) {
              callbacks.onPhaseChange(currentPhase, progress);
            }
          }
          
          // Extract metadata like sources and confidence
          const metadata = this.extractMetadataFromContent(chunk);
          if (metadata && callbacks?.onMetadata) {
            console.log('[DeepResearchService] Metadata extracted:', metadata);
            callbacks.onMetadata(metadata);
          }
        });
      } catch (modelError) {
        console.warn('[DeepResearchService] Preferred model failed, trying fallback:', {
          preferredModel,
          fallbackModel,
          error: modelError instanceof Error ? modelError.message : String(modelError)
        });
        
        // Try with fallback model
        const fallbackOptions = { ...searchOptions, model: fallbackModel };
        // Remove reasoning_effort for fallback model as it might not support it
        delete fallbackOptions.reasoning_effort;
        
        console.log('[DeepResearchService] Retrying with fallback options:', JSON.stringify(fallbackOptions, null, 2));
        
        await this.syncClient.streamSearch(messages, fallbackOptions, (chunk) => {
          console.log('[DeepResearchService] [Fallback] Received chunk:', chunk.substring(0, 100) + '...');
          accumulatedContent += chunk;
          
          // Extract content and metadata
          if (callbacks?.onContent) {
            callbacks.onContent(chunk);
          }
          
          // Detect phase changes
          const detectedPhase = this.detectPhaseFromContent(accumulatedContent);
          if (detectedPhase !== currentPhase) {
            currentPhase = detectedPhase;
            const progress = this.calculateProgressFromPhase(currentPhase);
            
            console.log('[DeepResearchService] [Fallback] Phase change detected:', { from: currentPhase, to: detectedPhase, progress });
            
            if (callbacks?.onPhaseChange) {
              callbacks.onPhaseChange(currentPhase, progress);
            }
          }
          
          // Extract metadata like sources and confidence
          const metadata = this.extractMetadataFromContent(chunk);
          if (metadata && callbacks?.onMetadata) {
            console.log('[DeepResearchService] [Fallback] Metadata extracted:', metadata);
            callbacks.onMetadata(metadata);
          }
        });
      }
      
      console.log('[DeepResearchService] Deep research stream completed successfully');
      
      if (callbacks?.onComplete) {
        callbacks.onComplete();
      }
      
    } catch (error) {
      console.error('[DeepResearchService] *** DEEP RESEARCH ERROR ***:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: query.substring(0, 100) + '...',
        options
      });
      
      if (callbacks?.onError) {
        callbacks.onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * Get current status of a research task
   */
  getResearchStatus(taskId: string): DeepResearchStatus | undefined {
    return this.activeResearch.get(taskId);
  }

  /**
   * Cancel an ongoing research task
   */
  async cancelResearch(taskId: string): Promise<void> {
    const status = this.activeResearch.get(taskId);
    if (!status) return;
    
    this.updateResearchStatus(taskId, {
      status: 'cancelled'
    });
    
    // If it's an async task, cancel with the async client
    if (status.status === 'processing') {
      try {
        await this.asyncClient.cancelAsyncJob(taskId);
      } catch (error) {
        console.warn('Failed to cancel async job:', error);
      }
    }
    
    this.emit('research:cancelled', { taskId });
  }

  /**
   * Update research status
   */
  private updateResearchStatus(taskId: string, updates: Partial<DeepResearchStatus>): void {
    const current = this.activeResearch.get(taskId);
    if (!current) return;
    
    const updated: DeepResearchStatus = {
      ...current,
      ...updates,
      updatedAt: new Date()
    };
    
    this.activeResearch.set(taskId, updated);
    this.emit('research:progress', updated);
  }

  /**
   * Map async job progress to research phases
   */
  private mapJobProgressToPhases(job: any): Partial<DeepResearchStatus> {
    // Estimate phase based on time elapsed
    const elapsed = Date.now() - new Date(job.createdAt).getTime();
    const estimatedTotal = 300000; // 5 minutes
    const progress = Math.min(95, (elapsed / estimatedTotal) * 100);
    
    let phase: DeepResearchPhase = 'initializing';
    if (progress < 5) phase = 'initializing';
    else if (progress < 25) phase = 'gathering_context';
    else if (progress < 60) phase = 'deep_analysis';
    else if (progress < 80) phase = 'cross_validation';
    else if (progress < 95) phase = 'synthesizing';
    else phase = 'finalizing';
    
    return { phase, progress };
  }

  /**
   * Detect research phase from content markers
   */
  private detectPhaseFromContent(content: string): DeepResearchPhase {
    const phaseMarkers = {
      gathering_context: /gathering\s+context|initial\s+research|understanding\s+query/i,
      deep_analysis: /deep\s+analysis|detailed\s+examination|diving\s+deeper/i,
      cross_validation: /cross[\s-]validation|verifying\s+findings|checking\s+sources/i,
      synthesizing: /synthesizing|combining\s+insights|drawing\s+conclusions/i,
      finalizing: /final\s+thoughts|conclusion|summary\s+of\s+findings/i
    };
    
    for (const [phase, pattern] of Object.entries(phaseMarkers)) {
      if (pattern.test(content)) {
        return phase as DeepResearchPhase;
      }
    }
    
    return 'gathering_context';
  }

  /**
   * Calculate progress percentage from phase
   */
  private calculateProgressFromPhase(phase: DeepResearchPhase): number {
    const phases: DeepResearchPhase[] = [
      'initializing',
      'gathering_context',
      'deep_analysis',
      'cross_validation',
      'synthesizing',
      'finalizing'
    ];
    
    let progress = 0;
    for (const p of phases) {
      if (p === phase) break;
      progress += PHASE_WEIGHTS[p];
    }
    
    // Add half of current phase weight
    progress += PHASE_WEIGHTS[phase] / 2;
    
    return Math.min(95, progress);
  }

  /**
   * Extract metadata from streamed content
   */
  private extractMetadataFromContent(content: string): any {
    const metadata: any = {};
    
    // Extract citations
    const citationPattern = /\[(\d+)\]\s*([^\n]+)/g;
    const citations = [];
    let match;
    while ((match = citationPattern.exec(content)) !== null) {
      citations.push({
        id: match[1],
        text: match[2]
      });
    }
    if (citations.length > 0) {
      metadata.citations = citations;
    }
    
    // Extract confidence indicators
    const confidencePattern = /confidence:\s*(\d+(?:\.\d+)?%?)/i;
    const confidenceMatch = content.match(confidencePattern);
    if (confidenceMatch) {
      metadata.confidence = parseFloat(confidenceMatch[1].replace('%', '')) / 100;
    }
    
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.activeResearch.clear();
    this.asyncClient.cleanup();
    this.removeAllListeners();
  }
}

// Singleton instance
let serviceInstance: DeepResearchService | null = null;

export function getDeepResearchService(): DeepResearchService {
  console.log('[DeepResearchService] Getting service instance, current instance exists:', !!serviceInstance);
  if (!serviceInstance) {
    console.log('[DeepResearchService] Creating new service instance...');
    try {
      serviceInstance = new DeepResearchService();
      console.log('[DeepResearchService] Service instance created successfully');
    } catch (error) {
      console.error('[DeepResearchService] Error creating service instance:', error);
      throw error;
    }
  }
  return serviceInstance;
}