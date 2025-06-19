'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBrowserAutomation } from '@/hooks/use-browser-automation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Home,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  X,
  Camera,
  MousePointer,
  Maximize2,
  Copy,
  Download,
  Play,
  Pause,
  User,
  Bot,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  SkipForward,
  Settings,
  Info,
  CheckCircle,
  Clock
} from 'lucide-react';

interface EnhancedBrowserViewProps {
  sessionId?: string;
  onSessionChange?: (sessionId: string | null) => void;
  className?: string;
  agentMode?: boolean;
  onModeChange?: (mode: 'agent' | 'manual') => void;
  onCredentialRequest?: (context: {
    type: 'login' | 'payment' | 'verification';
    fields: string[];
    message: string;
  }) => Promise<Record<string, string>>;
}

interface AgentAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract' | 'screenshot';
  description: string;
  target?: string;
  value?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'paused' | 'approved';
  confidence?: number;
  requiresApproval?: boolean;
  timestamp: number;
  result?: any;
  error?: string;
}

interface MousePosition {
  x: number;
  y: number;
}

export function EnhancedBrowserView({ 
  sessionId: propSessionId, 
  onSessionChange,
  className = '',
  agentMode: propAgentMode = false,
  onModeChange,
  onCredentialRequest
}: EnhancedBrowserViewProps) {
  const {
    sessionId,
    screenshot,
    isLoading,
    error,
    createSession,
    navigate,
    goBack,
    goForward,
    reload,
    takeScreenshot,
    closeBrowser,
    getPageInfo,
    click,
    type,
    scroll,
    executeScript
  } = useBrowserAutomation(propSessionId);

  // State management
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [mode, setMode] = useState<'agent' | 'manual'>(propAgentMode ? 'agent' : 'manual');
  const [isPaused, setIsPaused] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [showSensitiveContent, setShowSensitiveContent] = useState(false);
  const [isOnSensitivePage, setIsOnSensitivePage] = useState(false);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });
  const [showMouseTrail, setShowMouseTrail] = useState(true);
  const [frameRate, setFrameRate] = useState(5);
  
  // Refs
  const screenshotRef = useRef<HTMLImageElement>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const actionQueueRef = useRef<AgentAction[]>([]);
  const executionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session on mount if not provided
  useEffect(() => {
    if (!propSessionId && !sessionId && !isInitialized) {
      createSession().then(() => {
        setIsInitialized(true);
        startFrameUpdates();
      });
    } else if (propSessionId || sessionId) {
      setIsInitialized(true);
      startFrameUpdates();
    }
  }, [propSessionId, sessionId, createSession, isInitialized]);

  // Notify parent of session changes
  useEffect(() => {
    if (onSessionChange && sessionId !== propSessionId) {
      onSessionChange(sessionId);
    }
  }, [sessionId, propSessionId, onSessionChange]);

  // Update input URL when page info changes
  useEffect(() => {
    getPageInfo().then(info => {
      if (info?.url && info.url !== url) {
        setUrl(info.url);
        setInputUrl(info.url);
        checkSensitivePage(info.url);
      }
    });
  }, [getPageInfo, url]);

  // Cleanup frame updates on unmount
  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      if (executionTimeoutRef.current) {
        clearTimeout(executionTimeoutRef.current);
      }
    };
  }, []);

  // Process action queue in agent mode
  useEffect(() => {
    if (mode === 'agent' && !isPaused && !currentActionId) {
      const pendingAction = agentActions.find(a => a.status === 'pending' || a.status === 'approved');
      if (pendingAction) {
        if (pendingAction.requiresApproval && pendingAction.status !== 'approved') {
          return; // Wait for approval
        }
        executeAgentAction(pendingAction.id);
      }
    }
  }, [mode, isPaused, currentActionId, agentActions]);

  const startFrameUpdates = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }
    
    const interval = 1000 / frameRate;
    frameIntervalRef.current = setInterval(() => {
      if (sessionId && (mode === 'agent' || isLoading)) {
        takeScreenshot();
      }
    }, interval);
  }, [mode, isLoading, frameRate, sessionId, takeScreenshot]);

  const checkSensitivePage = (url: string) => {
    const sensitivePatterns = [
      /login/i,
      /signin/i,
      /checkout/i,
      /payment/i,
      /banking/i,
      /password/i,
      /account/i,
      /verification/i,
      /oauth/i,
      /auth/i,
      /secure/i
    ];
    
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(url));
    setIsOnSensitivePage(isSensitive);
    
    if (isSensitive && mode === 'agent' && !isPaused) {
      setIsPaused(true);
      addAgentAction({
        type: 'wait',
        description: 'Paused on sensitive page - human intervention may be required',
        requiresApproval: true
      });
    }
  };

  const addAgentAction = (action: Omit<AgentAction, 'id' | 'timestamp' | 'status'>) => {
    const newAction: AgentAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending'
    };
    setAgentActions(prev => [...prev, newAction]);
    return newAction.id;
  };

  const executeAgentAction = async (actionId: string) => {
    const action = agentActions.find(a => a.id === actionId);
    if (!action || !sessionId) return;

    setCurrentActionId(actionId);
    updateActionStatus(actionId, 'executing');

    try {
      let result: any;
      
      switch (action.type) {
        case 'navigate':
          if (action.value) {
            await navigate(action.value);
            result = { url: action.value };
          }
          break;
          
        case 'click':
          if (action.target) {
            await click(action.target);
            simulateMouseMovement(action.target);
            result = { clicked: action.target };
          }
          break;
          
        case 'type':
          if (action.target && action.value) {
            // Check if this is a sensitive field
            const sensitiveFields = ['password', 'credit', 'cvv', 'ssn', 'pin'];
            const isSensitiveField = sensitiveFields.some(field => 
              action.target?.toLowerCase().includes(field)
            );
            
            if (isSensitiveField && onCredentialRequest) {
              // Request credentials from user
              setIsPaused(true);
              const credentials = await onCredentialRequest({
                type: 'login',
                fields: [action.target],
                message: `The agent needs to enter sensitive information in field: ${action.target}`
              });
              setIsPaused(false);
              
              if (credentials[action.target]) {
                await type(action.target, credentials[action.target]);
                result = { typed: '[REDACTED]' };
              }
            } else {
              await type(action.target, action.value);
              result = { typed: action.value };
            }
          }
          break;
          
        case 'scroll':
          const scrollY = parseInt(action.value || '300');
          await scroll(0, scrollY);
          result = { scrolled: scrollY };
          break;
          
        case 'extract':
          if (action.target) {
            result = await executeScript(`
              const element = document.querySelector('${action.target}');
              return element ? element.textContent : null;
            `);
          }
          break;
          
        case 'screenshot':
          await takeScreenshot();
          result = { screenshot: true };
          break;
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, parseInt(action.value || '1000')));
          result = { waited: action.value || '1000ms' };
          break;
      }
      
      updateActionStatus(actionId, 'completed', result);
    } catch (error) {
      updateActionStatus(actionId, 'failed', null, error instanceof Error ? error.message : 'Unknown error');
      console.error('Agent action failed:', error);
    } finally {
      setCurrentActionId(null);
    }
  };

  const updateActionStatus = (
    actionId: string, 
    status: AgentAction['status'], 
    result?: any, 
    error?: string
  ) => {
    setAgentActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status, result, error } 
        : action
    ));
  };

  const simulateMouseMovement = (target: string) => {
    // Enhanced mouse movement simulation with bezier curve
    const steps = 30;
    const duration = 800;
    let step = 0;
    
    // Random target position (would be enhanced with actual element detection)
    const targetX = Math.random() * 800 + 100;
    const targetY = Math.random() * 600 + 100;
    
    const startX = mousePosition.x;
    const startY = mousePosition.y;
    
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      
      // Cubic bezier easing
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      setMousePosition({
        x: startX + (targetX - startX) * eased,
        y: startY + (targetY - startY) * eased
      });
      
      if (step >= steps) {
        clearInterval(interval);
      }
    }, duration / steps);
  };

  const handleModeSwitch = () => {
    const newMode = mode === 'agent' ? 'manual' : 'agent';
    setMode(newMode);
    onModeChange?.(newMode);
    
    if (newMode === 'agent') {
      startFrameUpdates();
    }
  };

  const handleNavigate = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputUrl && sessionId) {
      if (mode === 'agent') {
        addAgentAction({
          type: 'navigate',
          description: `Navigate to ${inputUrl}`,
          value: inputUrl,
          confidence: 95
        });
      } else {
        navigate(inputUrl);
      }
    }
  }, [inputUrl, navigate, sessionId, mode]);

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleSkipAction = () => {
    if (currentActionId) {
      updateActionStatus(currentActionId, 'failed');
      setCurrentActionId(null);
    }
  };

  const handleApproveAction = (actionId: string) => {
    updateActionStatus(actionId, 'approved');
  };

  const handleRejectAction = (actionId: string) => {
    updateActionStatus(actionId, 'failed');
  };

  const handleClearActions = () => {
    setAgentActions([]);
    setCurrentActionId(null);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Card className="flex-1 flex flex-col">
        {/* Mode Indicator and Controls */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <Badge 
              variant={mode === 'agent' ? 'default' : 'secondary'}
              className="flex items-center gap-1.5"
            >
              {mode === 'agent' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {mode === 'agent' ? 'Agent Mode' : 'Manual Mode'}
            </Badge>
            
            {isOnSensitivePage && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Sensitive Page
              </Badge>
            )}
            
            {mode === 'agent' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isPaused ? 'default' : 'outline'}
                  onClick={handlePauseResume}
                  className="h-7"
                >
                  {isPaused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                
                {currentActionId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSkipAction}
                    className="h-7"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skip
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleModeSwitch}
              className="h-7"
            >
              {mode === 'agent' ? (
                <><User className="h-3 w-3 mr-1" /> Switch to Manual</>
              ) : (
                <><Bot className="h-3 w-3 mr-1" /> Switch to Agent</>
              )}
            </Button>
            
            {isOnSensitivePage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSensitiveContent(!showSensitiveContent)}
                className="h-7"
              >
                {showSensitiveContent ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMouseTrail(!showMouseTrail)}
              className="h-7"
              title="Toggle mouse trail"
            >
              <MousePointer className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* Browser Controls */}
        <div className="p-3 border-b flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            disabled={!sessionId || isLoading || mode === 'agent'}
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={goForward}
            disabled={!sessionId || isLoading || mode === 'agent'}
            title="Go forward"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={reload}
            disabled={!sessionId || isLoading || mode === 'agent'}
            title="Reload"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <form onSubmit={handleNavigate} className="flex-1 flex items-center gap-2">
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1"
              disabled={!sessionId}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!sessionId || isLoading}
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Browser Content */}
        <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-500">{error}</p>
                <Button
                  onClick={() => createSession()}
                  className="mt-4"
                >
                  Restart Browser
                </Button>
              </div>
            </div>
          )}
          
          {!error && !sessionId && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MousePointer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Browser not initialized</p>
                <Button onClick={() => createSession()}>
                  Start Browser Session
                </Button>
              </div>
            </div>
          )}
          
          {!error && sessionId && (
            <div className="relative h-full">
              {/* Screenshot with effects */}
              <div className="relative h-full">
                {screenshot ? (
                  <>
                    <motion.img 
                      key={screenshot}
                      ref={screenshotRef}
                      src={screenshot} 
                      alt="Browser view" 
                      className={cn(
                        "w-full h-full object-contain transition-all duration-200",
                        isOnSensitivePage && !showSensitiveContent ? 'blur-xl' : ''
                      )}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1 }}
                    />
                    
                    {/* Sensitive content overlay */}
                    {isOnSensitivePage && !showSensitiveContent && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                          <Shield className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Sensitive Content Hidden</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            This page contains sensitive information
                          </p>
                          <Button onClick={() => setShowSensitiveContent(true)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Show Content
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Agent mouse cursor */}
                    {mode === 'agent' && showMouseTrail && (
                      <motion.div
                        className="absolute pointer-events-none z-50"
                        style={{
                          left: mousePosition.x,
                          top: mousePosition.y,
                        }}
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.8, 1, 0.8]
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity
                        }}
                      >
                        <div className="relative -translate-x-1/2 -translate-y-1/2">
                          <MousePointer className="h-4 w-4 text-blue-500 drop-shadow-lg" />
                          <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50" />
                        </div>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Agent Action Queue */}
        {mode === 'agent' && agentActions.length > 0 && (
          <div className="border-t p-3 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Agent Actions ({agentActions.filter(a => a.status === 'pending').length} pending)
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearActions}
                className="h-6 text-xs"
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2">
              {agentActions.map(action => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-sm",
                    action.status === 'executing' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                    action.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' :
                    action.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
                    action.status === 'paused' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    action.status === 'approved' ? 'bg-purple-50 dark:bg-purple-900/20' :
                    'bg-gray-50 dark:bg-gray-800'
                  )}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={action.status}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        {action.status === 'executing' && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                        {action.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {action.status === 'failed' && <X className="h-3 w-3 text-red-500" />}
                        {action.status === 'paused' && <Pause className="h-3 w-3 text-yellow-600" />}
                        {action.status === 'approved' && <CheckCircle className="h-3 w-3 text-purple-500" />}
                        {action.status === 'pending' && <Clock className="h-3 w-3 text-gray-400" />}
                      </motion.div>
                    </AnimatePresence>
                    
                    <span className="font-medium">{action.type}</span>
                    <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                      {action.description}
                    </span>
                    
                    {action.confidence !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {action.confidence}%
                      </Badge>
                    )}
                    
                    {action.error && (
                      <span className="text-xs text-red-500" title={action.error}>
                        <Info className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  
                  {action.requiresApproval && action.status === 'pending' && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApproveAction(action.id)}
                        className="h-6 text-xs"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectAction(action.id)}
                        className="h-6 text-xs"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}