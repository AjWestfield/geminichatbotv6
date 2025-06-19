"use client"

import { useState } from 'react'
import { useMCPTools } from '@/hooks/mcp/use-mcp-tools'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Loader2, 
  Terminal, 
  AlertCircle,
  ChevronRight,
  Code,
  Play
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface MCPToolsPanelProps {
  serverId: string | null
  onToolResult?: (result: any) => void
}

export function MCPToolsPanel({ serverId, onToolResult }: MCPToolsPanelProps) {
  const { tools, loading, error, executing, executeTool } = useMCPTools(serverId)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({})

  const toggleTool = (toolName: string) => {
    const newExpanded = new Set(expandedTools)
    if (newExpanded.has(toolName)) {
      newExpanded.delete(toolName)
    } else {
      newExpanded.add(toolName)
    }
    setExpandedTools(newExpanded)
  }

  const handleExecuteTool = async (toolName: string) => {
    try {
      const args = toolArgs[toolName] || {}
      const result = await executeTool(toolName, args)
      onToolResult?.(result)
    } catch (error) {
      console.error('Tool execution failed:', error)
    }
  }

  const updateToolArg = (toolName: string, argName: string, value: any) => {
    setToolArgs(prev => ({
      ...prev,
      [toolName]: {
        ...prev[toolName],
        [argName]: value,
      }
    }))
  }

  if (!serverId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Select an MCP server to view its tools</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5" />
          <h3 className="font-semibold">Available Tools</h3>
          <Badge variant="secondary">{tools.length}</Badge>
        </div>
        
        {tools.map((tool) => (
          <Card key={tool.name} className="overflow-hidden">
            <Collapsible
              open={expandedTools.has(tool.name)}
              onOpenChange={() => toggleTool(tool.name)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 text-left">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{tool.name}</h4>
                      {tool.description && (
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "w-4 h-4 transition-transform",
                      expandedTools.has(tool.name) && "rotate-90"
                    )}
                  />
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3 border-t">
                  {tool.inputSchema && tool.inputSchema.properties && (
                    <div className="space-y-2 pt-3">
                      <p className="text-sm font-medium text-muted-foreground">Parameters:</p>
                      {Object.entries(tool.inputSchema.properties).map(([name, schema]: [string, any]) => (
                        <div key={name} className="space-y-1">
                          <label className="text-sm font-medium flex items-center gap-1">
                            {name}
                            {tool.inputSchema.required?.includes(name) && (
                              <span className="text-destructive">*</span>
                            )}
                          </label>
                          <input
                            type={schema.type === 'number' ? 'number' : 'text'}
                            placeholder={schema.description || `Enter ${name}`}
                            className="w-full px-3 py-1 text-sm border rounded-md"
                            value={toolArgs[tool.name]?.[name] || ''}
                            onChange={(e) => {
                              const value = schema.type === 'number' 
                                ? parseFloat(e.target.value) || 0
                                : e.target.value
                              updateToolArg(tool.name, name, value)
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    size="sm"
                    onClick={() => handleExecuteTool(tool.name)}
                    disabled={executing === tool.name}
                    className="w-full"
                  >
                    {executing === tool.name ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Execute
                      </>
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
        
        {tools.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No tools available</p>
            <p className="text-sm mt-1">This server doesn&apos;t expose any tools</p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}