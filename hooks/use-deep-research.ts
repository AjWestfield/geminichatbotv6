import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { shouldTriggerDeepResearch } from '@/lib/client-utils/deep-research-detection';

// Types
export interface DeepResearchJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  response?: {
    content: string;
    searchResults?: any[];
    completedAt?: string;
  };
  error?: string;
}

export interface DeepResearchOptions {
  reasoningEffort?: 'low' | 'medium' | 'high';
  searchDomain?: string;
  searchRecency?: string;
  onProgress?: (job: DeepResearchJob) => void;
  onComplete?: (job: DeepResearchJob) => void;
  onError?: (error: Error) => void;
}

export interface UseDeepResearchReturn {
  data: DeepResearchJob | null;
  loading: boolean;
  error: Error | null;
  startResearch: (query: string, options?: DeepResearchOptions) => Promise<void>;
  cancelResearch: () => Promise<void>;
  exportAsMarkdown: () => string;
  // Additional properties expected by chat interface
  isActive: boolean;
  isLoading: boolean;
  startDeepResearch: (topic: string, depth?: 'surface' | 'moderate' | 'deep') => Promise<void>;
  activeSession: DeepResearchJob | null;
  exportResearch: () => string;
}

export interface UseDeepResearchDetectionReturn {
  shouldShowDeepResearch: boolean;
  detectedTopic: string | null;
  detectedDepth: 'surface' | 'moderate' | 'deep' | null;
}

// Hook
export function useDeepResearch(): UseDeepResearchReturn {
  const [data, setData] = useState<DeepResearchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentJobIdRef = useRef<string | null>(null);

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startResearch = useCallback(async (
    query: string,
    options: DeepResearchOptions = {}
  ) => {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Start async job
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          options: {
            reasoningEffort: options.reasoningEffort,
            searchDomain: options.searchDomain,
            searchRecency: options.searchRecency
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start research');
      }

      const { jobId } = await response.json();
      currentJobIdRef.current = jobId;

      // Set initial job state
      setData({
        jobId,
        status: 'queued',
        createdAt: new Date().toISOString()
      });

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/deep-research/${jobId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'status':
            const job: DeepResearchJob = {
              jobId: message.jobId,
              status: message.status,
              createdAt: message.createdAt,
              response: message.response,
              error: message.error
            };

            setData(job);

            if (options.onProgress) {
              options.onProgress(job);
            }

            if (job.status === 'completed' && options.onComplete) {
              options.onComplete(job);
            }

            if (job.status === 'failed' && options.onError) {
              options.onError(new Error(job.error || 'Research failed'));
            }
            break;

          case 'done':
            setLoading(false);
            eventSource.close();
            eventSourceRef.current = null;
            break;

          case 'error':
            const errorMessage = message.error || 'Stream error';
            setError(new Error(errorMessage));
            setLoading(false);
            eventSource.close();
            eventSourceRef.current = null;
            if (options.onError) {
              options.onError(new Error(errorMessage));
            }
            break;
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setError(new Error('Connection lost'));
        setLoading(false);
        eventSource.close();
        eventSourceRef.current = null;
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start research');
      setError(error);
      setLoading(false);
      if (options.onError) {
        options.onError(error);
      }
    }
  }, []);

  const cancelResearch = useCallback(async () => {
    if (!currentJobIdRef.current) return;

    try {
      // Close event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Cancel job on server
      await fetch(`/api/deep-research/${currentJobIdRef.current}`, {
        method: 'DELETE'
      });

      setLoading(false);
      currentJobIdRef.current = null;
    } catch (err) {
      console.error('Failed to cancel research:', err);
    }
  }, []);

  const exportAsMarkdown = useCallback(() => {
    if (!data || !data.response) {
      return '# No research data available';
    }

    const { response } = data;
    let markdown = `# Deep Research Report\n\n`;
    markdown += `**Status:** ${data.status}\n`;
    markdown += `**Created:** ${new Date(data.createdAt).toLocaleString()}\n`;

    if (response.completedAt) {
      markdown += `**Completed:** ${new Date(response.completedAt).toLocaleString()}\n`;
    }

    markdown += `\n---\n\n`;
    markdown += response.content;

    if (response.searchResults && response.searchResults.length > 0) {
      markdown += `\n\n## Search Results\n\n`;
      response.searchResults.forEach((result, index) => {
        markdown += `${index + 1}. **${result.title || 'Untitled'}**\n`;
        if (result.url) markdown += `   - URL: ${result.url}\n`;
        if (result.snippet) markdown += `   - ${result.snippet}\n`;
        markdown += `\n`;
      });
    }

    return markdown;
  }, [data]);

  // Create startDeepResearch alias that matches expected interface
  const startDeepResearch = useCallback(async (
    topic: string,
    depth: 'surface' | 'moderate' | 'deep' = 'moderate'
  ) => {
    const options: DeepResearchOptions = {
      reasoningEffort: depth === 'surface' ? 'low' : depth === 'deep' ? 'high' : 'medium'
    };
    await startResearch(topic, options);
  }, [startResearch]);

  return {
    data,
    loading,
    error,
    startResearch,
    cancelResearch,
    exportAsMarkdown,
    // Additional properties expected by chat interface
    isActive: loading || (data?.status === 'processing' || data?.status === 'queued'),
    isLoading: loading,
    startDeepResearch,
    activeSession: data,
    exportResearch: exportAsMarkdown
  };
}

// Detection hook for auto-triggering deep research
export function useDeepResearchDetection(messages: any[]): UseDeepResearchDetectionReturn {
  return useMemo(() => {
    if (!messages || messages.length === 0) {
      return {
        shouldShowDeepResearch: false,
        detectedTopic: null,
        detectedDepth: null
      };
    }

    // Check the last user message for deep research triggers
    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage?.content) {
      return {
        shouldShowDeepResearch: false,
        detectedTopic: null,
        detectedDepth: null
      };
    }

    const detection = shouldTriggerDeepResearch(lastUserMessage.content);

    return {
      shouldShowDeepResearch: detection.shouldTrigger,
      detectedTopic: detection.topic || null,
      detectedDepth: detection.depth || null
    };
  }, [messages]);
}
