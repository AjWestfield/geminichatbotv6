import { MCPClientWrapper, MCPServerConfig, MCPTool, MCPResource } from './mcp-client';
import { MCPConfigManager, MCPConfigManagerClient } from './mcp-config-manager';

export interface MCPServerInstance {
  config: MCPServerConfig;
  client: MCPClientWrapper;
  tools?: MCPTool[];
  resources?: MCPResource[];
  lastError?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export class MCPServerManager {
  private servers: Map<string, MCPServerInstance> = new Map();
  private static instance: MCPServerManager | null = null;

  private constructor() {}

  // Singleton pattern for global server management
  static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server with id ${config.id} already exists`);
    }

    const client = new MCPClientWrapper(config);
    const instance: MCPServerInstance = {
      config,
      client,
      status: 'disconnected',
    };

    this.servers.set(config.id, instance);
    
    // Save to config
    if (typeof window === 'undefined') {
      await MCPConfigManager.addServer(config);
    } else {
      MCPConfigManagerClient.addServer(config);
    }
  }

  async removeServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    await this.disconnectServer(serverId);
    this.servers.delete(serverId);
    
    // Remove from config
    if (typeof window === 'undefined') {
      await MCPConfigManager.removeServer(serverId);
    } else {
      MCPConfigManagerClient.removeServer(serverId);
    }
  }

  async connectServer(serverId: string, retryCount: number = 0): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    instance.status = 'connecting';
    console.log(`[MCPServerManager] Connecting to server: ${serverId} (${instance.config.name}) - Attempt ${retryCount + 1}`);
    
    try {
      await instance.client.connect();
      
      // Verify connection is still alive before proceeding
      if (!instance.client.isConnected()) {
        throw new Error('Connection dropped immediately after connecting');
      }
      
      instance.status = 'connected';
      console.log(`[MCPServerManager] Connected to server: ${serverId}`);
      
      // Add small delay for DesktopCommander to stabilize
      if (instance.config.name === 'DesktopCommander') {
        console.log('[MCPServerManager] Waiting for DesktopCommander to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Fetch available tools and resources with timeout
      try {
        const capabilitiesTimeout = setTimeout(() => {
          throw new Error('Timeout fetching server capabilities');
        }, 10000);
        
        console.log(`[MCPServerManager] Fetching tools for server: ${serverId}`);
        instance.tools = await instance.client.listTools();
        clearTimeout(capabilitiesTimeout);
        
        console.log(`[MCPServerManager] Found ${instance.tools?.length || 0} tools for server: ${serverId}`);
        if (instance.tools && instance.tools.length > 0) {
          console.log(`[MCPServerManager] Tools:`, instance.tools.map(t => t.name));
        }
        
        console.log(`[MCPServerManager] Fetching resources for server: ${serverId}`);
        instance.resources = await instance.client.listResources();
        console.log(`[MCPServerManager] Found ${instance.resources?.length || 0} resources for server: ${serverId}`);
      } catch (error) {
        console.error('[MCPServerManager] Error fetching server capabilities:', error);
        
        // If connection dropped, retry
        if (!instance.client.isConnected() && retryCount < 2) {
          console.log('[MCPServerManager] Connection lost, retrying...');
          await instance.client.disconnect();
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.connectServer(serverId, retryCount + 1);
        }
        
        // Don't throw here - server is connected even if capabilities fetch fails
        instance.tools = [];
        instance.resources = [];
      }
      
      delete instance.lastError;
    } catch (error) {
      instance.status = 'error';
      instance.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MCPServerManager] Failed to connect to server ${serverId}:`, error);
      
      // Retry for certain errors
      if (retryCount < 2) {
        const errorMessage = error instanceof Error ? error.message : '';
        const shouldRetry = errorMessage.includes('Connection closed') ||
                           errorMessage.includes('Connection dropped') ||
                           errorMessage.includes('ENOTEMPTY') ||
                           errorMessage.includes('spawn');
        
        if (shouldRetry) {
          console.log(`[MCPServerManager] Retrying connection in 3 seconds...`);
          await instance.client.disconnect();
          await new Promise(resolve => setTimeout(resolve, 3000));
          return this.connectServer(serverId, retryCount + 1);
        }
      }
      
      throw error;
    }
  }

  async disconnectServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    await instance.client.disconnect();
    instance.status = 'disconnected';
    instance.tools = undefined;
    instance.resources = undefined;
  }

  async listTools(serverId: string): Promise<MCPTool[]> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (instance.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const tools = await instance.client.listTools();
    instance.tools = tools;
    return tools;
  }

  async executeTool(serverId: string, toolName: string, params: any): Promise<any> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (instance.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    return await instance.client.callTool(toolName, params);
  }

  async listResources(serverId: string): Promise<MCPResource[]> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (instance.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const resources = await instance.client.listResources();
    instance.resources = resources;
    return resources;
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (instance.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    return await instance.client.readResource(uri);
  }

  getServer(serverId: string): MCPServerInstance | undefined {
    return this.servers.get(serverId);
  }

  getAllServers(): MCPServerInstance[] {
    return Array.from(this.servers.values());
  }

  // Save server configurations
  async saveToConfig(): Promise<void> {
    const configs = this.getAllServers().map(instance => instance.config);
    if (typeof window === 'undefined') {
      await MCPConfigManager.saveConfig(configs);
    } else {
      MCPConfigManagerClient.saveConfig(configs);
    }
  }

  // Load server configurations
  async loadFromConfig(): Promise<void> {
    const config = typeof window === 'undefined' 
      ? await MCPConfigManager.loadConfig()
      : MCPConfigManagerClient.loadConfig();
    if (!config) return;

    try {
      for (const serverConfig of config.servers) {
        // Only add if not already loaded
        if (!this.servers.has(serverConfig.id)) {
          // Don't use addServer here to avoid saving back to config
          const client = new MCPClientWrapper(serverConfig);
          const instance: MCPServerInstance = {
            config: serverConfig,
            client,
            status: 'disconnected',
          };
          this.servers.set(serverConfig.id, instance);
        }
      }
    } catch (error) {
      console.error('Error loading saved servers:', error);
    }
  }

  // Disconnect all servers
  async disconnectAll(): Promise<void> {
    for (const [serverId] of this.servers) {
      try {
        await this.disconnectServer(serverId);
      } catch (error) {
        console.error(`Error disconnecting server ${serverId}:`, error);
      }
    }
  }
}