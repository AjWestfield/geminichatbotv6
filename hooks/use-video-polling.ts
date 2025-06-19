import { useEffect, useRef, useCallback } from 'react';
import { useVideoProgressStore } from '@/lib/stores/video-progress-store';
import { GeneratedVideo } from '@/lib/video-generation-types';

interface UseVideoPollingOptions {
  enabled?: boolean;
  pollInterval?: number;
  maxPollTime?: number;
  onComplete?: (video: GeneratedVideo) => void;
  onError?: (videoId: string, error: string) => void;
}

export function useVideoPolling(
  videoId: string | null,
  predictionId: string | null,
  options: UseVideoPollingOptions = {}
) {
  const {
    enabled = true,
    pollInterval = 3000, // Poll every 3 seconds for more real-time updates
    maxPollTime = 600000, // 10 minutes
    onComplete,
    onError
  } = options;

  const {
    getProgress,
    updateProgress,
    completeVideo,
    failVideo,
    updateStage,
    calculateProgress
  } = useVideoProgressStore();

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);
  const lastPollTimeRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);

  const pollStatus = useCallback(async () => {
    if (!videoId || !predictionId || !enabled || isPollingRef.current) {
      return;
    }

    const progress = getProgress(videoId);
    if (!progress || progress.status !== 'generating') {
      return;
    }

    // Check if we've exceeded max poll time
    if (startTimeRef.current && Date.now() - startTimeRef.current > maxPollTime) {
      console.log(`[VIDEO POLLING] Max poll time exceeded for video ${videoId}`);
      failVideo(videoId, 'Generation timed out');
      onError?.(videoId, 'Generation timed out');
      return;
    }

    // Ensure minimum time between polls (prevent race conditions)
    const now = Date.now();
    if (now - lastPollTimeRef.current < pollInterval - 1000) {
      console.log(`[VIDEO POLLING] Skipping poll - too soon (${now - lastPollTimeRef.current}ms ago)`);
      pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
      return;
    }

    lastPollTimeRef.current = now;
    isPollingRef.current = true;

    try {
      console.log(`[VIDEO POLLING] Polling status for video ${videoId}, prediction ${predictionId}`);

      // Use the correct API endpoint with the prediction ID
      const response = await fetch(`/api/generate-video?id=${predictionId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[VIDEO POLLING] Status response:`, {
        status: data.status,
        progress: data.progress,
        stage: data.stage
      });

      // Reset retry count on successful response
      retryCountRef.current = 0;

      // Map Replicate status to our stage system
      let stage = progress.stage;
      let stageProgress = progress.progress;

      if (data.status === 'starting') {
        stage = 'initializing';
        stageProgress = Math.max(5, progress.progress);
      } else if (data.status === 'processing') {
        stage = 'processing';
        stageProgress = Math.max(15, Math.min(85, data.progress || progress.progress));
      } else if (data.status === 'succeeded') {
        stage = 'completed';
        stageProgress = 100;
      } else if (data.status === 'failed') {
        stage = 'failed';
        stageProgress = 0;
      }

      // Update progress store with latest data
      updateProgress(videoId, {
        progress: stageProgress,
        stage,
        replicateStatus: data.status,
        elapsedTime: Math.floor((now - progress.createdAt.getTime()) / 1000),
        estimatedRemainingTime: Math.max(0, progress.estimatedTotalTime - Math.floor((now - progress.createdAt.getTime()) / 1000))
      });

      // Update stage if changed
      if (stage !== progress.stage) {
        updateStage(videoId, stage);
      }

      // Check if generation is complete
      if (data.status === 'succeeded' && data.output) {
        console.log(`[VIDEO POLLING] Video generation completed for ${videoId}`);

        completeVideo(videoId);

        // Create completed video object
        const completedVideo: GeneratedVideo = {
          id: videoId,
          prompt: progress.prompt,
          url: Array.isArray(data.output) ? data.output[0] : data.output,
          duration: progress.estimatedTotalTime === 360 ? 10 : 5, // Estimate based on total time
          aspectRatio: '9:16', // Default portrait mode for most generations
          model: 'standard', // Default, should be passed from original request
          status: 'completed',
          createdAt: progress.createdAt
        };

        onComplete?.(completedVideo);
        return; // Stop polling
      }

      // Check if generation failed
      if (data.status === 'failed') {
        console.log(`[VIDEO POLLING] Video generation failed for ${videoId}:`, data.error);

        failVideo(videoId, data.error || 'Generation failed');
        onError?.(videoId, data.error || 'Generation failed');
        return; // Stop polling
      }

      // Continue polling if still generating
      if (['starting', 'processing'].includes(data.status)) {
        pollTimeoutRef.current = setTimeout(pollStatus, pollInterval);
      }

    } catch (error) {
      console.error(`[VIDEO POLLING] Error polling video status:`, error);

      retryCountRef.current++;

      // If we've failed too many times, give up
      if (retryCountRef.current >= 5) {
        console.error(`[VIDEO POLLING] Too many polling failures for ${videoId}, giving up`);
        failVideo(videoId, 'Network error: Too many failed attempts');
        onError?.(videoId, 'Network error: Too many failed attempts');
        return;
      }

      // Exponential backoff for retries
      const retryDelay = Math.min(pollInterval * Math.pow(2, retryCountRef.current), 60000); // Max 1 minute
      console.log(`[VIDEO POLLING] Retrying in ${retryDelay}ms (attempt ${retryCountRef.current})`);
      pollTimeoutRef.current = setTimeout(pollStatus, retryDelay);
    } finally {
      isPollingRef.current = false;
    }
  }, [
    videoId,
    predictionId,
    enabled,
    pollInterval,
    maxPollTime,
    getProgress,
    updateProgress,
    completeVideo,
    failVideo,
    updateStage,
    onComplete,
    onError
  ]);

  // Start polling when conditions are met
  useEffect(() => {
    if (videoId && predictionId && enabled) {
      const progress = getProgress(videoId);

      if (progress && progress.status === 'generating') {
        console.log(`[VIDEO POLLING] Starting polling for video ${videoId} with ${pollInterval}ms interval`);
        startTimeRef.current = Date.now();
        retryCountRef.current = 0;

        // Start polling after a short delay
        pollTimeoutRef.current = setTimeout(pollStatus, 3000);
      }
    }

    // Cleanup function
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [videoId, predictionId, enabled, pollStatus, getProgress]);

  // Update progress calculation periodically
  useEffect(() => {
    if (!videoId || !enabled) return;

    const updateInterval = setInterval(() => {
      calculateProgress(videoId);
    }, 1000); // Update every second for smooth progress

    return () => clearInterval(updateInterval);
  }, [videoId, enabled, calculateProgress]);

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    isPollingRef.current = false;
    retryCountRef.current = 0;
    console.log(`[VIDEO POLLING] Stopped polling for video ${videoId}`);
  }, [videoId]);

  const progress = videoId ? getProgress(videoId) : null;

  return {
    progress,
    isPolling: isPollingRef.current || !!pollTimeoutRef.current,
    stopPolling
  };
}

