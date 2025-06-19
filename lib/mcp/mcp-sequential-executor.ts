/**
 * Sequential Executor for MCP Operations
 * 
 * This module ensures that MCP operations are executed sequentially
 * and completely, addressing the issue where agents start but don't
 * complete multi-step tasks.
 */

export interface ExecutionStep {
  id: string;
  description: string;
  tool: string;
  server: string;
  arguments: any;
  verification?: {
    tool: string;
    server: string;
    arguments: any;
    expectedResult?: (result: any) => boolean;
  };
  onError?: 'retry' | 'continue' | 'abort';
  maxRetries?: number;
}

export interface ExecutionPlan {
  name: string;
  description: string;
  steps: ExecutionStep[];
}

export class MCPSequentialExecutor {
  private executionLog: Array<{
    step: ExecutionStep;
    result: any;
    status: 'success' | 'failed' | 'skipped';
    timestamp: Date;
  }> = [];

  /**
   * Execute a plan step by step, ensuring each step completes before moving to the next
   */
  async executePlan(plan: ExecutionPlan, executeToolFn: (tool: string, server: string, args: any) => Promise<any>): Promise<{
    success: boolean;
    results: any[];
    errors: string[];
  }> {
    console.log(`[MCPSequentialExecutor] Starting execution of plan: ${plan.name}`);
    
    const results: any[] = [];
    const errors: string[] = [];
    
    for (const step of plan.steps) {
      console.log(`[MCPSequentialExecutor] Executing step: ${step.description}`);
      
      let attempts = 0;
      const maxAttempts = step.maxRetries || 1;
      let stepSucceeded = false;
      let lastResult: any;
      
      while (attempts < maxAttempts && !stepSucceeded) {
        attempts++;
        
        try {
          // Execute the main tool
          const result = await executeToolFn(step.tool, step.server, step.arguments);
          lastResult = result;
          
          // If there's a verification step, run it
          if (step.verification) {
            console.log(`[MCPSequentialExecutor] Running verification for step: ${step.description}`);
            const verificationResult = await executeToolFn(
              step.verification.tool,
              step.verification.server,
              step.verification.arguments
            );
            
            // Check if verification passed
            if (step.verification.expectedResult) {
              stepSucceeded = step.verification.expectedResult(verificationResult);
            } else {
              stepSucceeded = true; // No specific expectation, assume success
            }
            
            if (!stepSucceeded) {
              console.log(`[MCPSequentialExecutor] Verification failed for step: ${step.description}`);
            }
          } else {
            stepSucceeded = true; // No verification needed
          }
          
          if (stepSucceeded) {
            results.push(result);
            this.executionLog.push({
              step,
              result,
              status: 'success',
              timestamp: new Date()
            });
          }
          
        } catch (error) {
          console.error(`[MCPSequentialExecutor] Error in step ${step.description}:`, error);
          errors.push(`Step "${step.description}" failed: ${error.message}`);
          
          if (step.onError === 'abort') {
            this.executionLog.push({
              step,
              result: error,
              status: 'failed',
              timestamp: new Date()
            });
            return { success: false, results, errors };
          } else if (step.onError === 'continue') {
            this.executionLog.push({
              step,
              result: error,
              status: 'skipped',
              timestamp: new Date()
            });
            break; // Move to next step
          }
          // Otherwise retry (default behavior)
        }
      }
      
      if (!stepSucceeded && step.onError !== 'continue') {
        // Step failed after all retries
        return { success: false, results, errors };
      }
    }
    
    return { success: errors.length === 0, results, errors };
  }

  /**
   * Get execution log for debugging
   */
  getExecutionLog() {
    return this.executionLog;
  }

  /**
   * Clear execution log
   */
  clearLog() {
    this.executionLog = [];
  }
}

/**
 * Pre-defined execution plans for common MCP operations
 */
export const MCP_EXECUTION_PLANS = {
  ADD_SERVER: (serverName: string, serverConfig: any): ExecutionPlan => ({
    name: `Add ${serverName} MCP Server`,
    description: `Sequential plan to add ${serverName} server to configuration`,
    steps: [
      {
        id: 'read-config',
        description: 'Read current mcp.config.json',
        tool: 'read_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
        }
      },
      {
        id: 'prepare-config',
        description: 'Prepare updated configuration',
        tool: 'custom:prepare-config',
        server: 'internal',
        arguments: {
          currentConfig: '{{step:read-config:result}}',
          newServer: serverConfig
        }
      },
      {
        id: 'write-config',
        description: 'Write updated configuration',
        tool: 'write_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json',
          content: '{{step:prepare-config:result}}'
        },
        onError: 'retry',
        maxRetries: 3
      },
      {
        id: 'verify-addition',
        description: 'Verify server was added',
        tool: 'read_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
        },
        verification: {
          tool: 'custom:verify-server-exists',
          server: 'internal',
          arguments: {
            config: '{{step:verify-addition:result}}',
            serverName: serverName
          },
          expectedResult: (result) => result === true
        }
      }
    ]
  }),

  REMOVE_SERVER: (serverName: string): ExecutionPlan => ({
    name: `Remove ${serverName} MCP Server`,
    description: `Sequential plan to remove ${serverName} server from configuration`,
    steps: [
      {
        id: 'read-config',
        description: 'Read current mcp.config.json',
        tool: 'read_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
        }
      },
      {
        id: 'remove-server',
        description: 'Remove server from configuration',
        tool: 'custom:remove-server',
        server: 'internal',
        arguments: {
          currentConfig: '{{step:read-config:result}}',
          serverName: serverName
        }
      },
      {
        id: 'write-config',
        description: 'Write updated configuration',
        tool: 'write_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json',
          content: '{{step:remove-server:result}}'
        },
        onError: 'retry',
        maxRetries: 3
      },
      {
        id: 'verify-removal',
        description: 'Verify server was removed',
        tool: 'read_file',
        server: 'DesktopCommander',
        arguments: {
          path: '/Users/andersonwestfield/Desktop/geminichatbotv3/mcp.config.json'
        },
        verification: {
          tool: 'custom:verify-server-removed',
          server: 'internal',
          arguments: {
            config: '{{step:verify-removal:result}}',
            serverName: serverName
          },
          expectedResult: (result) => result === true
        }
      }
    ]
  })
};