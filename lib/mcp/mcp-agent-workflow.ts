export interface WorkflowMonitor {
  planId: string
  lastProgressTime: number
  stuckThreshold: number // milliseconds
  promptCount: number
}

export class MCPAgentWorkflow {
  private static instance: MCPAgentWorkflow
  private monitors: Map<string, WorkflowMonitor> = new Map()
  private checkInterval: NodeJS.Timeout | null = null

  private constructor() {
    // Monitoring disabled - plan context manager removed
  }

  static getInstance(): MCPAgentWorkflow {
    if (!MCPAgentWorkflow.instance) {
      MCPAgentWorkflow.instance = new MCPAgentWorkflow()
    }
    return MCPAgentWorkflow.instance
  }

  registerPlanMonitor(planId: string, stuckThreshold = 30000): void {
    // No-op - plan monitoring removed
  }

  updateProgress(planId: string): void {
    // No-op - plan monitoring removed
  }

  removePlanMonitor(planId: string): void {
    // No-op - plan monitoring removed
  }

  stopMonitoring(): void {
    // No-op - plan monitoring removed
  }

  getWorkflowStatus(): Map<string, WorkflowMonitor> {
    return new Map()
  }
}