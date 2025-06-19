import { useState, useEffect, useCallback } from 'react';
import { MCPServerConfig } from '@/lib/mcp/mcp-client';

export interface MCPServerInfo extends MCPServerConfig {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools?: any[];
  resources?: any[];
  lastError?: string;
  error?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all servers
  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mcp/servers');
      
      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }
      
      const data = await response.json();
      setServers(data.servers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Add a new server
  const addServer = useCallback(async (config: MCPServerConfig) => {
    try {
      console.log('[useMCPServers] Adding server config:', config);
      
      const response = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const data = await response.json();
        console.error('[useMCPServers] Server add failed:', data);
        throw new Error(data.error || 'Failed to add server');
      }
      
      const result = await response.json();
      console.log('[useMCPServers] Server added successfully:', result);
      
      await fetchServers();
      return config; // Return the config with ID
    } catch (err) {
      console.error('[useMCPServers] Error adding server:', err);
      throw err;
    }
  }, [fetchServers]);

  // Remove a server
  const removeServer = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`/api/mcp/servers?serverId=${serverId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove server');
      }
      
      await fetchServers();
    } catch (err) {
      throw err;
    }
  }, [fetchServers]);

  // Connect to a server
  const connectServer = useCallback(async (serverId: string) => {
    try {
      // Update local state to show connecting
      setServers(prev => prev.map(server => 
        server.id === serverId 
          ? { ...server, status: 'connecting' as const }
          : server
      ));
      
      const response = await fetch(`/api/mcp/servers/${serverId}/connect`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect to server');
      }
      
      await fetchServers();
    } catch (err) {
      // Update local state to show error
      setServers(prev => prev.map(server => 
        server.id === serverId 
          ? { ...server, status: 'error' as const, lastError: err instanceof Error ? err.message : 'Unknown error' }
          : server
      ));
      throw err;
    }
  }, [fetchServers]);

  // Disconnect from a server
  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      const response = await fetch(`/api/mcp/servers/${serverId}/connect`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect from server');
      }
      
      await fetchServers();
    } catch (err) {
      throw err;
    }
  }, [fetchServers]);

  // Get tools for a specific server
  const getServerTools = useCallback((serverId: string): MCPTool[] => {
    const server = servers.find(s => s.id === serverId);
    if (!server || !server.tools) return [];
    
    return server.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }, [servers]);

  // Load servers on mount - empty deps to prevent infinite loop
  useEffect(() => {
    fetchServers();
  }, []); // Empty array instead of [fetchServers] to prevent circular dependency

  return {
    servers,
    loading,
    error,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    refreshServers: fetchServers,
    getServerTools,
  };
}