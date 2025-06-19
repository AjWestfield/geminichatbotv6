import { useState, useCallback } from 'react';

export interface UsePerplexitySearchResult {
  searchWithPerplexity: (messages: any[], forceSearch?: boolean) => Promise<any>;
  isSearching: boolean;
  searchError: string | null;
}

export function usePerplexitySearch(): UsePerplexitySearchResult {
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchWithPerplexity = useCallback(async (
    messages: any[],
    forceSearch: boolean = false
  ) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch('/api/perplexity-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, forceSearch }),
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      setSearchError('Failed to perform web search');
      console.error('Perplexity search error:', error);
      return null;
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    searchWithPerplexity,
    isSearching,
    searchError
  };
}
