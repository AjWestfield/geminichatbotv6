import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { GeminiChatModel } from "../utils/gemini-adapter";
import { convertMCPToolToLangChain } from "../utils/tool-converter";
import { TaskPlan, PlannedStep } from "../workflow-engine";
import { BaseMessage } from "@langchain/core/messages";

export interface AgentConfig {
  name: string;
  description?: string;
  modelProvider: "openai" | "anthropic" | "gemini";
  modelName?: string;
  temperature?: number;
  mcpTools?: any[];
  customTools?: DynamicStructuredTool[];
  systemPrompt?: string;
  maxRetries?: number;
}

export abstract class BaseAgent {
  protected model: BaseChatModel;
  protected tools: DynamicStructuredTool[];
  protected name: string;
  protected description: string;
  protected systemPrompt: string;
  protected maxRetries: number;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description || "";
    this.systemPrompt = config.systemPrompt || this.getDefaultSystemPrompt();
    this.maxRetries = config.maxRetries || 3;
    this.model = this.initializeModel(config);
    this.tools = this.initializeTools(config);
  }

  private initializeModel(config: AgentConfig): BaseChatModel {
    switch (config.modelProvider) {
      case "openai":
        return new ChatOpenAI({
          modelName: config.modelName || "gpt-4-turbo-preview",
          temperature: config.temperature || 0.7,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
      
      case "anthropic":
        return new ChatAnthropic({
          modelName: config.modelName || "claude-3-opus-20240229",
          temperature: config.temperature || 0.7,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        });
      
      case "gemini":
        return new GeminiChatModel({
          apiKey: process.env.GEMINI_API_KEY!,
          modelName: config.modelName || "gemini-2.0-flash",
          temperature: config.temperature || 0.7,
        });
      
      default:
        throw new Error(`Unsupported model provider: ${config.modelProvider}`);
    }
  }

  private initializeTools(config: AgentConfig): DynamicStructuredTool[] {
    const langchainTools: DynamicStructuredTool[] = [];
    
    // Convert MCP tools to LangChain tools
    if (config.mcpTools) {
      config.mcpTools.forEach(mcpTool => {
        langchainTools.push(convertMCPToolToLangChain(mcpTool));
      });
    }
    
    // Add custom tools
    if (config.customTools) {
      langchainTools.push(...config.customTools);
    }
    
    return langchainTools;
  }

  protected getDefaultSystemPrompt(): string {
    return `You are ${this.name}, an intelligent agent designed to help with various tasks.
Your role is to ${this.description}.
Always be helpful, accurate, and efficient in your responses.`;
  }

  // Abstract methods that each agent must implement
  abstract async execute(input: {
    task: string;
    context?: any;
    previousResults?: any[];
  }): Promise<any>;
  
  abstract async plan(objective: string, context?: any): Promise<TaskPlan>;

  // Common helper methods
  protected async invokeModel(
    messages: BaseMessage[],
    options?: { withTools?: boolean }
  ): Promise<any> {
    try {
      if (options?.withTools && this.tools.length > 0) {
        const modelWithTools = this.model.bindTools?.(this.tools) || this.model;
        return await modelWithTools.invoke(messages);
      }
      return await this.model.invoke(messages);
    } catch (error) {
      console.error(`Error invoking model for agent ${this.name}:`, error);
      throw error;
    }
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`Retrying operation for agent ${this.name}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.executeWithRetry(operation, retryCount + 1);
      }
      throw error;
    }
  }

  // Tool execution helper
  protected async executeTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found for agent ${this.name}`);
    }
    
    return await tool.invoke(args);
  }

  // Planning helpers
  protected createStep(
    id: string,
    name: string,
    description: string,
    dependencies: string[] = []
  ): PlannedStep {
    return {
      id,
      name,
      description,
      agent: this.name,
      dependencies,
      status: "pending",
    };
  }

  protected createPlan(steps: PlannedStep[], estimatedDuration = 60000): TaskPlan {
    return {
      steps,
      totalSteps: steps.length,
      estimatedDuration,
      dependencies: this.inferDependencies(steps),
    };
  }

  private inferDependencies(steps: PlannedStep[]): any[] {
    const dependencies: any[] = [];
    
    steps.forEach((step, index) => {
      if (index > 0 && step.dependencies.length === 0) {
        // If no explicit dependencies, assume sequential dependency on previous step
        dependencies.push({
          from: steps[index - 1].id,
          to: step.id,
          type: "sequential",
        });
      } else {
        // Add explicit dependencies
        step.dependencies.forEach(depId => {
          dependencies.push({
            from: depId,
            to: step.id,
            type: "sequential",
          });
        });
      }
    });
    
    return dependencies;
  }

  // Metadata methods
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getTools(): DynamicStructuredTool[] {
    return this.tools;
  }

  getCapabilities(): string[] {
    return this.tools.map(tool => tool.name);
  }
}