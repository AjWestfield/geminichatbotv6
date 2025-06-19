import { Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

// Define workflow state structure
export const WorkflowState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  objective: Annotation<string>(),
  plan: Annotation<TaskPlan | null>({
    default: () => null,
  }),
  currentStep: Annotation<number>({ 
    default: () => 0 
  }),
  results: Annotation<StepResult[]>({ 
    default: () => [] 
  }),
  status: Annotation<WorkflowStatus>({ 
    default: () => "planning" 
  }),
  metadata: Annotation<WorkflowMetadata>(),
});

export type WorkflowStatus = "planning" | "executing" | "reviewing" | "completed" | "failed" | "paused";

export interface TaskPlan {
  steps: PlannedStep[];
  totalSteps: number;
  estimatedDuration: number;
  dependencies: StepDependency[];
}

export interface PlannedStep {
  id: string;
  name: string;
  description: string;
  agent: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  input?: any;
  expectedOutput?: string;
}

export interface StepDependency {
  from: string;
  to: string;
  type: "sequential" | "parallel" | "conditional";
}

export interface StepResult {
  stepId: string;
  output: any;
  duration: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowMetadata {
  id: string;
  type: string;
  startedAt: Date;
  completedAt?: Date;
  userId: string;
  chatId: string;
  config?: WorkflowConfig;
}

export interface WorkflowConfig {
  maxSteps?: number;
  maxDuration?: number; // in milliseconds
  allowParallel?: boolean;
  requireHumanApproval?: boolean;
  retryOnFailure?: boolean;
  retryAttempts?: number;
}

// Workflow events for real-time updates
export interface WorkflowEvent {
  type: 
    | "workflow_started"
    | "workflow_planning"
    | "workflow_executing"
    | "workflow_step_started"
    | "workflow_step_completed"
    | "workflow_step_failed"
    | "workflow_paused"
    | "workflow_resumed"
    | "workflow_completed"
    | "workflow_failed"
    | "workflow_cancelled";
  workflowId: string;
  timestamp: Date;
  data?: any;
}

// Utility functions for workflow state management
export function createInitialState(
  objective: string,
  userId: string,
  chatId: string,
  type: string,
  config?: WorkflowConfig
): typeof WorkflowState.State {
  return {
    messages: [new HumanMessage({ content: objective })],
    objective,
    plan: null,
    currentStep: 0,
    results: [],
    status: "planning",
    metadata: {
      id: uuidv4(),
      type,
      startedAt: new Date(),
      userId,
      chatId,
      config,
    },
  };
}

export function isWorkflowComplete(state: typeof WorkflowState.State): boolean {
  return state.status === "completed" || state.status === "failed";
}

export function canProceedToNextStep(state: typeof WorkflowState.State): boolean {
  if (!state.plan || isWorkflowComplete(state)) return false;
  
  const currentStep = state.plan.steps[state.currentStep];
  if (!currentStep) return false;
  
  // Check if all dependencies are satisfied
  const dependencyResults = currentStep.dependencies.map(depId => 
    state.results.find(r => r.stepId === depId)
  );
  
  return dependencyResults.every(result => result && !result.error);
}

export function getNextExecutableSteps(state: typeof WorkflowState.State): PlannedStep[] {
  if (!state.plan || isWorkflowComplete(state)) return [];
  
  const completedStepIds = new Set(state.results.map(r => r.stepId));
  const runningStepIds = new Set(
    state.plan.steps
      .filter(s => s.status === "running")
      .map(s => s.id)
  );
  
  return state.plan.steps.filter(step => {
    // Skip if already completed or running
    if (completedStepIds.has(step.id) || runningStepIds.has(step.id)) {
      return false;
    }
    
    // Check if all dependencies are completed
    return step.dependencies.every(depId => completedStepIds.has(depId));
  });
}

export function updateStepStatus(
  plan: TaskPlan,
  stepId: string,
  status: PlannedStep["status"]
): TaskPlan {
  return {
    ...plan,
    steps: plan.steps.map(step =>
      step.id === stepId ? { ...step, status } : step
    ),
  };
}