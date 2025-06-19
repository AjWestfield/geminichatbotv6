import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserAutomationClient } from '@/lib/services/browser-automation-client';
import type { BrowserSession, WebAction, PageContent } from '@/lib/services/browser-automation';
import { toast } from 'sonner';

interface UseBrowserAutomationOptions {
  chatId?: string;
  autoStart?: boolean;
  onSessionChange?: (session: BrowserSession | null) => void;
}

export function useBrowserAutomation(options: UseBrowserAutomationOptions = {}) {
  const { chatId, autoStart = false, onSessionChange } = options;
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const browserClient = useRef(getBrowserAutomationClient());

  // Store session ID in localStorage per chat
  const storageKey = chatId ? `browser-session-${chatId}` : null;

  // Initialize or restore session
  useEffect(() => {
    const initSession = async () => {
      if (!autoStart && !storageKey) return;

      try {
        setIsLoading(true);
        setError(null);

        // Try to restore previous session
        if (storageKey) {
          const storedSessionId = localStorage.getItem(storageKey);
          if (storedSessionId) {
            const existingSession = browserClient.current.getSession(storedSessionId);
            if (existingSession) {
              setSession(existingSession);
              setScreenshot(existingSession.screenshot || null);
              onSessionChange?.(existingSession);
              return;
            }
          }
        }

        // Create new session if autoStart is enabled
        if (autoStart) {
          const newSession = await browserClient.current.createSession({
            headless: false,
            viewport: { width: 1280, height: 720 }
          });
          setSession(newSession);
          onSessionChange?.(newSession);
          
          if (storageKey) {
            localStorage.setItem(storageKey, newSession.id);
          }
        }
      } catch (error) {
        console.error('Failed to initialize browser session:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize browser');
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [autoStart, storageKey, onSessionChange]);

  // Set up event listeners
  useEffect(() => {
    if (!session) return;

    const handleNavigation = (sessionId: string, data: any) => {
      if (sessionId === session.id) {
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
      }
    };

    const handleClosed = (sessionId: string) => {
      if (sessionId === session.id) {
        setSession(null);
        setScreenshot(null);
        onSessionChange?.(null);
        
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }
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
  }, [session, storageKey, onSessionChange]);

  const startSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const newSession = await browserClient.current.createSession({
        headless: false,
        viewport: { width: 1280, height: 720 }
      });
      
      setSession(newSession);
      onSessionChange?.(newSession);
      
      if (storageKey) {
        localStorage.setItem(storageKey, newSession.id);
      }
      
      toast.success('Browser session started');
      return newSession;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start browser';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, onSessionChange]);

  const navigateTo = useCallback(async (url: string): Promise<PageContent | null> => {
    if (!session) {
      toast.error('No active browser session');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const pageContent = await browserClient.current.navigateTo(session.id, url);
      setScreenshot(pageContent.screenshot || null);
      
      toast.success(`Navigated to ${pageContent.title || url}`);
      return pageContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const performAction = useCallback(async (action: WebAction, params?: any) => {
    if (!session) {
      toast.error('No active browser session');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await browserClient.current.performAction(session.id, action, params);
      
      if (result.success) {
        if (result.screenshot) {
          setScreenshot(result.screenshot);
        }
        return result;
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Action failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const takeScreenshot = useCallback(async (fullPage = false): Promise<string | null> => {
    if (!session) {
      toast.error('No active browser session');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const screenshot = await browserClient.current.takeScreenshot(session.id, fullPage);
      setScreenshot(screenshot);
      
      toast.success('Screenshot captured');
      return screenshot;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Screenshot failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const closeSession = useCallback(async () => {
    if (!session) return;

    try {
      await browserClient.current.closeSession(session.id);
      setSession(null);
      setScreenshot(null);
      onSessionChange?.(null);
      
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      
      toast.success('Browser session closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to close session';
      toast.error(errorMessage);
    }
  }, [session, storageKey, onSessionChange]);

  // Utility methods
  const extractContent = useCallback(async (selector: string) => {
    if (!session) {
      toast.error('No active browser session');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await browserClient.current.extractContent(session.id, selector);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Content extraction failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const evaluateScript = useCallback(async (script: string) => {
    if (!session) {
      toast.error('No active browser session');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await browserClient.current.evaluateScript(session.id, script);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Script evaluation failed';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const clickElement = useCallback(async (selector: string) => {
    return performAction('click', { selector });
  }, [performAction]);

  const typeText = useCallback(async (selector: string, text: string) => {
    return performAction('type', { selector, text });
  }, [performAction]);

  const scrollPage = useCallback(async (x = 0, y = 100) => {
    return performAction('scroll', { x, y });
  }, [performAction]);

  const highlightElements = useCallback(async (selector: string) => {
    return performAction('highlight', { selector });
  }, [performAction]);

  return {
    // State
    session,
    isLoading,
    error,
    screenshot,
    
    // Core methods
    startSession,
    navigateTo,
    performAction,
    takeScreenshot,
    closeSession,
    
    // Utility methods
    extractContent,
    evaluateScript,
    clickElement,
    typeText,
    scrollPage,
    highlightElements,
    
    // Browser client reference
    browserClient: browserClient.current
  };
}