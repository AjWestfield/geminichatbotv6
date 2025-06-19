import { BaseAgent, AgentConfig } from "./base-agent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { TaskPlan, PlannedStep } from "../workflow-engine";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class ResearchAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    const researchTools = [
      new DynamicStructuredTool({
        name: "web_search",
        description: "Search the web for information using Perplexity",
        schema: z.object({
          query: z.string().describe("The search query"),
          limit: z.number().optional().default(5).describe("Number of results"),
        }),
        func: async ({ query, limit }) => {
          // Use existing Perplexity integration
          const response = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, limit }),
          });
          
          if (!response.ok) {
            throw new Error("Search failed");
          }
          
          return response.json();
        },
      }),
      new DynamicStructuredTool({
        name: "analyze_sources",
        description: "Analyze and synthesize information from multiple sources",
        schema: z.object({
          sources: z.array(z.string()).describe("Array of source texts"),
          focus: z.string().optional().describe("Specific aspect to focus on"),
        }),
        func: async ({ sources, focus }) => {
          const prompt = `Analyze and synthesize the following sources:
${sources.map((s, i) => `Source ${i + 1}: ${s}`).join("\n\n")}

${focus ? `Focus on: ${focus}` : "Provide a comprehensive synthesis."}`;
          
          const response = await this.invokeModel([
            new SystemMessage("You are an expert research analyst."),
            new HumanMessage(prompt),
          ]);
          
          return response.content;
        },
      }),
    ];

    super({
      name: "research-agent",
      description: "Conducts thorough research on topics using web search and analysis",
      modelProvider: "gemini",
      modelName: "gemini-2.0-flash-exp",
      systemPrompt: `You are a thorough research agent. Your role is to:
1. Search for comprehensive information on topics
2. Analyze and synthesize findings from multiple sources
3. Identify key insights and patterns
4. Provide well-structured, factual reports with citations
5. Highlight any conflicting information or uncertainties

Always strive for accuracy, depth, and clarity in your research.`,
      customTools: researchTools,
      ...config,
    });
  }

  async execute(input: {
    task: string;
    context?: any;
    previousResults?: any[];
  }): Promise<any> {
    try {
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(`Research Task: ${input.task}
${input.context ? `\nContext: ${JSON.stringify(input.context)}` : ""}
${input.previousResults ? `\nPrevious findings: ${JSON.stringify(input.previousResults)}` : ""}

Please conduct thorough research and provide a comprehensive report.`),
      ];

      // Execute with tools to allow for web search
      const response = await this.invokeModel(messages, { withTools: true });
      
      // Check if the model wants to use tools
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
          research: finalResponse.content,
          sources: toolResults,
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        research: response.content,
        sources: [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Research execution error:", error);
      throw error;
    }
  }

  async plan(objective: string, context?: any): Promise<TaskPlan> {
    const planningPrompt = `Create a detailed research plan for the following objective:
${objective}

${context ? `Context: ${JSON.stringify(context)}` : ""}

Break down the research into specific steps that will ensure comprehensive coverage.
Consider different angles, sources, and validation methods.`;

    const response = await this.invokeModel([
      new SystemMessage("You are a research planning expert."),
      new HumanMessage(planningPrompt),
    ]);

    // Parse the response to create structured steps
    // This is a simplified version - in production you'd want more robust parsing
    const steps: PlannedStep[] = [
      this.createStep(
        "initial-search",
        "Initial Web Search",
        `Conduct broad search on: ${objective}`
      ),
      this.createStep(
        "deep-dive",
        "Deep Dive Research",
        "Research specific aspects identified in initial search",
        ["initial-search"]
      ),
      this.createStep(
        "synthesis",
        "Synthesize Findings",
        "Analyze and synthesize all research findings",
        ["deep-dive"]
      ),
      this.createStep(
        "validation",
        "Validate and Cross-Reference",
        "Cross-reference findings and validate accuracy",
        ["synthesis"]
      ),
    ];

    return this.createPlan(steps, 180000); // 3 minutes estimated
  }

  // Research-specific helper methods
  async searchAndAnalyze(query: string, depth: "quick" | "thorough" = "thorough"): Promise<any> {
    const searchLimit = depth === "quick" ? 3 : 10;
    
    // Search
    const searchResults = await this.executeTool("web_search", {
      query,
      limit: searchLimit,
    });
    
    // Analyze
    if (searchResults && searchResults.results) {
      const analysis = await this.executeTool("analyze_sources", {
        sources: searchResults.results.map((r: any) => r.content || r.snippet),
        focus: query,
      });
      
      return {
        query,
        searchResults,
        analysis,
        depth,
      };
    }
    
    return { query, searchResults, analysis: null, depth };
  }
}