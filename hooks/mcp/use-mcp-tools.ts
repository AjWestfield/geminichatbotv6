import { useState, useEffect, useCallback } from 'react';
import { MCPTool } from '@/lib/mcp/mcp-client';

export function useMCPTools(serverId: string | null) {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  // Fetch tools for a server
  useEffect(() => {
    if (!serverId) {
      setTools([]);
      return;
    }

    const fetchTools = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/mcp/tools?serverId=${serverId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch tools');
        }
        
        const data = await response.json();
        setTools(data.tools);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, [serverId]);

  // Execute a tool
  const executeTool = useCallback(async (toolName: string, args: any = {}) => {
    if (!serverId) {
      throw new Error('No server selected');
    }

    setExecuting(toolName);
    setError(null);

    try {
      const response = await fetch('/api/mcp/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          toolName,
          arguments: args,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute tool');
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setExecuting(null);
    }
  }, [serverId]);

  return {
    tools,
    loading,
    error,
    executing,
    executeTool,
  };
}