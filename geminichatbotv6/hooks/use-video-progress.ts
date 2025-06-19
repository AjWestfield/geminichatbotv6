import { useState, useEffect, useCallback, useRef } from 'react';

// Define VideoProgress interface locally to avoid importing from server-side code
interface VideoProgress {
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

interface UseVideoProgressOptions {
  autoStart?: boolean;
  pollingInterval?: number;
  onComplete?: (videoUrl: string) => void;
  onError?: (error: string) => void;
}

export function useVideoProgress(
  videoId: string | null,
  options: UseVideoProgressOptions = {}
) {
  const { 
    autoStart = true, 
    pollingInterval = 3000,
    onComplete,
    onError
  } = options;
  
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVideoStatus = useCallback(async () => {
    if (!videoId) return;

    try {
      const response = await fetch(`/api/video-status/${videoId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video status');
      }

      // Map API response to VideoProgress interface
      const progressData: VideoProgress = {
        id: videoId,
        status: data.replicateStatus === 'succeeded' ? 'succeeded' :
                data.replicateStatus === 'failed' ? 'failed' :
                data.replicateStatus === 'canceled' ? 'canceled' :
                data.replicateStatus === 'starting' ? 'starting' :
                'processing',
        progress: data.progress || 0,
        stage: data.stage,
        estimatedTimeRemaining: data.estimatedRemainingTime,
        error: data.error,
        startedAt: startTime || new Date(),
        logs: data.logs
      };

      setProgress(progressData);

      // Handle completion
      if (progressData.status === 'succeeded' && data.output) {
        const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output;
        onComplete?.(videoUrl);
        stopPolling();
      } else if (progressData.status === 'failed') {
        const errorMsg = progressData.error || 'Video generation failed';
        setError(errorMsg);
        onError?.(errorMsg);
        stopPolling();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch video status';
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [videoId, onComplete, onError, startTime]);

  const startPolling = useCallback(() => {
    if (!videoId) return;
    
    setIsPolling(true);
    setError(null);
    if (!startTime) {
      setStartTime(new Date());
    }

    // Initial fetch
    fetchVideoStatus();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(fetchVideoStatus, pollingInterval);
  }, [videoId, pollingInterval, fetchVideoStatus, startTime]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Auto-start polling
  useEffect(() => {
    if (autoStart && videoId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [videoId, autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Format helpers
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const formatElapsed = useCallback(() => {
    if (!progress?.startedAt) return '0:00';
    const elapsed = Math.floor((Date.now() - new Date(progress.startedAt).getTime()) / 1000);
    return formatTime(elapsed);
  }, [progress, formatTime]);

  return {
    progress,
    error,
    isPolling,
    startPolling,
    stopPolling,
    formatTime,
    formatElapsed
  };
}