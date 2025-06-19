import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// Convert MCP tool to LangChain tool
export function convertMCPToolToLangChain(mcpTool: any): DynamicStructuredTool {
  // Parse MCP tool schema to Zod schema
  const zodSchema = convertMCPSchemaToZod(mcpTool.inputSchema || {});
  
  return new DynamicStructuredTool({
    name: mcpTool.name,
    description: mcpTool.description,
    schema: zodSchema,
    func: async (input: any) => {
      try {
        // Call MCP tool through the MCP client
        const response = await fetch("/api/mcp/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            server: mcpTool.server,
            tool: mcpTool.name,
            arguments: input,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`MCP tool execution failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.content || result;
      } catch (error) {
        console.error(`Error executing MCP tool ${mcpTool.name}:`, error);
        throw error;
      }
    },
  });
}

// Convert MCP JSON Schema to Zod schema
function convertMCPSchemaToZod(mcpSchema: any): z.ZodObject<any> {
  const zodShape: Record<string, z.ZodTypeAny> = {};
  
  if (mcpSchema.properties) {
    for (const [key, value] of Object.entries(mcpSchema.properties)) {
      zodShape[key] = convertPropertyToZod(value as any, mcpSchema.required?.includes(key));
    }
  }
  
  return z.object(zodShape);
}

function convertPropertyToZod(property: any, isRequired: boolean = false): z.ZodTypeAny {
  let zodType: z.ZodTypeAny;
  
  switch (property.type) {
    case "string":
      zodType = z.string();
      if (property.enum) {
        zodType = z.enum(property.enum as [string, ...string[]]);
      }
      break;
    case "number":
    case "integer":
      zodType = z.number();
      if (property.minimum !== undefined) {
        zodType = (zodType as z.ZodNumber).min(property.minimum);
      }
      if (property.maximum !== undefined) {
        zodType = (zodType as z.ZodNumber).max(property.maximum);
      }
      break;
    case "boolean":
      zodType = z.boolean();
      break;
    case "array":
      if (property.items) {
        zodType = z.array(convertPropertyToZod(property.items, true));
      } else {
        zodType = z.array(z.any());
      }
      break;
    case "object":
      if (property.properties) {
        zodType = convertMCPSchemaToZod(property);
      } else {
        zodType = z.object({}).passthrough();
      }
      break;
    default:
      zodType = z.any();
  }
  
  if (property.description) {
    zodType = zodType.describe(property.description);
  }
  
  if (!isRequired) {
    zodType = zodType.optional();
  }
  
  if (property.default !== undefined) {
    zodType = zodType.default(property.default);
  }
  
  return zodType;
}

// Convert LangChain tool result back to MCP format
export function convertLangChainResultToMCP(result: any): any {
  if (typeof result === "string") {
    return { content: result };
  }
  
  if (result && typeof result === "object") {
    if (result.content) {
      return result;
    }
    return { content: JSON.stringify(result, null, 2) };
  }
  
  return { content: String(result) };
}

// Batch convert MCP tools
export function convertMCPToolsToLangChain(mcpTools: any[]): DynamicStructuredTool[] {
  return mcpTools.map(tool => convertMCPToolToLangChain(tool));
}

// Create a wrapper for existing API endpoints as LangChain tools
export function createAPITool(
  name: string,
  description: string,
  endpoint: string,
  schema: z.ZodObject<any>
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input: any) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      return response.json();
    },
  });
}