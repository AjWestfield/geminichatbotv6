import fs from 'fs/promises';
import path from 'path';

export interface MCPServerFileConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConfigFile {
  mcpServers: Record<string, MCPServerFileConfig>;
}

export class MCPConfigFileManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'mcp.config.json');
  }

  /**
   * Read the current MCP configuration file
   */
  async readConfig(): Promise<MCPConfigFile> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      
      // Handle both old and new format
      if (config.mcpServers) {
        return config;
      } else {
        // If it's in the old format (direct servers), wrap it
        return { mcpServers: config };
      }
    } catch (error) {
      // If file doesn't exist, return empty config
      if ((error as any).code === 'ENOENT') {
        return { mcpServers: {} };
      }
      throw error;
    }
  }

  /**
   * Write the MCP configuration file
   */
  async writeConfig(config: MCPConfigFile): Promise<void> {
    const data = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, data, 'utf-8');
  }

  /**
   * Add a server to the configuration
   */
  async addServer(name: string, serverConfig: MCPServerFileConfig): Promise<void> {
    const config = await this.readConfig();
    config.mcpServers[name] = serverConfig;
    await this.writeConfig(config);
  }

  /**
   * Remove a server from the configuration
   */
  async removeServer(name: string): Promise<boolean> {
    const config = await this.readConfig();
    if (config.mcpServers[name]) {
      delete config.mcpServers[name];
      await this.writeConfig(config);
      return true;
    }
    return false;
  }

  /**
   * Update a server configuration
   */
  async updateServer(name: string, serverConfig: MCPServerFileConfig): Promise<boolean> {
    const config = await this.readConfig();
    if (config.mcpServers[name]) {
      config.mcpServers[name] = serverConfig;
      await this.writeConfig(config);
      return true;
    }
    return false;
  }

  /**
   * List all configured servers
   */
  async listServers(): Promise<string[]> {
    const config = await this.readConfig();
    return Object.keys(config.mcpServers);
  }

  /**
   * Get a specific server configuration
   */
  async getServer(name: string): Promise<MCPServerFileConfig | null> {
    const config = await this.readConfig();
    return config.mcpServers[name] || null;
  }

  /**
   * Check if a server exists
   */
  async hasServer(name: string): Promise<boolean> {
    const config = await this.readConfig();
    return !!config.mcpServers[name];
  }

  /**
   * Backup the current configuration
   */
  async backupConfig(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.configPath.replace('.json', `.backup-${timestamp}.json`);
    
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      await fs.writeFile(backupPath, data, 'utf-8');
      return backupPath;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // No config to backup
        return '';
      }
      throw error;
    }
  }

  /**
   * Validate a server configuration
   */
  validateServerConfig(config: MCPServerFileConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.command || typeof config.command !== 'string') {
      errors.push('Command must be a non-empty string');
    }

    if (config.args && !Array.isArray(config.args)) {
      errors.push('Args must be an array of strings');
    }

    if (config.args && !config.args.every(arg => typeof arg === 'string')) {
      errors.push('All args must be strings');
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push('Env must be an object');
    }

    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          errors.push('All env keys and values must be strings');
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Import servers from another configuration
   */
  async importServers(servers: Record<string, MCPServerFileConfig>, overwrite: boolean = false): Promise<{ added: string[]; skipped: string[]; errors: string[] }> {
    const config = await this.readConfig();
    const added: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const [name, serverConfig] of Object.entries(servers)) {
      const validation = this.validateServerConfig(serverConfig);
      
      if (!validation.valid) {
        errors.push(`${name}: ${validation.errors.join(', ')}`);
        continue;
      }

      if (config.mcpServers[name] && !overwrite) {
        skipped.push(name);
        continue;
      }

      config.mcpServers[name] = serverConfig;
      added.push(name);
    }

    if (added.length > 0) {
      await this.writeConfig(config);
    }

    return { added, skipped, errors };
  }
}