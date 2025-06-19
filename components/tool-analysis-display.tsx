/**
 * Component to display tool analysis results
 */

import React from 'react';
import { OrchestrationResult } from '@/lib/tool-orchestrator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Sparkles, 
  AlertCircle, 
  CheckCircle,
  ArrowRight,
  Mic,
  Image,
  Video,
  Search,
  Download,
  FileText,
  Tool
} from 'lucide-react';

interface ToolAnalysisDisplayProps {
  result: OrchestrationResult;
  onConfirm?: () => void;
  onSelectAlternative?: (toolId: string) => void;
  showDetails?: boolean;
}

export function ToolAnalysisDisplay({ 
  result, 
  onConfirm, 
  onSelectAlternative,
  showDetails = true 
}: ToolAnalysisDisplayProps) {
  // Get icon for tool
  const getToolIcon = (toolId: string) => {
    switch (toolId) {
      case 'dia-tts':
      case 'wavespeed-tts':
        return <Mic className="w-4 h-4" />;
      case 'image-generation':
      case 'image-editing':
        return <Image className="w-4 h-4" />;
      case 'video-generation':
        return <Video className="w-4 h-4" />;
      case 'web-search':
        return <Search className="w-4 h-4" />;
      case 'social-media-download':
        return <Download className="w-4 h-4" />;
      case 'file-analysis':
        return <FileText className="w-4 h-4" />;
      case 'mcp-tools':
        return <Tool className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Get confidence badge variant
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return 'default';
    if (confidence >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-4">
      {/* Main Tool Selection */}
      <Alert className={result.requiresConfirmation ? 'border-yellow-500' : 'border-blue-500'}>
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {result.requiresConfirmation ? (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-blue-500" />
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <AlertTitle className="flex items-center gap-2">
                {getToolIcon(result.toolId)}
                {result.toolName}
              </AlertTitle>
              <Badge variant={getConfidenceBadge(result.confidence)}>
                {result.confidence}% confident
              </Badge>
            </div>
            
            <AlertDescription className="space-y-2">
              <p>{result.explanation}</p>
              
              {/* Confidence Progress Bar */}
              {showDetails && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Confidence Level</span>
                    <span className={getConfidenceColor(result.confidence)}>
                      {result.confidence}%
                    </span>
                  </div>
                  <Progress value={result.confidence} className="h-2" />
                </div>
              )}
              
              {/* Parameters Display */}
              {showDetails && result.parameters && Object.keys(result.parameters).length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <p className="text-sm font-medium mb-2">Detected Parameters:</p>
                  <dl className="space-y-1">
                    {Object.entries(result.parameters).map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-sm">
                        <dt className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </dt>
                        <dd className="text-gray-600 dark:text-gray-400">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </AlertDescription>
            
            {/* Action Buttons */}
            {result.requiresConfirmation && onConfirm && (
              <div className="flex gap-2 mt-3">
                <Button onClick={onConfirm} size="sm">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirm & Execute
                </Button>
              </div>
            )}
          </div>
        </div>
      </Alert>

      {/* Alternative Tools */}
      {result.alternativeTools && result.alternativeTools.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Alternative interpretations:
          </p>
          <div className="space-y-2">
            {result.alternativeTools.map((alt) => (
              <button
                key={alt.toolId}
                onClick={() => onSelectAlternative?.(alt.toolId)}
                className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getToolIcon(alt.toolId)}
                    <span className="font-medium">{alt.toolName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {alt.confidence}%
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Intent Details */}
      {showDetails && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>Intent: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
            {result.intent}
          </code></p>
          {result.toolId === 'none' && (
            <p className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              No matching tool found. Please be more specific.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Minimal version for inline display
 */
export function ToolAnalysisBadge({ result }: { result: OrchestrationResult }) {
  const getToolIcon = (toolId: string) => {
    switch (toolId) {
      case 'dia-tts':
      case 'wavespeed-tts':
        return <Mic className="w-3 h-3" />;
      case 'image-generation':
        return <Image className="w-3 h-3" />;
      case 'video-generation':
        return <Video className="w-3 h-3" />;
      case 'web-search':
        return <Search className="w-3 h-3" />;
      default:
        return <Sparkles className="w-3 h-3" />;
    }
  };

  if (result.toolId === 'none') return null;

  return (
    <Badge variant="secondary" className="gap-1">
      {getToolIcon(result.toolId)}
      {result.toolName}
      <span className="text-xs opacity-70">({result.confidence}%)</span>
    </Badge>
  );
}