import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string; // For HTTP-based transports
  apiKey?: string; // For authenticated HTTP transports
  transportType?: 'stdio' | 'http'; // Transport type
}

export class MCPClientWrapper {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private connected: boolean = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionMonitorInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: MCPServerConfig
  ) {}

  /**
   * Substitute environment variables in a string
   * Replaces ${VAR_NAME} with the value from process.env
   */
  private substituteEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  /**
   * Process environment variables object, substituting any ${VAR} patterns
   */
  private processEnvVars(env?: Record<string, string>): Record<string, string> | undefined {
    if (!env) return undefined;
    
    const processed: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      processed[key] = this.substituteEnvVars(value);
    }
    return processed;
  }

  async connect(): Promise<void> {
    if (this.connected && this.isClientAlive()) {
      console.log('Already connected to MCP server:', this.config.name);
      return;
    }

    // If already connecting, wait for that to complete
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    try {
      // Determine transport type
      const transportType = this.config.transportType || (this.config.url ? 'http' : 'stdio');
      
      if (transportType === 'http' && this.config.url) {
        // HTTP-based transport (e.g., Smithery CLI)
        console.log('Creating HTTP transport for:', this.config.name, 'at', this.config.url);
        
        try {
          const url = new URL(this.config.url);
          
          // Add API key to URL if provided
          if (this.config.apiKey) {
            url.searchParams.set('api_key', this.config.apiKey);
          }
          
          this.transport = new StreamableHTTPClientTransport(url, {
            requestInit: {
              headers: {
                'User-Agent': 'gemini-chatbot-v2/1.0.0',
                ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
              }
            }
          });
        } catch (error) {
          console.error('Failed to create StreamableHTTPClientTransport:', error);
          throw new Error(`Failed to create HTTP transport: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Standard stdio transport
        console.log('Starting MCP server:', this.config.command, this.config.args);
        
        // Ensure command exists
        if (!this.config.command) {
          throw new Error('Command is required for stdio transport but was undefined');
        }

        // Create transport with server parameters - let it spawn the process
        const serverParams = {
          command: this.config.command,
          args: this.config.args,
          env: {
            ...process.env,
            ...this.processEnvVars(this.config.env),
          },
          stderr: 'pipe' as const, // Pipe stderr so we can read error output
        };
        
        console.log('Creating StdioClientTransport with params:', serverParams);
        
        try {
          this.transport = new StdioClientTransport(serverParams);
        } catch (error) {
          console.error('Failed to create StdioClientTransport:', error);
          throw new Error(`Failed to create transport: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Set up stderr monitoring if available for stdio transport
        if ('stderr' in this.transport && this.transport.stderr) {
          const stderr = this.transport.stderr as NodeJS.ReadableStream;
          stderr.on('data', (data: Buffer) => {
            const stderrText = data.toString();
            console.error(`MCP server stderr (${this.config.name}):`, stderrText);
            
            // Check for specific error patterns
            if (stderrText.includes('command not found') || stderrText.includes('cannot find module')) {
              console.error('The MCP server command or package may not be installed');
            }
          });
        }
      }

      // Create client
      this.client = new Client(
        {
          name: 'gemini-chatbot-v2',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect with timeout
      const connectTimeout = setTimeout(() => {
        throw new Error('MCP client connection timeout after 30 seconds');
      }, 30000);

      try {
        console.log('Connecting client to transport...');
        this.connectionPromise = this.client.connect(this.transport);
        await this.connectionPromise;
        clearTimeout(connectTimeout);
        this.connected = true;
        this.connectionPromise = null;
        console.log('Connected to MCP server:', this.config.name);
        
        // Start connection monitoring
        this.startConnectionMonitor();
      } catch (connectError) {
        clearTimeout(connectTimeout);
        this.connectionPromise = null;
        console.error('Failed to connect MCP client:', connectError);
        throw connectError;
      }
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectionPromise = null;
    
    // Stop connection monitoring
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
    }
    
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing client:', error);
      }
      this.client = null;
    }
    
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.error('Error closing transport:', error);
      }
      this.transport = null;
    }
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`[MCPClient] Listing tools for server: ${this.config.name}`);
      const response = await this.client.listTools();
      console.log(`[MCPClient] Raw tools response:`, JSON.stringify(response, null, 2));
      const tools = response.tools || [];
      console.log(`[MCPClient] Parsed ${tools.length} tools`);
      return tools;
    } catch (error) {
      console.error(`[MCPClient] Error listing tools for ${this.config.name}:`, error);
      // Check if it's a method not found error
      if (error instanceof Error && error.message.includes('Method not found')) {
        console.error('[MCPClient] Server does not support tool listing');
        return [];
      }
      throw error;
    }
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });

      return response.content;
    } catch (error) {
      console.error('Error calling tool:', error);
      throw error;
    }
  }

  async listResources(): Promise<MCPResource[]> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      console.log(`[MCPClient] Listing resources for server: ${this.config.name}`);
      const response = await this.client.listResources();
      console.log(`[MCPClient] Raw resources response:`, JSON.stringify(response, null, 2));
      const resources = response.resources || [];
      console.log(`[MCPClient] Parsed ${resources.length} resources`);
      return resources;
    } catch (error) {
      console.error(`[MCPClient] Error listing resources for ${this.config.name}:`, error);
      // Check if it's a method not found error
      if (error instanceof Error && error.message.includes('Method not found')) {
        console.error('[MCPClient] Server does not support resource listing');
        return [];
      }
      throw error;
    }
  }

  async readResource(uri: string): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.readResource({ uri });
      return response.contents;
    } catch (error) {
      console.error('Error reading resource:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected && this.isClientAlive();
  }

  getConfig(): MCPServerConfig {
    return this.config;
  }

  private isClientAlive(): boolean {
    if (!this.client || !this.transport) {
      return false;
    }
    
    // Check if transport is still open
    if ('closed' in this.transport && this.transport.closed) {
      return false;
    }
    
    return true;
  }

  private startConnectionMonitor(): void {
    // Clear any existing monitor
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }
    
    // Monitor connection every 5 seconds
    this.connectionMonitorInterval = setInterval(() => {
      if (this.connected && !this.isClientAlive()) {
        console.warn(`[MCPClient] Connection lost for server: ${this.config.name}`);
        this.connected = false;
        
        // Clean up dead connection
        this.disconnect().catch(error => {
          console.error('Error during connection cleanup:', error);
        });
      }
    }, 5000);
  }
}