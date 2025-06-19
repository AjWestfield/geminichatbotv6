export interface MCPValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class MCPOperationValidator {
  /**
   * Validate a JSON string before writing to mcp.config.json
   */
  static validateConfigJSON(jsonString: string): MCPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for JavaScript expressions
    if (jsonString.includes('new Date()') || 
        jsonString.includes('Date.now()') || 
        jsonString.includes(' + ') ||
        jsonString.includes('${')) {
      errors.push('JSON contains JavaScript expressions. Use static values only.');
    }

    // Try to parse the JSON
    try {
      const config = JSON.parse(jsonString);
      
      // Validate structure
      if (!config.servers || !Array.isArray(config.servers)) {
        errors.push('Configuration must have a "servers" array');
      }
      
      if (!config.version) {
        warnings.push('Configuration should have a "version" field');
      }
      
      if (!config.lastModified) {
        warnings.push('Configuration should have a "lastModified" field');
      } else if (!this.isValidISODate(config.lastModified)) {
        errors.push('lastModified must be a valid ISO date string');
      }
      
      // Validate each server
      if (config.servers && Array.isArray(config.servers)) {
        config.servers.forEach((server: any, index: number) => {
          if (!server.id) {
            errors.push(`Server at index ${index} missing required "id" field`);
          }
          if (!server.name) {
            errors.push(`Server at index ${index} missing required "name" field`);
          }
          
          // Check for either command or url
          if (!server.command && !server.url) {
            errors.push(`Server "${server.name || index}" must have either "command" or "url"`);
          }
          
          // Validate transport type
          if (server.transportType && !['stdio', 'http'].includes(server.transportType)) {
            warnings.push(`Server "${server.name || index}" has invalid transportType: ${server.transportType}`);
          }
        });
      }
      
    } catch (e) {
      errors.push(`Invalid JSON: ${e.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate that a server was successfully added
   */
  static validateServerAdded(
    originalConfig: any, 
    newConfig: any, 
    serverName: string
  ): MCPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that new config has more servers
    if (newConfig.servers.length <= originalConfig.servers.length) {
      errors.push('Server count did not increase');
    }

    // Check that the specific server exists
    const serverExists = newConfig.servers.some((s: any) => 
      s.name === serverName || s.id === serverName.toLowerCase().replace(/\s+/g, '-')
    );
    
    if (!serverExists) {
      errors.push(`Server "${serverName}" not found in new configuration`);
    }

    // Check lastModified was updated
    if (newConfig.lastModified === originalConfig.lastModified) {
      warnings.push('lastModified timestamp was not updated');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate that a server was successfully removed
   */
  static validateServerRemoved(
    originalConfig: any, 
    newConfig: any, 
    serverName: string
  ): MCPValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that new config has fewer servers
    if (newConfig.servers.length >= originalConfig.servers.length) {
      errors.push('Server count did not decrease');
    }

    // Check that the specific server does not exist
    const serverExists = newConfig.servers.some((s: any) => 
      s.name === serverName || s.id === serverName.toLowerCase().replace(/\s+/g, '-')
    );
    
    if (serverExists) {
      errors.push(`Server "${serverName}" still exists in configuration`);
    }

    // Check lastModified was updated
    if (newConfig.lastModified === originalConfig.lastModified) {
      warnings.push('lastModified timestamp was not updated');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate a valid ISO timestamp
   */
  static generateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if a string is a valid ISO date
   */
  private static isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && 
           date.toISOString() === dateString;
  }

  /**
   * Create a safe JSON string from a config object
   */
  static createSafeJSON(config: any): string {
    // Ensure lastModified is set
    if (!config.lastModified) {
      config.lastModified = this.generateTimestamp();
    }
    
    // Convert to formatted JSON
    return JSON.stringify(config, null, 2);
  }
}