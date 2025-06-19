import { NextRequest, NextResponse } from 'next/server';
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager';

// POST /api/mcp/servers/[serverId]/connect - Connect to a server
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    
    // Get server manager and ensure it's loaded
    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    await serverManager.connectServer(serverId);
    
    // Get updated server info
    const server = serverManager.getServer(serverId);
    
    return NextResponse.json({ 
      success: true,
      message: 'Connected to server',
      server: server ? {
        ...server.config,
        status: server.status,
        tools: server.tools,
        resources: server.resources,
      } : null
    });
  } catch (error) {
    console.error('Error connecting to server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 500 }
    );
  }
}

// DELETE /api/mcp/servers/[serverId]/connect - Disconnect from a server
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    
    // Get server manager and ensure it's loaded
    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    await serverManager.disconnectServer(serverId);
    
    return NextResponse.json({ 
      success: true,
      message: 'Disconnected from server'
    });
  } catch (error) {
    console.error('Error disconnecting from server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect from server' },
      { status: 500 }
    );
  }
}