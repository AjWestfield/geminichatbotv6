'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  WebAction, 
  WebPageContext, 
  TextHighlight 
} from '@/lib/services/browser-automation';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Camera,
  MousePointer,
  Highlighter,
  Copy,
  ExternalLink,
  X
} from 'lucide-react';

interface ResearchWebViewProps {
  url: string;
  context?: WebPageContext;
  onInteraction?: (action: WebAction, params?: any) => void;
  onClose?: () => void;
  allowedActions?: WebAction[];
  className?: string;
}

export function ResearchWebView({
  url,
  context,
  onInteraction,
  onClose,
  allowedActions = ['navigate', 'screenshot', 'extract', 'highlight'],
  className = ''
}: ResearchWebViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    setCurrentUrl(url);
    setIsLoading(true);
  }, [url]);

  const handleAction = (action: WebAction, params?: any) => {
    if (onInteraction && allowedActions.includes(action)) {
      onInteraction(action, params);
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    
    // Inject highlight script if highlights are present
    if (context?.highlights && context.highlights.length > 0 && iframeRef.current) {
      try {
        const highlightScript = `
          (function() {
            const highlights = ${JSON.stringify(context.highlights)};
            highlights.forEach(h => {
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let node;
              while (node = walker.nextNode()) {
                if (node.textContent.includes(h.text)) {
                  const span = document.createElement('span');
                  span.style.backgroundColor = h.color || '#ffeb3b';
                  span.style.padding = '2px';
                  span.title = h.tooltip || '';
                  span.textContent = h.text;
                  
                  const range = document.createRange();
                  const startOffset = node.textContent.indexOf(h.text);
                  range.setStart(node, startOffset);
                  range.setEnd(node, startOffset + h.text.length);
                  range.surroundContents(span);
                }
              }
            });
          })();
        `;
        
        // Note: This would require proper iframe communication in production
        console.log('Highlight script prepared:', highlightScript);
      } catch (error) {
        console.error('Failed to inject highlights:', error);
      }
    }
  };

  const handleNavigate = (newUrl: string) => {
    if (newUrl && newUrl !== currentUrl) {
      handleAction('navigate', { url: newUrl });
      setCurrentUrl(newUrl);
    }
  };

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('back')}
          disabled={!allowedActions.includes('back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('forward')}
          disabled={!allowedActions.includes('forward')}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('reload')}
          disabled={!allowedActions.includes('reload')}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
          <input
            type="text"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNavigate(currentUrl);
              }
            }}
            className="flex-1 bg-transparent outline-none text-sm"
            placeholder="Enter URL..."
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(currentUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {allowedActions.includes('screenshot') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAction('screenshot')}
              title="Take screenshot"
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
          
          {allowedActions.includes('extract') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAction('extract', { selector: 'body' })}
              title="Extract content"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          
          {allowedActions.includes('highlight') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleAction('highlight', { text: selectedText })}
              title="Highlight selection"
              disabled={!selectedText}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          )}
        </div>

        {onClose && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Web Content */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src={currentUrl}
          onLoad={handleIframeLoad}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="Research Web View"
        />
      </div>

      {/* Status Bar */}
      {context && (
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{context.title || 'Untitled'}</span>
            {context.highlights.length > 0 && (
              <span>{context.highlights.length} highlights</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allowedActions.map(action => (
              <span key={action} className="px-2 py-1 bg-muted rounded">
                {action}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}