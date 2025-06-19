import { BaseAgent, AgentConfig } from "./base-agent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskPlan, PlannedStep } from "../workflow-engine";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class CodeAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    const codeTools = [
      new DynamicStructuredTool({
        name: "analyze_code_structure",
        description: "Analyze code structure and architecture",
        schema: z.object({
          code: z.string().describe("The code to analyze"),
          language: z.string().optional().describe("Programming language"),
          focus: z.enum(["architecture", "patterns", "quality", "security"]).optional(),
        }),
        func: async ({ code, language, focus }) => {
          const prompt = `Analyze this ${language || ""} code:
\`\`\`${language || ""}
${code}
\`\`\`

Focus: ${focus || "general analysis"}
Provide insights on structure, patterns, and potential improvements.`;

          const response = await this.invokeModel([
            new SystemMessage("You are an expert code analyst."),
            new HumanMessage(prompt),
          ]);
          
          return response.content;
        },
      }),
      new DynamicStructuredTool({
        name: "generate_tests",
        description: "Generate test cases for code",
        schema: z.object({
          code: z.string().describe("The code to test"),
          framework: z.string().optional().describe("Test framework to use"),
          coverage: z.enum(["basic", "comprehensive", "edge-cases"]).optional(),
        }),
        func: async ({ code, framework, coverage }) => {
          const prompt = `Generate ${coverage || "comprehensive"} test cases for:
\`\`\`
${code}
\`\`\`

${framework ? `Use ${framework} framework.` : ""}
Include unit tests and edge cases.`;

          const response = await this.invokeModel([
            new SystemMessage("You are an expert test engineer."),
            new HumanMessage(prompt),
          ]);
          
          return response.content;
        },
      }),
      new DynamicStructuredTool({
        name: "refactor_code",
        description: "Refactor code for better quality",
        schema: z.object({
          code: z.string().describe("The code to refactor"),
          goals: z.array(z.string()).optional().describe("Refactoring goals"),
          preserveBehavior: z.boolean().default(true),
        }),
        func: async ({ code, goals, preserveBehavior }) => {
          const prompt = `Refactor this code:
\`\`\`
${code}
\`\`\`

Goals: ${goals?.join(", ") || "improve readability, performance, and maintainability"}
${preserveBehavior ? "Preserve exact behavior." : "Improvements may change behavior if beneficial."}`;

          const response = await this.invokeModel([
            new SystemMessage("You are an expert software engineer focused on clean code."),
            new HumanMessage(prompt),
          ]);
          
          return response.content;
        },
      }),
    ];

    super({
      name: "code-agent",
      description: "Generates, analyzes, and improves code with best practices",
      modelProvider: "gemini",
      modelName: "gemini-2.0-flash-exp",
      systemPrompt: `You are an expert software engineer and code generation specialist. Your role is to:
1. Generate clean, efficient, and well-documented code
2. Follow best practices and design patterns
3. Consider performance, security, and maintainability
4. Write comprehensive tests when needed
5. Provide clear explanations for implementation decisions
6. Use modern, idiomatic approaches for each language

Always prioritize code quality, readability, and robustness.`,
      customTools: codeTools,
      ...config,
    });
  }

  async execute(input: {
    task: string;
    context?: any;
    previousResults?: any[];
    requirements?: {
      language?: string;
      framework?: string;
      style?: string;
      constraints?: string[];
    };
  }): Promise<any> {
    try {
      const { requirements } = input;
      
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(`Code Task: ${input.task}

${requirements ? `
Requirements:
- Language: ${requirements.language || "Best fit for the task"}
- Framework: ${requirements.framework || "Your recommendation"}
- Style: ${requirements.style || "Clean and modern"}
- Constraints: ${requirements.constraints?.join(", ") || "None specified"}
` : ""}

${input.context ? `Context: ${JSON.stringify(input.context)}` : ""}
${input.previousResults ? `Previous work: ${JSON.stringify(input.previousResults)}` : ""}

Please complete this coding task with high quality implementation.`),
      ];

      const response = await this.invokeModel(messages, { withTools: true });
      
      // Process tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolResults = [];
        
        for (const toolCall of response.tool_calls) {
          const result = await this.executeTool(
            toolCall.name,
            toolCall.args
          );
          toolResults.push({
            tool: toolCall.name,
            result,
          });
        }
        
        // Get final response with tool results
        messages.push(response);
        toolResults.forEach(tr => {
          messages.push(new HumanMessage(
            `Tool ${tr.tool} returned: ${JSON.stringify(tr.result)}`
          ));
        });
        
        const finalResponse = await this.invokeModel(messages);
        return {
          code: this.extractCode(finalResponse.content),
          explanation: finalResponse.content,
          toolsUsed: toolResults,
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        code: this.extractCode(response.content),
        explanation: response.content,
        toolsUsed: [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Code execution error:", error);
      throw error;
    }
  }

  async plan(objective: string, context?: any): Promise<TaskPlan> {
    const planningPrompt = `Create a detailed implementation plan for:
${objective}

${context ? `Context: ${JSON.stringify(context)}` : ""}

Break down the implementation into logical steps including:
- Architecture design
- Core implementation
- Testing
- Documentation
- Optimization`;

    const response = await this.invokeModel([
      new SystemMessage("You are a software architecture expert."),
      new HumanMessage(planningPrompt),
    ]);

    // Create structured plan
    const steps: PlannedStep[] = [
      this.createStep(
        "design",
        "Design Architecture",
        "Design the overall architecture and component structure"
      ),
      this.createStep(
        "core-impl",
        "Implement Core Functionality",
        "Implement the main features and logic",
        ["design"]
      ),
      this.createStep(
        "tests",
        "Create Test Suite",
        "Develop comprehensive tests for all components",
        ["core-impl"]
      ),
      this.createStep(
        "refactor",
        "Refactor and Optimize",
        "Refactor code for quality and performance",
        ["tests"]
      ),
      this.createStep(
        "docs",
        "Generate Documentation",
        "Create documentation and usage examples",
        ["refactor"]
      ),
    ];

    return this.createPlan(steps, 300000); // 5 minutes estimated
  }

  // Helper method to extract code blocks from response
  private extractCode(content: string): string[] {
    const codeBlocks: string[] = [];
    const regex = /```[\w]*\n([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }
    
    // If no code blocks found, assume the entire content might be code
    if (codeBlocks.length === 0 && content.includes("{") || content.includes("function")) {
      codeBlocks.push(content.trim());
    }
    
    return codeBlocks;
  }

  // Code-specific helper methods
  async analyzeRequirements(description: string): Promise<any> {
    const prompt = `Analyze these requirements and suggest:
1. Best programming language
2. Recommended frameworks/libraries
3. Architecture pattern
4. Key components needed

Requirements: ${description}`;

    const response = await this.invokeModel([
      new SystemMessage("You are a software requirements analyst."),
      new HumanMessage(prompt),
    ]);
    
    return response.content;
  }

  async generateCode(
    specification: string,
    language: string,
    options?: {
      framework?: string;
      style?: string;
      includeTests?: boolean;
    }
  ): Promise<any> {
    const result = await this.execute({
      task: `Generate ${language} code: ${specification}`,
      requirements: {
        language,
        framework: options?.framework,
        style: options?.style,
      },
    });
    
    if (options?.includeTests) {
      const tests = await this.executeTool("generate_tests", {
        code: result.code[0],
        framework: options.framework,
      });
      
      result.tests = tests;
    }
    
    return result;
  }
}