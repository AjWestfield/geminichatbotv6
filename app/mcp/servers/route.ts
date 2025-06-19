import { NextRequest, NextResponse } from 'next/server';
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager';
import { MCPServerConfig } from '@/lib/mcp/mcp-client';

// GET /api/mcp/servers - List all servers
export async function GET() {
  try {
    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    const servers = serverManager.getAllServers();
    return NextResponse.json({ 
      servers: servers.map(server => ({
        ...server.config,
        status: server.status,
        tools: server.tools,
        resources: server.resources,
        lastError: server.lastError,
      }))
    });
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

// POST /api/mcp/servers - Add a new server
export async function POST(req: NextRequest) {
  try {
    const config: MCPServerConfig = await req.json();
    
    // Validate config
    if (!config.id || !config.name) {
      return NextResponse.json(
        { error: 'Server configuration must include id and name' },
        { status: 400 }
      );
    }
    
    // Validate transport-specific fields
    const isHttp = config.transportType === 'http' || !!config.url;
    if (!isHttp && !config.command) {
      return NextResponse.json(
        { error: 'Server configuration must include either a command (for stdio) or url (for HTTP)' },
        { status: 400 }
      );
    }
    if (isHttp && !config.url) {
      return NextResponse.json(
        { error: 'HTTP server configuration must include a url' },
        { status: 400 }
      );
    }

    const serverManager = MCPServerManager.getInstance();
    await serverManager.loadFromConfig();
    
    await serverManager.addServer(config);
    await serverManager.saveToConfig();

    return NextResponse.json({ 
      success: true,
      message: 'Server added successfully'
    });
  } catch (error) {
    console.error('Error adding server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add server' },
      { status: 500 }
    );
  }
}

// DELETE /api/mcp/servers - Remove a server
export async function DELETE(req: NextRequest) {
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
    
    await serverManager.removeServer(serverId);
    await serverManager.saveToConfig();

    return NextResponse.json({ 
      success: true,
      message: 'Server removed successfully'
    });
  } catch (error) {
    console.error('Error removing server:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove server' },
      { status: 500 }
    );
  }
}