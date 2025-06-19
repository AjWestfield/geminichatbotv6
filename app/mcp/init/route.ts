import { NextResponse } from 'next/server';
import { MCPServerManager } from '@/lib/mcp/mcp-server-manager';

// Initialize server manager and load saved servers
export async function GET() {
  try {
    const serverManager = MCPServerManager.getInstance();
    
    // Load servers from config
    await serverManager.loadFromConfig();
    
    // Get all loaded servers
    const servers = serverManager.getAllServers();
    
    // Return server info without connecting (connections happen on-demand)
    return NextResponse.json({ 
      success: true,
      message: 'MCP server manager initialized',
      serversLoaded: servers.length,
      servers: servers.map(server => ({
        id: server.config.id,
        name: server.config.name,
        status: server.status,
        toolsCount: server.tools?.length || 0
      }))
    });
  } catch (error) {
    console.error('Error initializing MCP:', error);
    return NextResponse.json(
      { error: 'Failed to initialize MCP' },
      { status: 500 }
    );
  }
}