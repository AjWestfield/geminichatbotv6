#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create server instance
const server = new Server(
  {
    name: 'mcp-calculator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const TOOLS = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'subtract',
    description: 'Subtract two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'divide',
    description: 'Divide two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'Dividend' },
        b: { type: 'number', description: 'Divisor' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'sqrt',
    description: 'Calculate square root of a number',
    inputSchema: {
      type: 'object',
      properties: {
        n: { type: 'number', description: 'Number to calculate square root of' },
      },
      required: ['n'],
    },
  },
  {
    name: 'power',
    description: 'Raise a number to a power',
    inputSchema: {
      type: 'object',
      properties: {
        base: { type: 'number', description: 'Base number' },
        exponent: { type: 'number', description: 'Exponent' },
      },
      required: ['base', 'exponent'],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;
    
    switch (name) {
      case 'add':
        result = `${args.a} + ${args.b} = ${args.a + args.b}`;
        break;
        
      case 'subtract':
        result = `${args.a} - ${args.b} = ${args.a - args.b}`;
        break;
        
      case 'multiply':
        result = `${args.a} × ${args.b} = ${args.a * args.b}`;
        break;
        
      case 'divide':
        if (args.b === 0) {
          throw new Error('Division by zero is not allowed');
        }
        result = `${args.a} ÷ ${args.b} = ${args.a / args.b}`;
        break;
        
      case 'sqrt':
        if (args.n < 0) {
          throw new Error('Cannot calculate square root of negative number');
        }
        result = `√${args.n} = ${Math.sqrt(args.n)}`;
        break;
        
      case 'power':
        result = `${args.base}^${args.exponent} = ${Math.pow(args.base, args.exponent)}`;
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Calculator MCP server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});