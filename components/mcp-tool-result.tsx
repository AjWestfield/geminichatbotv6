import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MCPToolResultProps {
  tool: string
  server: string
  result: any
  status: 'completed' | 'failed'
  error?: string
  isExpanded: boolean
  onToggleExpand: () => void
  timestamp: number
  duration?: number
}

export function MCPToolResult({
  tool,
  server,
  result,
  status,
  error,
  isExpanded,
  onToggleExpand,
  timestamp,
  duration
}: MCPToolResultProps) {
  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const textToCopy = error || JSON.stringify(result, null, 2)
      await navigator.clipboard.writeText(textToCopy)
      toast.success('Results copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const getRelativeTime = () => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }

  const getResultSummary = () => {
    if (error) return error
    
    if (typeof result === 'string') {
      return result.length > 100 ? result.substring(0, 100) + '...' : result
    }
    
    if (Array.isArray(result)) {
      // Check if it's an array of MCP content objects
      const textContent = result
        .filter(item => item && typeof item === 'object' && item.type === 'text')
        .map(item => item.text || '')
        .join(' ')
      
      if (textContent) {
        return textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent
      }
      
      return `Array with ${result.length} items`
    }
    
    if (result && typeof result === 'object') {
      const keys = Object.keys(result)
      return `Object with keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`
    }
    
    return String(result)
  }

  const formatResult = () => {
    if (error) return error
    
    if (typeof result === 'string') return result
    
    // Handle array of text content (common MCP response format)
    if (Array.isArray(result)) {
      const textContent = result
        .filter(item => item && typeof item === 'object' && item.type === 'text')
        .map(item => item.text || '')
        .join('\n\n')
      
      if (textContent) return textContent
      
      // If no text content, return JSON representation
      return JSON.stringify(result, null, 2)
    }
    
    // For objects and other types
    return JSON.stringify(result, null, 2)
  }

  return (
    <Card className={cn(
      "mb-3 border transition-colors",
      "w-full max-w-full overflow-hidden", // ADD THIS LINE
      status === 'failed' ? "border-red-900/50 bg-red-950/20" : "border-zinc-800 bg-zinc-900"
    )}>
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors overflow-hidden">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              {/* Status icon */}
              {status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              )}
              
              {/* Make the text content responsive */}
              <div className="flex items-center gap-2 min-w-0 flex-col sm:flex-row">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs whitespace-nowrap",
                      status === 'failed' ? "bg-red-900/20 text-red-500" : "bg-green-900/20 text-green-500"
                    )}
                  >
                    {status}
                  </Badge>
                  
                  <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-none">{tool}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="truncate max-w-[100px] sm:max-w-none text-zinc-400">{server}</span>
                  <span>•</span>
                  <span className="whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getRelativeTime()}
                    {duration && ` (${(duration / 1000).toFixed(1)}s)`}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Keep buttons from shrinking */}
            <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        {!isExpanded && (
          <div className="px-4 pb-3 overflow-hidden">
            <p className="text-xs text-zinc-500 line-clamp-2 break-words">
              {getResultSummary()}
            </p>
          </div>
        )}
        
        <CollapsibleContent>
          <div className="border-t border-zinc-800 overflow-hidden">
            <ScrollArea className="h-[400px] w-full">
              <div className="p-4 overflow-x-auto">
                <pre className={cn(
                  "text-sm font-mono whitespace-pre-wrap break-all overflow-wrap-anywhere",
                  "max-w-full",
                  status === 'failed' ? "text-red-400" : "text-zinc-300"
                )}>
                  {formatResult()}
                </pre>
              </div>
            </ScrollArea>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