// Hook for polling multiple videos - fixed to not violate Rules of Hooks
export function useMultiVideoPolling(
  videos: Array<{ videoId: string; predictionId: string }>,
  options: UseVideoPollingOptions = {}
) {
  const {
    enabled = true,
    pollInterval = 3000, // Poll every 3 seconds for real-time updates
    maxPollTime = 600000,
    onComplete,
    onError
  } = options;

  const {
    getProgress,
    updateProgress,
    completeVideo,
    failVideo,
    updateStage,
    calculateProgress,
    getAllGeneratingVideos
  } = useVideoProgressStore();

  const pollTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const startTimesRef = useRef<Map<string, number>>(new Map());
  const lastPollTimesRef = useRef<Map<string, number>>(new Map());
  const retryCountsRef = useRef<Map<string, number>>(new Map());
  const isPollingRef = useRef<Set<string>>(new Set());

  const pollVideoStatus = useCallback(async (videoId: string, predictionId: string) => {
    if (!enabled || isPollingRef.current.has(videoId)) {
      return;
    }

    const progress = getProgress(videoId);
    if (!progress || progress.status !== 'generating') {
      return;
    }

    // Check if we've exceeded max poll time
    const startTime = startTimesRef.current.get(videoId);
    if (startTime && Date.now() - startTime > maxPollTime) {
      console.log(`[MULTI VIDEO POLLING] Max poll time exceeded for video ${videoId}`);
      failVideo(videoId, 'Generation timed out');
      onError?.(videoId, 'Generation timed out');
      pollTimeoutsRef.current.delete(videoId);
      return;
    }

    // Ensure minimum time between polls
    const now = Date.now();
    const lastPollTime = lastPollTimesRef.current.get(videoId) || 0;
    if (now - lastPollTime < pollInterval - 1000) {
      console.log(`[MULTI VIDEO POLLING] Skipping poll - too soon`);
      const timeout = setTimeout(() => pollVideoStatus(videoId, predictionId), pollInterval);
      pollTimeoutsRef.current.set(videoId, timeout);
      return;
    }

    lastPollTimesRef.current.set(videoId, now);
    isPollingRef.current.add(videoId);

    try {
      console.log(`[MULTI VIDEO POLLING] Polling status for video ${videoId}`);

      const response = await fetch(`/api/generate-video?id=${predictionId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Reset retry count on successful response
      retryCountsRef.current.set(videoId, 0);

      // Map status to stage
      let stage = progress.stage;
      let stageProgress = progress.progress;

      if (data.status === 'starting') {
        stage = 'initializing';
        stageProgress = Math.max(5, progress.progress);
      } else if (data.status === 'processing') {
        stage = 'processing';
        stageProgress = Math.max(15, Math.min(85, data.progress || progress.progress));
      } else if (data.status === 'succeeded') {
        stage = 'completed';
        stageProgress = 100;
      } else if (data.status === 'failed') {
        stage = 'failed';
        stageProgress = 0;
      }

      // Update progress
      updateProgress(videoId, {
        progress: stageProgress,
        stage,
        replicateStatus: data.status,
        elapsedTime: Math.floor((now - progress.createdAt.getTime()) / 1000),
        estimatedRemainingTime: Math.max(0, progress.estimatedTotalTime - Math.floor((now - progress.createdAt.getTime()) / 1000))
      });

      if (stage !== progress.stage) {
        updateStage(videoId, stage);
      }

      // Handle completion
      if (data.status === 'succeeded' && data.output) {
        console.log(`[MULTI VIDEO POLLING] Video generation completed for ${videoId}`);
        completeVideo(videoId);

        const completedVideo: GeneratedVideo = {
          id: videoId,
          prompt: progress.prompt,
          url: Array.isArray(data.output) ? data.output[0] : data.output,
          duration: progress.estimatedTotalTime === 360 ? 10 : 5,
          aspectRatio: '9:16', // Default portrait mode for most generations
          model: 'standard',
          status: 'completed',
          createdAt: progress.createdAt
        };

        onComplete?.(completedVideo);
        pollTimeoutsRef.current.delete(videoId);
        return;
      }

      // Handle failure
      if (data.status === 'failed') {
        console.log(`[MULTI VIDEO POLLING] Video generation failed for ${videoId}`);
        failVideo(videoId, data.error || 'Generation failed');
        onError?.(videoId, data.error || 'Generation failed');
        pollTimeoutsRef.current.delete(videoId);
        return;
      }

      // Continue polling
      if (['starting', 'processing'].includes(data.status)) {
        const timeout = setTimeout(() => pollVideoStatus(videoId, predictionId), pollInterval);
        pollTimeoutsRef.current.set(videoId, timeout);
      }

    } catch (error) {
      console.error(`[MULTI VIDEO POLLING] Error polling video status:`, error);

      const retryCount = (retryCountsRef.current.get(videoId) || 0) + 1;
      retryCountsRef.current.set(videoId, retryCount);

      if (retryCount >= 5) {
        console.error(`[MULTI VIDEO POLLING] Too many failures for ${videoId}`);
        failVideo(videoId, 'Network error: Too many failed attempts');
        onError?.(videoId, 'Network error: Too many failed attempts');
        pollTimeoutsRef.current.delete(videoId);
        return;
      }

      const retryDelay = Math.min(pollInterval * Math.pow(2, retryCount), 60000);
      const timeout = setTimeout(() => pollVideoStatus(videoId, predictionId), retryDelay);
      pollTimeoutsRef.current.set(videoId, timeout);
    } finally {
      isPollingRef.current.delete(videoId);
    }
  }, [enabled, pollInterval, maxPollTime, getProgress, updateProgress, completeVideo, failVideo, updateStage, onComplete, onError]);

  // Effect to start/stop polling based on videos array
  useEffect(() => {
    if (!enabled) return;

    // Start polling for new videos
    videos.forEach(({ videoId, predictionId }) => {
      const progress = getProgress(videoId);
      if (progress?.status === 'generating' && !pollTimeoutsRef.current.has(videoId)) {
        console.log(`[MULTI VIDEO POLLING] Starting polling for video ${videoId}`);
        startTimesRef.current.set(videoId, Date.now());
        retryCountsRef.current.set(videoId, 0);
        
        // Start polling after a short delay
        const timeout = setTimeout(() => pollVideoStatus(videoId, predictionId), 3000);
        pollTimeoutsRef.current.set(videoId, timeout);
      }
    });

    // Stop polling for removed videos
    const currentVideoIds = new Set(videos.map(v => v.videoId));
    pollTimeoutsRef.current.forEach((timeout, videoId) => {
      if (!currentVideoIds.has(videoId)) {
        console.log(`[MULTI VIDEO POLLING] Stopping polling for removed video ${videoId}`);
        clearTimeout(timeout);
        pollTimeoutsRef.current.delete(videoId);
        startTimesRef.current.delete(videoId);
        lastPollTimesRef.current.delete(videoId);
        retryCountsRef.current.delete(videoId);
      }
    });

    // Cleanup function
    return () => {
      pollTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      pollTimeoutsRef.current.clear();
      isPollingRef.current.clear();
    };
  }, [videos, enabled, getProgress, pollVideoStatus]);

  // Update progress calculation periodically
  useEffect(() => {
    if (!enabled || videos.length === 0) return;

    const updateInterval = setInterval(() => {
      videos.forEach(({ videoId }) => {
        const progress = getProgress(videoId);
        if (progress?.status === 'generating') {
          calculateProgress(videoId);
        }
      });
    }, 1000); // Update every second for smooth progress

    return () => clearInterval(updateInterval);
  }, [videos, enabled, getProgress, calculateProgress]);

  const stopAllPolling = useCallback(() => {
    pollTimeoutsRef.current.forEach((timeout, videoId) => {
      console.log(`[MULTI VIDEO POLLING] Stopping polling for video ${videoId}`);
      clearTimeout(timeout);
    });
    pollTimeoutsRef.current.clear();
    isPollingRef.current.clear();
    startTimesRef.current.clear();
    lastPollTimesRef.current.clear();
    retryCountsRef.current.clear();
  }, []);

  // Get progress for all videos
  const allProgress = videos.map(({ videoId }) => getProgress(videoId)).filter(Boolean);
  const isAnyPolling = pollTimeoutsRef.current.size > 0;

  return {
    allProgress,
    isAnyPolling,
    stopAllPolling
  };
}
