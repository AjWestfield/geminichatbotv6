import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ChatResult, ChatGeneration } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DynamicStructuredTool } from "@langchain/core/tools";

export interface GeminiAdapterConfig {
  apiKey: string;
  modelName?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export class GeminiChatModel extends BaseChatModel {
  private client: GoogleGenerativeAI;
  private modelName: string;
  private temperature: number;
  private maxOutputTokens: number;
  private topP: number;
  private topK: number;

  constructor(config: GeminiAdapterConfig) {
    super({});
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.modelName || "gemini-2.0-flash-exp";
    this.temperature = config.temperature ?? 0.7;
    this.maxOutputTokens = config.maxOutputTokens ?? 8192;
    this.topP = config.topP ?? 0.95;
    this.topK = config.topK ?? 40;
  }

  _llmType(): string {
    return "gemini";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: this.temperature,
        topP: this.topP,
        topK: this.topK,
        maxOutputTokens: this.maxOutputTokens,
      },
    });

    // Convert messages to Gemini format
    const geminiMessages = this.convertToGeminiFormat(messages);
    
    // If there are tools, add them to the model
    if (options?.tools && options.tools.length > 0) {
      const functionDeclarations = this.convertToolsToGemini(options.tools);
      const modelWithTools = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: this.temperature,
          topP: this.topP,
          topK: this.topK,
          maxOutputTokens: this.maxOutputTokens,
        },
        tools: [{ functionDeclarations }],
      });
      
      const chat = modelWithTools.startChat({
        history: geminiMessages.slice(0, -1),
      });
      
      const result = await chat.sendMessage(geminiMessages[geminiMessages.length - 1].parts[0].text!);
      const response = await result.response;
      
      return this.convertGeminiResponse(response);
    } else {
      const chat = model.startChat({
        history: geminiMessages.slice(0, -1),
      });
      
      const result = await chat.sendMessage(geminiMessages[geminiMessages.length - 1].parts[0].text!);
      const response = await result.response;
      
      return this.convertGeminiResponse(response);
    }
  }

  private convertToGeminiFormat(messages: BaseMessage[]): any[] {
    return messages.map(message => {
      if (message instanceof HumanMessage) {
        return {
          role: "user",
          parts: [{ text: message.content as string }],
        };
      } else if (message instanceof AIMessage) {
        return {
          role: "model",
          parts: [{ text: message.content as string }],
        };
      } else if (message instanceof SystemMessage) {
        // Gemini doesn't have system messages, so we prepend to first user message
        return {
          role: "user",
          parts: [{ text: `System: ${message.content}` }],
        };
      } else if (message instanceof ToolMessage) {
        return {
          role: "function",
          parts: [{
            functionResponse: {
              name: message.name,
              response: { content: message.content },
            },
          }],
        };
      }
      
      // Default fallback
      return {
        role: "user",
        parts: [{ text: message.content as string }],
      };
    });
  }

  private convertToolsToGemini(tools: DynamicStructuredTool[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.zodSchemaToGeminiSchema(tool.schema),
    }));
  }

  private zodSchemaToGeminiSchema(zodSchema: any): any {
    // This is a simplified conversion - you might need to expand this
    const shape = zodSchema._def?.shape?.() || {};
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as any;
      const isOptional = zodType._def?.typeName === "ZodOptional";
      const actualType = isOptional ? zodType._def.innerType : zodType;
      
      if (!isOptional) {
        required.push(key);
      }

      // Convert Zod type to JSON Schema type
      const typeName = actualType._def?.typeName;
      let type = "string"; // default
      
      switch (typeName) {
        case "ZodString":
          type = "string";
          break;
        case "ZodNumber":
          type = "number";
          break;
        case "ZodBoolean":
          type = "boolean";
          break;
        case "ZodArray":
          type = "array";
          break;
        case "ZodObject":
          type = "object";
          break;
      }

      properties[key] = {
        type,
        description: actualType._def?.description || "",
      };
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  private convertGeminiResponse(response: any): ChatResult {
    const text = response.text();
    const functionCalls = response.functionCalls();
    
    let content = text;
    let additionalKwargs: any = {};

    if (functionCalls && functionCalls.length > 0) {
      additionalKwargs.tool_calls = functionCalls.map((call: any) => ({
        id: Math.random().toString(36).substring(7),
        name: call.name,
        args: call.args,
      }));
    }

    const message = new AIMessage({
      content,
      additional_kwargs: additionalKwargs,
    });

    const generation: ChatGeneration = {
      text: content,
      message,
    };

    return {
      generations: [generation],
    };
  }

  bindTools(tools: DynamicStructuredTool[]): GeminiChatModel {
    // Return a new instance with tools bound
    const newInstance = new GeminiChatModel({
      apiKey: this.client.apiKey!,
      modelName: this.modelName,
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
      topP: this.topP,
      topK: this.topK,
    });
    
    // Store tools on the instance for use in _generate
    (newInstance as any)._boundTools = tools;
    
    return newInstance;
  }
}