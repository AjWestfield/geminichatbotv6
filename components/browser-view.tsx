'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBrowserAutomationClient } from '@/lib/services/browser-automation-client';
import type { BrowserSession, WebAction } from '@/lib/services/browser-automation';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Camera,
  MousePointer,
  Highlighter,
  Copy,
  ExternalLink,
  X,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface BrowserViewProps {
  sessionId?: string;
  onSessionChange?: (session: BrowserSession | null) => void;
  className?: string;
}

export function BrowserView({
  sessionId: controlledSessionId,
  onSessionChange,
  className = ''
}: BrowserViewProps) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const browserClient = useRef(getBrowserAutomationClient());

  // Initialize or connect to session
  useEffect(() => {
    const initSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (controlledSessionId) {
          // Try to get existing session
          const existingSession = browserClient.current.getSession(controlledSessionId);
          if (existingSession) {
            setSession(existingSession);
            setCurrentUrl(existingSession.url);
            setScreenshot(existingSession.screenshot || null);
          }
        } else {
          // Create new session
          const newSession = await browserClient.current.createSession({
            headless: false,
            viewport: { width: 1280, height: 720 }
          });
          setSession(newSession);
          setCurrentUrl(newSession.url);
          onSessionChange?.(newSession);
        }
      } catch (error) {
        console.error('Failed to initialize browser session:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize browser');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [controlledSessionId, onSessionChange]);

  // Set up event listeners
  useEffect(() => {
    if (!session) return;

    const handleNavigation = (sessionId: string, data: any) => {
      if (sessionId === session.id) {
        setCurrentUrl(data.url);
        setSession(prev => prev ? { ...prev, url: data.url, title: data.title } : null);
      }
    };

    const handleScreenshot = (sessionId: string, data: any) => {
      if (sessionId === session.id) {
        setScreenshot(data.screenshot);
        setSession(prev => prev ? { ...prev, screenshot: data.screenshot } : null);
      }
    };

    const handleError = (sessionId: string, data: any) => {
      if (sessionId === session.id) {
        setError(data.error);
        toast.error(`Browser error: ${data.error}`);
      }
    };

    const handleClosed = (sessionId: string) => {
      if (sessionId === session.id) {
        setSession(null);
        setScreenshot(null);
        onSessionChange?.(null);
        toast.info('Browser session closed');
      }
    };

    browserClient.current.on('navigation', handleNavigation);
    browserClient.current.on('screenshot', handleScreenshot);
    browserClient.current.on('error', handleError);
    browserClient.current.on('closed', handleClosed);

    return () => {
      browserClient.current.off('navigation', handleNavigation);
      browserClient.current.off('screenshot', handleScreenshot);
      browserClient.current.off('error', handleError);
      browserClient.current.off('closed', handleClosed);
    };
  }, [session, onSessionChange]);

  const handleNavigate = useCallback(async (url: string) => {
    if (!session || !url) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const pageContent = await browserClient.current.navigateTo(session.id, url);
      setScreenshot(pageContent.screenshot || null);
      toast.success(`Navigated to ${pageContent.title}`);
    } catch (error) {
      console.error('Navigation error:', error);
      setError(error instanceof Error ? error.message : 'Navigation failed');
      toast.error('Failed to navigate');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const handleAction = useCallback(async (action: WebAction, params?: any) => {
    if (!session) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await browserClient.current.performAction(session.id, action, params);
      
      if (result.success) {
        if (result.screenshot) {
          setScreenshot(result.screenshot);
        }
        
        if (action === 'screenshot') {
          toast.success('Screenshot captured');
        }
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error(`Action ${action} error:`, error);
      setError(error instanceof Error ? error.message : 'Action failed');
      toast.error(`Failed to ${action}`);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const handleClose = useCallback(async () => {
    if (!session) return;

    try {
      await browserClient.current.closeSession(session.id);
      setSession(null);
      setScreenshot(null);
      onSessionChange?.(null);
    } catch (error) {
      console.error('Failed to close session:', error);
      toast.error('Failed to close browser session');
    }
  }, [session, onSessionChange]);

  return (
    <Card className={`flex flex-col h-full bg-[#1A1A1A] border-[#333333] ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-[#333333]">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('back')}
          disabled={!session || isLoading}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('forward')}
          disabled={!session || isLoading}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAction('reload')}
          disabled={!session || isLoading}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-[#2B2B2B] rounded-md">
          <Globe className="h-4 w-4 text-[#B0B0B0]" />
          <input
            type="text"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && currentUrl) {
                handleNavigate(currentUrl);
              }
            }}
            className="flex-1 bg-transparent outline-none text-sm text-white"
            placeholder="Enter URL..."
            disabled={!session || isLoading}
          />
          {session && currentUrl && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(currentUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleAction('screenshot')}
            title="Take screenshot"
            disabled={!session || isLoading}
          >
            <Camera className="h-4 w-4" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleAction('extract', { selector: 'body' })}
            title="Extract content"
            disabled={!session || isLoading}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {session && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Browser Content */}
      <div className="flex-1 relative overflow-hidden">
        {!session ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-[#2B2B2B] flex items-center justify-center mb-6">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Browser Automation</h3>
              <p className="text-[#B0B0B0] max-w-md mb-4">
                AI-controlled browser for web research and automation
              </p>
              <Button
                onClick={async () => {
                  const newSession = await browserClient.current.createSession();
                  setSession(newSession);
                  onSessionChange?.(newSession);
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Browser Session'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A]/80 z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <p className="text-sm text-[#B0B0B0]">Loading...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="absolute top-4 left-4 right-4 z-20">
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            )}
            
            {screenshot ? (
              <img
                src={screenshot}
                alt="Browser view"
                className="w-full h-full object-contain bg-[#1E1E1E]"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#B0B0B0]">Navigate to a URL to see the page</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Status Bar */}
      {session && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#333333] text-xs text-[#B0B0B0]">
          <div className="flex items-center gap-4">
            <span>Session: {session.id.substring(0, 8)}...</span>
            {session.title && <span>{session.title}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-[#2B2B2B] rounded">
              {isLoading ? 'Loading' : 'Ready'}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}