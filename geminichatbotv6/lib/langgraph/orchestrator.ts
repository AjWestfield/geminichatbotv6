import { StateGraph, END, START, Annotation, MemorySaver } from "@langchain/langgraph/web";
import { BaseAgent } from "./agents/base-agent";
import { ResearchAgent } from "./agents/research-agent";
import { DeepResearchAgent } from "./agents/deep-research-agent";
import { CodeAgent } from "./agents/code-agent";
import { 
  WorkflowState, 
  WorkflowEvent,
  TaskPlan,
  StepResult,
  isWorkflowComplete,
  getNextExecutableSteps,
  updateStepStatus
} from "./workflow-engine";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";

export type WorkflowType = "research" | "deep-research" | "code" | "analysis" | "creative" | "custom";

export interface OrchestratorConfig {
  maxConcurrentSteps?: number;
  enableHumanInLoop?: boolean;
  persistenceEnabled?: boolean;
  eventCallback?: (event: WorkflowEvent) => void;
}

export class WorkflowOrchestrator {
  private agents: Map<string, BaseAgent>;
  private checkpointer: MemorySaver;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxConcurrentSteps: 3,
      enableHumanInLoop: false,
      persistenceEnabled: true,
      ...config,
    };
    
    this.agents = new Map([
      ["research-agent", new ResearchAgent()],
      ["deep-research-agent", new DeepResearchAgent()],
      ["code-agent", new CodeAgent()],
    ]);
    
    this.checkpointer = new MemorySaver();
  }

  createWorkflow(type: WorkflowType) {
    const workflow = new StateGraph(WorkflowState)
      .addNode("planner", this.plannerNode.bind(this))
      .addNode("executor", this.executorNode.bind(this))
      .addNode("reviewer", this.reviewerNode.bind(this))
      .addNode("error_handler", this.errorHandlerNode.bind(this))
      .addEdge(START, "planner")
      .addConditionalEdges("planner", this.shouldExecute.bind(this), {
        execute: "executor",
        error: "error_handler",
        end: END,
      })
      .addConditionalEdges("executor", this.checkExecutionResult.bind(this), {
        review: "reviewer",
        continue: "executor",
        error: "error_handler",
        end: END,
      })
      .addConditionalEdges("reviewer", this.shouldComplete.bind(this), {
        continue: "executor",
        complete: END,
        error: "error_handler",
      })
      .addEdge("error_handler", END);

    return workflow.compile({
      checkpointer: this.config.persistenceEnabled ? this.checkpointer : undefined,
    });
  }

  private async plannerNode(
    state: typeof WorkflowState.State,
    config?: RunnableConfig
  ) {
    try {
      this.emitEvent({
        type: "workflow_planning",
        workflowId: state.metadata.id,
        timestamp: new Date(),
      });

      const agent = this.getAgentForWorkflow(state.metadata.type);
      if (!agent) {
        throw new Error(`No agent found for workflow type: ${state.metadata.type}`);
      }

      const plan = await agent.plan(state.objective, state.metadata);
      
      this.emitEvent({
        type: "workflow_executing",
        workflowId: state.metadata.id,
        timestamp: new Date(),
        data: { totalSteps: plan.totalSteps },
      });

      return {
        plan,
        status: "executing" as const,
        messages: [
          ...state.messages,
          new AIMessage({
            content: `Created execution plan with ${plan.totalSteps} steps:\n${
              plan.steps.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join("\n")
            }`,
            additional_kwargs: { plan },
          }),
        ],
      };
    } catch (error) {
      console.error("Planner error:", error);
      return {
        status: "failed" as const,
        messages: [
          ...state.messages,
          new AIMessage({
            content: `Failed to create plan: ${error.message}`,
            additional_kwargs: { error: error.message },
          }),
        ],
      };
    }
  }

  private async executorNode(
    state: typeof WorkflowState.State,
    config?: RunnableConfig
  ) {
    if (!state.plan) {
      throw new Error("No plan found in state");
    }

    try {
      // Get next executable steps (handles parallel execution)
      const executableSteps = getNextExecutableSteps(state);
      
      if (executableSteps.length === 0) {
        return {
          status: "reviewing" as const,
          messages: [
            ...state.messages,
            new AIMessage("All steps completed, moving to review."),
          ],
        };
      }

      // Execute steps (limit concurrency)
      const stepsToExecute = executableSteps.slice(0, this.config.maxConcurrentSteps);
      const results: StepResult[] = [];
      
      // Execute steps in parallel
      const executionPromises = stepsToExecute.map(async (step) => {
        this.emitEvent({
          type: "workflow_step_started",
          workflowId: state.metadata.id,
          timestamp: new Date(),
          data: { step: step.name, stepId: step.id },
        });

        const agent = this.agents.get(step.agent);
        if (!agent) {
          throw new Error(`Agent ${step.agent} not found`);
        }

        const startTime = Date.now();
        
        try {
          const result = await agent.execute({
            task: step.description,
            context: {
              objective: state.objective,
              previousSteps: state.results,
              metadata: state.metadata,
            },
            previousResults: state.results,
          });

          const stepResult: StepResult = {
            stepId: step.id,
            output: result,
            duration: Date.now() - startTime,
            startedAt: new Date(startTime),
            completedAt: new Date(),
          };

          this.emitEvent({
            type: "workflow_step_completed",
            workflowId: state.metadata.id,
            timestamp: new Date(),
            data: { step: step.name, stepId: step.id, result },
          });

          return stepResult;
        } catch (error) {
          const stepResult: StepResult = {
            stepId: step.id,
            output: null,
            duration: Date.now() - startTime,
            startedAt: new Date(startTime),
            completedAt: new Date(),
            error: error.message,
          };

          this.emitEvent({
            type: "workflow_step_failed",
            workflowId: state.metadata.id,
            timestamp: new Date(),
            data: { step: step.name, stepId: step.id, error: error.message },
          });

          return stepResult;
        }
      });

      const stepResults = await Promise.all(executionPromises);
      results.push(...stepResults);

      // Update plan with step statuses
      let updatedPlan = state.plan;
      for (const result of stepResults) {
        const status = result.error ? "failed" : "completed";
        updatedPlan = updateStepStatus(updatedPlan, result.stepId, status);
      }

      return {
        plan: updatedPlan,
        results: [...state.results, ...results],
        currentStep: state.currentStep + stepsToExecute.length,
        messages: [
          ...state.messages,
          new AIMessage({
            content: `Executed ${stepsToExecute.length} steps:\n${
              stepsToExecute.map((s, i) => 
                `- ${s.name}: ${results[i].error ? "Failed" : "Completed"}`
              ).join("\n")
            }`,
            additional_kwargs: { results },
          }),
        ],
      };
    } catch (error) {
      console.error("Executor error:", error);
      return {
        status: "failed" as const,
        messages: [
          ...state.messages,
          new AIMessage({
            content: `Execution failed: ${error.message}`,
            additional_kwargs: { error: error.message },
          }),
        ],
      };
    }
  }

  private async reviewerNode(
    state: typeof WorkflowState.State,
    config?: RunnableConfig
  ) {
    try {
      // Check if all steps are complete
      const allStepsComplete = state.plan && 
        state.plan.steps.every(step => 
          state.results.some(r => r.stepId === step.id)
        );

      if (allStepsComplete) {
        // Synthesize results
        const synthesis = await this.synthesizeResults(state);
        
        this.emitEvent({
          type: "workflow_completed",
          workflowId: state.metadata.id,
          timestamp: new Date(),
          data: { synthesis },
        });

        return {
          status: "completed" as const,
          messages: [
            ...state.messages,
            new AIMessage({
              content: synthesis,
              additional_kwargs: { 
                final: true,
                results: state.results,
              },
            }),
          ],
          metadata: {
            ...state.metadata,
            completedAt: new Date(),
          },
        };
      }

      // Check for failed steps that need retry
      const failedSteps = state.results.filter(r => r.error);
      if (failedSteps.length > 0 && state.metadata.config?.retryOnFailure) {
        // Reset failed steps for retry
        const updatedPlan = { ...state.plan! };
        failedSteps.forEach(failed => {
          const stepIndex = updatedPlan.steps.findIndex(s => s.id === failed.stepId);
          if (stepIndex >= 0) {
            updatedPlan.steps[stepIndex].status = "pending";
          }
        });

        return {
          plan: updatedPlan,
          status: "executing" as const,
          messages: [
            ...state.messages,
            new AIMessage(`Retrying ${failedSteps.length} failed steps.`),
          ],
        };
      }

      return {
        status: "executing" as const,
      };
    } catch (error) {
      console.error("Reviewer error:", error);
      return {
        status: "failed" as const,
        messages: [
          ...state.messages,
          new AIMessage({
            content: `Review failed: ${error.message}`,
            additional_kwargs: { error: error.message },
          }),
        ],
      };
    }
  }

  private async errorHandlerNode(
    state: typeof WorkflowState.State,
    config?: RunnableConfig
  ) {
    this.emitEvent({
      type: "workflow_failed",
      workflowId: state.metadata.id,
      timestamp: new Date(),
      data: { 
        error: "Workflow failed",
        lastStatus: state.status,
      },
    });

    return {
      status: "failed" as const,
      metadata: {
        ...state.metadata,
        completedAt: new Date(),
      },
    };
  }

  // Conditional edge functions
  private shouldExecute(state: typeof WorkflowState.State) {
    if (state.status === "failed") return "error";
    if (!state.plan) return "error";
    return "execute";
  }

  private checkExecutionResult(state: typeof WorkflowState.State) {
    if (state.status === "failed") return "error";
    
    // Check if we have more steps to execute
    const executableSteps = getNextExecutableSteps(state);
    if (executableSteps.length > 0) return "continue";
    
    // All steps executed, move to review
    return "review";
  }

  private shouldComplete(state: typeof WorkflowState.State) {
    if (state.status === "failed") return "error";
    if (state.status === "completed") return "complete";
    return "continue";
  }

  // Helper methods
  private getAgentForWorkflow(type: string): BaseAgent | undefined {
    switch (type) {
      case "research":
        return this.agents.get("research-agent");
      case "deep-research":
        return this.agents.get("deep-research-agent");
      case "code":
        return this.agents.get("code-agent");
      default:
        // Try to find agent by exact name
        return this.agents.get(type);
    }
  }

  private async synthesizeResults(state: typeof WorkflowState.State): Promise<string> {
    // Simple synthesis - in production this would be more sophisticated
    const summary = `## Workflow Summary: ${state.objective}

### Steps Completed:
${state.plan!.steps.map((step, i) => {
  const result = state.results.find(r => r.stepId === step.id);
  return `${i + 1}. **${step.name}**
   - Status: ${result?.error ? "Failed" : "Completed"}
   - Duration: ${result?.duration ? `${(result.duration / 1000).toFixed(2)}s` : "N/A"}
   ${result?.error ? `- Error: ${result.error}` : ""}`;
}).join("\n\n")}

### Key Results:
${state.results
  .filter(r => !r.error && r.output)
  .map(r => {
    const step = state.plan!.steps.find(s => s.id === r.stepId);
    return `- ${step?.name}: ${JSON.stringify(r.output).substring(0, 200)}...`;
  }).join("\n")}

### Summary:
Workflow completed ${state.results.filter(r => !r.error).length}/${state.plan!.totalSteps} steps successfully.`;

    return summary;
  }

  private emitEvent(event: WorkflowEvent) {
    if (this.config.eventCallback) {
      this.config.eventCallback(event);
    }
  }

  // Public methods
  addAgent(name: string, agent: BaseAgent) {
    this.agents.set(name, agent);
  }

  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}