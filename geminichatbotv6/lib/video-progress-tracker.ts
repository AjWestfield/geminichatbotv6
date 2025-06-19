/**
 * Video Progress Tracker
 * 
 * Provides detailed progress tracking for video generation with Replicate
 */

import { ReplicateVideoClient } from './replicate-client';

export interface VideoProgress {
  id: string;
  status: 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  progress: number; // 0-100
  stage?: string; // "Initializing model", "Generating frames", etc.
  logs?: string[];
  startedAt?: Date;
  estimatedTimeRemaining?: number; // seconds
  framesGenerated?: number;
  totalFrames?: number;
  currentStep?: string;
  error?: string;
}

export class VideoProgressTracker {
  private static instance: VideoProgressTracker;
  private progressCache = new Map<string, VideoProgress>();
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private startTimes = new Map<string, Date>();
  
  static getInstance(): VideoProgressTracker {
    if (!VideoProgressTracker.instance) {
      VideoProgressTracker.instance = new VideoProgressTracker();
    }
    return VideoProgressTracker.instance;
  }

  /**
   * Get detailed progress for a video generation
   */
  async getProgress(predictionId: string, apiKey: string): Promise<VideoProgress> {
    try {
      // Check cache first
      const cached = this.progressCache.get(predictionId);
      
      // Get current status from Replicate
      const client = new ReplicateVideoClient(apiKey);
      const status = await client.getVideoStatus(predictionId);
      
      // Get start time
      const startTime = this.startTimes.get(predictionId) || new Date();
      if (!this.startTimes.has(predictionId)) {
        this.startTimes.set(predictionId, startTime);
      }
      
      // Calculate progress based on status and time elapsed
      const elapsedSeconds = (Date.now() - startTime.getTime()) / 1000;
      let progress = 0;
      let stage = '';
      let estimatedTimeRemaining = 0;
      
      switch (status.status) {
        case 'starting':
          progress = 5;
          stage = 'Initializing Kling v1.6 model...';
          estimatedTimeRemaining = 300; // 5 minutes estimate
          break;
          
        case 'processing':
          // Estimate progress based on elapsed time (5-8 minutes typical)
          const avgDuration = 6.5 * 60; // 6.5 minutes in seconds
          progress = Math.min(95, Math.floor((elapsedSeconds / avgDuration) * 100));
          
          // Determine stage based on progress
          if (progress < 20) {
            stage = 'Loading model and preparing generation...';
          } else if (progress < 40) {
            stage = 'Analyzing prompt and initializing frames...';
          } else if (progress < 60) {
            stage = 'Generating video frames...';
          } else if (progress < 80) {
            stage = 'Processing and enhancing frames...';
          } else {
            stage = 'Finalizing video output...';
          }
          
          // Calculate remaining time
          const estimatedTotal = avgDuration;
          estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsedSeconds);
          break;
          
        case 'succeeded':
          progress = 100;
          stage = 'Video generation complete!';
          estimatedTimeRemaining = 0;
          break;
          
        case 'failed':
          progress = 0;
          stage = 'Video generation failed';
          estimatedTimeRemaining = 0;
          break;
          
        case 'canceled':
          progress = 0;
          stage = 'Video generation canceled';
          estimatedTimeRemaining = 0;
          break;
      }
      
      const progressData: VideoProgress = {
        id: predictionId,
        status: status.status,
        progress,
        stage,
        startedAt: startTime,
        estimatedTimeRemaining,
        currentStep: stage,
        error: status.error
      };
      
      // Cache the progress
      this.progressCache.set(predictionId, progressData);
      
      // Clean up if completed
      if (['succeeded', 'failed', 'canceled'].includes(status.status)) {
        this.stopPolling(predictionId);
        this.startTimes.delete(predictionId);
        // Keep in cache for 5 minutes after completion
        setTimeout(() => {
          this.progressCache.delete(predictionId);
        }, 5 * 60 * 1000);
      }
      
      return progressData;
    } catch (error) {
      console.error('Error getting video progress:', error);
      
      // Return cached data if available
      const cached = this.progressCache.get(predictionId);
      if (cached) {
        return cached;
      }
      
      // Return error state
      return {
        id: predictionId,
        status: 'failed',
        progress: 0,
        stage: 'Error checking progress',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start polling for progress updates
   */
  startPolling(
    predictionId: string, 
    apiKey: string, 
    onProgress: (progress: VideoProgress) => void,
    intervalMs: number = 3000
  ): void {
    // Stop any existing polling
    this.stopPolling(predictionId);
    
    // Start new polling
    const interval = setInterval(async () => {
      const progress = await this.getProgress(predictionId, apiKey);
      onProgress(progress);
      
      // Stop polling if completed
      if (['succeeded', 'failed', 'canceled'].includes(progress.status)) {
        this.stopPolling(predictionId);
      }
    }, intervalMs);
    
    this.pollingIntervals.set(predictionId, interval);
    
    // Get initial progress immediately
    this.getProgress(predictionId, apiKey).then(onProgress);
  }

  /**
   * Stop polling for a specific prediction
   */
  stopPolling(predictionId: string): void {
    const interval = this.pollingIntervals.get(predictionId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(predictionId);
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
  }

  /**
   * Format time remaining for display
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Complete';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes > 0) {
      return `~${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `~${remainingSeconds}s`;
    }
  }

  /**
   * Format elapsed time for display
   */
  static formatElapsedTime(startTime: Date): string {
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}