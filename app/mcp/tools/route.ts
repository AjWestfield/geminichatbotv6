import { NextRequest, NextResponse } from 'next/server';
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager';

// GET /api/mcp/tools - List tools for a server
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');
    
    if (!serverId) {
      return NextResponse.json(
        { error: 'serverId is required' },
        { status: 400 }
      );
    }

    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    const tools = await serverManager.listTools(serverId);
    
    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error listing tools:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list tools' },
      { status: 500 }
    );
  }
}

// POST /api/mcp/tools - Execute a tool
export async function POST(req: NextRequest) {
  try {
    const { serverId, toolName, arguments: toolArgs } = await req.json();
    
    if (!serverId || !toolName) {
      return NextResponse.json(
        { error: 'serverId and toolName are required' },
        { status: 400 }
      );
    }

    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    const result = await serverManager.executeTool(serverId, toolName, toolArgs || {});
    
    return NextResponse.json({ 
      success: true,
      result 
    });
  } catch (error) {
    console.error('Error executing tool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute tool' },
      { status: 500 }
    );
  }
}