import { WorkflowOrchestrator, WorkflowType } from "../orchestrator";
import { createInitialState } from "../workflow-engine";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

export interface WorkflowTrigger {
  pattern: RegExp;
  type: WorkflowType;
  extractObjective: (match: RegExpMatchArray, message: string) => string;
}

// Workflow triggers based on chat patterns
export const WORKFLOW_TRIGGERS: WorkflowTrigger[] = [
  {
    pattern: /^(?:deep research|comprehensive research|thorough research|detailed research)\s+(?:on\s+)?(.+)/i,
    type: "deep-research",
    extractObjective: (match) => `Deep Research: ${match[1]}`,
  },
  {
    pattern: /^(?:research deeply|investigate thoroughly|analyze comprehensively)\s+(.+)/i,
    type: "deep-research",
    extractObjective: (match) => `Deep Research: ${match[1]}`,
  },
  {
    pattern: /^(?:research|investigate|find out about|learn about)\s+(.+)/i,
    type: "research",
    extractObjective: (match) => `Research: ${match[1]}`,
  },
  {
    pattern: /^(?:create|generate|build|implement|code)\s+(.+)/i,
    type: "code",
    extractObjective: (match) => `Code generation: ${match[1]}`,
  },
  {
    pattern: /^(?:analyze|examine|review|evaluate)\s+(.+)/i,
    type: "analysis",
    extractObjective: (match) => `Analysis: ${match[1]}`,
  },
  {
    pattern: /^workflow:\s*(\w+)\s+(.+)/i,
    type: "custom",
    extractObjective: (match) => match[2],
  },
];

// Detect if a message should trigger a workflow
export function detectWorkflowTrigger(message: string): {
  shouldTrigger: boolean;
  type?: WorkflowType;
  objective?: string;
} {
  for (const trigger of WORKFLOW_TRIGGERS) {
    const match = message.match(trigger.pattern);
    if (match) {
      return {
        shouldTrigger: true,
        type: trigger.type,
        objective: trigger.extractObjective(match, message),
      };
    }
  }

  // Check for explicit workflow commands
  if (message.toLowerCase().includes("start workflow") || 
      message.toLowerCase().includes("run workflow")) {
    return {
      shouldTrigger: true,
      type: "custom",
      objective: message,
    };
  }

  return { shouldTrigger: false };
}

// Format workflow events for chat display
export function formatWorkflowEventForChat(event: any): string {
  switch (event.type) {
    case "workflow_started":
      return `🔄 **Workflow Started**\n\nObjective: ${event.objective}\n\n[WORKFLOW_STARTED:${event.workflowId}]`;
    
    case "state_update":
      const { status, currentStep, totalSteps, lastMessage } = event.state;
      let statusEmoji = "⏳";
      
      switch (status) {
        case "planning": statusEmoji = "📋"; break;
        case "executing": statusEmoji = "⚡"; break;
        case "reviewing": statusEmoji = "🔍"; break;
        case "completed": statusEmoji = "✅"; break;
        case "failed": statusEmoji = "❌"; break;
      }
      
      let update = `${statusEmoji} **Status**: ${status}`;
      
      if (totalSteps > 0) {
        const progress = Math.round((currentStep / totalSteps) * 100);
        update += `\n📊 **Progress**: ${currentStep}/${totalSteps} steps (${progress}%)`;
      }
      
      if (lastMessage) {
        update += `\n\n💬 ${lastMessage}`;
      }
      
      return update;
    
    case "workflow_completed":
      return `✅ **Workflow Completed**\n\n${event.summary || "All tasks finished successfully."}`;
    
    case "workflow_failed":
      return `❌ **Workflow Failed**\n\n${event.error || "An error occurred during execution."}`;
    
    default:
      return `📌 ${event.type}: ${JSON.stringify(event.data || {})}`;
  }
}

// Convert workflow messages to chat format
export function convertWorkflowMessagesToChat(messages: BaseMessage[]): any[] {
  return messages.map(msg => {
    if (msg instanceof HumanMessage) {
      return {
        role: "user",
        content: msg.content,
      };
    } else if (msg instanceof AIMessage) {
      return {
        role: "assistant",
        content: msg.content,
        metadata: msg.additional_kwargs,
      };
    }
    
    return {
      role: "system",
      content: msg.content,
    };
  });
}

// Create workflow status component data
export function createWorkflowStatusData(workflowId: string, state: any) {
  return {
    id: workflowId,
    type: "workflow_status",
    status: state.status,
    progress: {
      current: state.currentStep || 0,
      total: state.plan?.totalSteps || 0,
      percentage: state.plan?.totalSteps 
        ? Math.round((state.currentStep / state.plan.totalSteps) * 100) 
        : 0,
    },
    steps: state.plan?.steps.map((step: any) => ({
      id: step.id,
      name: step.name,
      status: step.status,
      duration: state.results?.find((r: any) => r.stepId === step.id)?.duration,
    })) || [],
    startedAt: state.metadata?.startedAt,
    completedAt: state.metadata?.completedAt,
  };
}

// Integration helper for chat components
export class ChatWorkflowIntegration {
  private orchestrator: WorkflowOrchestrator;
  private activeWorkflows: Map<string, any>;

  constructor() {
    this.orchestrator = new WorkflowOrchestrator({
      maxConcurrentSteps: 3,
      enableHumanInLoop: false,
      persistenceEnabled: true,
    });
    this.activeWorkflows = new Map();
  }

  async startWorkflowFromChat(
    message: string,
    chatId: string,
    userId: string,
    onEvent: (event: any) => void
  ): Promise<string | null> {
    const trigger = detectWorkflowTrigger(message);
    
    if (!trigger.shouldTrigger || !trigger.type || !trigger.objective) {
      return null;
    }

    const workflowId = await this.startWorkflow(
      trigger.type,
      trigger.objective,
      chatId,
      userId,
      onEvent
    );

    return workflowId;
  }

  async startWorkflow(
    type: WorkflowType,
    objective: string,
    chatId: string,
    userId: string,
    onEvent: (event: any) => void
  ): Promise<string> {
    const workflow = this.orchestrator.createWorkflow(type);
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const initialState = createInitialState(
      objective,
      userId,
      chatId,
      type
    );

    // Store active workflow
    this.activeWorkflows.set(workflowId, {
      workflow,
      type,
      objective,
      chatId,
      userId,
    });

    // Execute workflow asynchronously
    this.executeWorkflow(workflowId, workflow, initialState, onEvent);

    return workflowId;
  }

  private async executeWorkflow(
    workflowId: string,
    workflow: any,
    initialState: any,
    onEvent: (event: any) => void
  ) {
    try {
      // Send start event
      onEvent({
        type: "workflow_started",
        workflowId,
        objective: initialState.objective,
        timestamp: new Date().toISOString(),
      });

      const config = {
        configurable: { 
          thread_id: workflowId,
          checkpoint_ns: initialState.metadata.chatId,
        },
        streamMode: "values" as const,
      };

      // Stream execution
      for await (const state of await workflow.stream(initialState, config)) {
        onEvent({
          type: "state_update",
          workflowId,
          timestamp: new Date().toISOString(),
          state: createWorkflowStatusData(workflowId, state),
        });
      }

      // Send completion event
      onEvent({
        type: "workflow_completed",
        workflowId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Workflow execution error:", error);
      
      onEvent({
        type: "workflow_failed",
        workflowId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      // Implementation would include actual cancellation logic
      this.activeWorkflows.delete(workflowId);
      return true;
    }
    return false;
  }

  getActiveWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys());
  }
}