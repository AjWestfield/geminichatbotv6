/**
 * Force Completion Wrapper for MCP Operations
 * 
 * This wrapper ensures that AI agents complete multi-step operations
 * by providing explicit, atomic instructions that must be executed
 * in sequence.
 */

export interface AtomicOperation {
  step: number;
  instruction: string;
  toolCall: {
    tool: string;
    server: string;
    arguments: any;
  };
  expectedOutput?: string;
  verificationRequired: boolean;
}

export interface CompletionPlan {
  operationName: string;
  totalSteps: number;
  operations: AtomicOperation[];
  rollbackPlan?: AtomicOperation[];
}

export class MCPForceCompletionWrapper {
  /**
   * Generate atomic instructions for adding an MCP server
   */
  static generateAddServerPlan(serverName: string, serverConfig: any): CompletionPlan {
    const timestamp = new Date().toISOString();
    
    return {
      operationName: `Add ${serverName} MCP Server`,
      totalSteps: 4,
      operations: [
        {
          step: 1,
          instruction: `STEP 1/4: Read the current mcp.config.json file. This is mandatory.`,
          toolCall: {
            tool: 'read_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
            }
          },
          expectedOutput: 'JSON configuration with servers array',
          verificationRequired: true
        },
        {
          step: 2,
          instruction: `STEP 2/4: Parse the configuration and prepare the new server entry. DO NOT USE JavaScript expressions in JSON.`,
          toolCall: {
            tool: 'internal:prepare',
            server: 'internal',
            arguments: {
              action: 'prepare_config',
              serverToAdd: serverConfig,
              timestamp: timestamp
            }
          },
          expectedOutput: 'Complete JSON string ready to write',
          verificationRequired: false
        },
        {
          step: 3,
          instruction: `STEP 3/4: Write the complete configuration with the new server. Use timestamp: ${timestamp}`,
          toolCall: {
            tool: 'write_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json',
              content: '{{PREPARED_JSON_FROM_STEP_2}}'
            }
          },
          expectedOutput: 'File written successfully',
          verificationRequired: true
        },
        {
          step: 4,
          instruction: `STEP 4/4: Verify the server was added by reading the file again. This step is MANDATORY.`,
          toolCall: {
            tool: 'read_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
            }
          },
          expectedOutput: `JSON configuration containing ${serverName} server`,
          verificationRequired: true
        }
      ],
      rollbackPlan: [
        {
          step: 1,
          instruction: 'ROLLBACK: Restore original configuration',
          toolCall: {
            tool: 'write_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json',
              content: '{{ORIGINAL_CONFIG_FROM_STEP_1}}'
            }
          },
          verificationRequired: true
        }
      ]
    };
  }

  /**
   * Generate atomic instructions for removing an MCP server
   */
  static generateRemoveServerPlan(serverName: string): CompletionPlan {
    const timestamp = new Date().toISOString();
    
    return {
      operationName: `Remove ${serverName} MCP Server`,
      totalSteps: 4,
      operations: [
        {
          step: 1,
          instruction: `STEP 1/4: Read the current mcp.config.json file to get the current configuration.`,
          toolCall: {
            tool: 'read_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
            }
          },
          expectedOutput: 'JSON configuration containing the server to remove',
          verificationRequired: true
        },
        {
          step: 2,
          instruction: `STEP 2/4: Remove the ${serverName} server from the configuration and prepare updated JSON.`,
          toolCall: {
            tool: 'internal:prepare',
            server: 'internal',
            arguments: {
              action: 'remove_server',
              serverToRemove: serverName,
              timestamp: timestamp
            }
          },
          expectedOutput: 'Complete JSON string without the removed server',
          verificationRequired: false
        },
        {
          step: 3,
          instruction: `STEP 3/4: Write the updated configuration without ${serverName}. Use timestamp: ${timestamp}`,
          toolCall: {
            tool: 'write_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json',
              content: '{{PREPARED_JSON_FROM_STEP_2}}'
            }
          },
          expectedOutput: 'File written successfully',
          verificationRequired: true
        },
        {
          step: 4,
          instruction: `STEP 4/4: Verify the server was removed by reading the file again. Confirm ${serverName} is NOT present.`,
          toolCall: {
            tool: 'read_file',
            server: 'DesktopCommander',
            arguments: {
              path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
            }
          },
          expectedOutput: `JSON configuration WITHOUT ${serverName} server`,
          verificationRequired: true
        }
      ]
    };
  }

  /**
   * Format instructions for the AI agent
   */
  static formatInstructionsForAgent(plan: CompletionPlan): string {
    let instructions = `# MANDATORY COMPLETION PLAN: ${plan.operationName}\n\n`;
    instructions += `You MUST complete ALL ${plan.totalSteps} steps. Do not stop until all steps are verified.\n\n`;
    
    instructions += `## CRITICAL RULES:\n`;
    instructions += `1. Execute each step in order\n`;
    instructions += `2. DO NOT skip any steps\n`;
    instructions += `3. DO NOT use JavaScript expressions in JSON (no new Date(), no concatenation)\n`;
    instructions += `4. ALWAYS verify operations by reading files after writing\n`;
    instructions += `5. If a step fails, report the error and stop\n\n`;
    
    instructions += `## EXECUTION STEPS:\n\n`;
    
    for (const op of plan.operations) {
      instructions += `### ${op.instruction}\n`;
      instructions += `Tool: ${op.toolCall.tool}\n`;
      instructions += `Server: ${op.toolCall.server}\n`;
      instructions += `Arguments: ${JSON.stringify(op.toolCall.arguments, null, 2)}\n`;
      if (op.expectedOutput) {
        instructions += `Expected: ${op.expectedOutput}\n`;
      }
      if (op.verificationRequired) {
        instructions += `⚠️ VERIFICATION REQUIRED - Check the output carefully\n`;
      }
      instructions += `\n`;
    }
    
    instructions += `## COMPLETION CHECKLIST:\n`;
    for (let i = 1; i <= plan.totalSteps; i++) {
      instructions += `- [ ] Step ${i} completed and verified\n`;
    }
    
    instructions += `\n## IMPORTANT: You must execute ALL steps and report completion status for each.`;
    
    return instructions;
  }
}

/**
 * Helper functions for config manipulation
 */
export const ConfigHelpers = {
  /**
   * Add a server to configuration
   */
  addServerToConfig(configString: string, serverConfig: any, timestamp: string): string {
    const config = JSON.parse(configString);
    
    // Add the new server
    config.servers.push(serverConfig);
    
    // Update metadata
    config.lastModified = timestamp;
    
    return JSON.stringify(config, null, 2);
  },
  
  /**
   * Remove a server from configuration
   */
  removeServerFromConfig(configString: string, serverName: string, timestamp: string): string {
    const config = JSON.parse(configString);
    
    // Remove the server
    config.servers = config.servers.filter((s: any) => 
      s.name !== serverName && 
      s.id !== serverName && 
      s.id !== serverName.toLowerCase().replace(/\s+/g, '-')
    );
    
    // Update metadata
    config.lastModified = timestamp;
    
    return JSON.stringify(config, null, 2);
  },
  
  /**
   * Verify server exists in configuration
   */
  verifyServerExists(configString: string, serverName: string): boolean {
    const config = JSON.parse(configString);
    return config.servers.some((s: any) => 
      s.name === serverName || 
      s.id === serverName || 
      s.id === serverName.toLowerCase().replace(/\s+/g, '-')
    );
  },
  
  /**
   * Verify server was removed from configuration
   */
  verifyServerRemoved(configString: string, serverName: string): boolean {
    return !this.verifyServerExists(configString, serverName);
  }
};