import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBrowserAutomation } from './use-browser-automation';

interface AgentAction {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'approved';
  confidence?: number;
  requiresApproval?: boolean;
  result?: any;
  error?: string;
}

interface BrowserFrame {
  screenshot: string;
  timestamp: number;
  pageInfo?: {
    url: string;
    title: string;
  };
}

interface CredentialRequest {
  type: 'login' | 'payment' | 'verification';
  fields: string[];
  context: string;
}

interface UseEnhancedBrowserOptions {
  sessionId?: string;
  mode?: 'agent' | 'manual';
  wsUrl?: string;
  onCredentialRequest?: (request: CredentialRequest) => Promise<Record<string, string>>;
  onApprovalRequest?: (action: AgentAction) => Promise<boolean>;
}

export function useEnhancedBrowser(options: UseEnhancedBrowserOptions = {}) {
  const {
    sessionId: propSessionId,
    mode: initialMode = 'manual',
    wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
    onCredentialRequest,
    onApprovalRequest
  } = options;

  // Regular browser automation hook for fallback
  const browserAutomation = useBrowserAutomation(propSessionId);
  
  // WebSocket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
  const [mode, setMode] = useState<'agent' | 'manual'>(initialMode);
  const [isPaused, setIsPaused] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [currentFrame, setCurrentFrame] = useState<BrowserFrame | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for callbacks
  const credentialCallbackRef = useRef(onCredentialRequest);
  const approvalCallbackRef = useRef(onApprovalRequest);
  
  // Update callback refs
  useEffect(() => {
    credentialCallbackRef.current = onCredentialRequest;
    approvalCallbackRef.current = onApprovalRequest;
  }, [onCredentialRequest, onApprovalRequest]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const socketInstance = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false
    });
    
    // Connection handlers
    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });
    
    socketInstance.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError('Failed to connect to browser control server');
    });
    
    // Frame updates
    socketInstance.on('frame_update', (data: BrowserFrame) => {
      setCurrentFrame(data);
    });
    
    // Mouse position updates
    socketInstance.on('mouse_position', (data: { x: number; y: number }) => {
      setMousePosition(data);
    });
    
    // Mode changes
    socketInstance.on('mode_changed', (data: { mode: 'agent' | 'manual' }) => {
      setMode(data.mode);
    });
    
    // Pause state changes
    socketInstance.on('pause_state_changed', (data: { isPaused: boolean }) => {
      setIsPaused(data.isPaused);
    });
    
    // Action updates
    socketInstance.on('action_added', (data: { actions: AgentAction[] }) => {
      setAgentActions(prev => [...prev, ...data.actions]);
    });
    
    socketInstance.on('action_completed', (data: { action: string; result: any }) => {
      // Update action status
      setAgentActions(prev => prev.map(action => 
        action.type === data.action && action.status === 'executing'
          ? { ...action, status: 'completed', result: data.result }
          : action
      ));
    });
    
    // Credential requests
    socketInstance.on('credentials_required', async (data: CredentialRequest) => {
      if (credentialCallbackRef.current) {
        const credentials = await credentialCallbackRef.current(data);
        socketInstance.emit('provide_credentials', {
          sessionId,
          type: data.type,
          fields: data.fields,
          values: credentials
        });
      }
    });
    
    // Approval requests
    socketInstance.on('approval_required', async (data: { action: AgentAction }) => {
      if (approvalCallbackRef.current) {
        const approved = await approvalCallbackRef.current(data.action);
        socketInstance.emit('approve_action', {
          sessionId,
          actionId: data.action.id,
          approved
        });
      }
    });
    
    socketInstance.connect();
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, [wsUrl]);
  
  // Create or join session
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    if (!sessionId) {
      // Create new session
      socket.emit('create_session', { mode }, (response: any) => {
        if (response.success) {
          setSessionId(response.sessionId);
        } else {
          setError(response.error);
        }
      });
    }
  }, [socket, isConnected, sessionId, mode]);
  
  // Mode switching
  const switchMode = useCallback((newMode: 'agent' | 'manual') => {
    if (!socket || !sessionId) return;
    
    socket.emit('switch_mode', { sessionId, mode: newMode }, (response: any) => {
      if (!response.success) {
        setError(response.error);
      }
    });
  }, [socket, sessionId]);
  
  // Pause/Resume
  const togglePause = useCallback(() => {
    if (!socket || !sessionId) return;
    
    socket.emit('pause_resume', { sessionId }, (response: any) => {
      if (response.success) {
        setIsPaused(response.isPaused);
      } else {
        setError(response.error);
      }
    });
  }, [socket, sessionId]);
  
  // Add agent action
  const addAgentAction = useCallback((description: string) => {
    if (!socket || !sessionId || mode !== 'agent') return;
    
    setIsLoading(true);
    socket.emit('add_action', { sessionId, description }, (response: any) => {
      setIsLoading(false);
      if (!response.success) {
        setError(response.error);
      }
    });
  }, [socket, sessionId, mode]);
  
  // Manual browser actions
  const navigate = useCallback((url: string) => {
    if (!socket || !sessionId) {
      // Fallback to regular browser automation
      return browserAutomation.navigate(url);
    }
    
    if (mode === 'agent') {
      addAgentAction(`Navigate to ${url}`);
    } else {
      socket.emit('browser_action', { 
        sessionId, 
        action: 'navigate', 
        url 
      }, (response: any) => {
        if (!response.success) {
          setError(response.error);
        }
      });
    }
  }, [socket, sessionId, mode, browserAutomation, addAgentAction]);
  
  const click = useCallback((selector: string) => {
    if (!socket || !sessionId) {
      return browserAutomation.click(selector);
    }
    
    if (mode === 'agent') {
      addAgentAction(`Click on ${selector}`);
    } else {
      socket.emit('browser_action', { 
        sessionId, 
        action: 'click', 
        selector 
      });
    }
  }, [socket, sessionId, mode, browserAutomation, addAgentAction]);
  
  const type = useCallback((selector: string, value: string) => {
    if (!socket || !sessionId) {
      return browserAutomation.type(selector, value);
    }
    
    if (mode === 'agent') {
      addAgentAction(`Type "${value}" into ${selector}`);
    } else {
      socket.emit('browser_action', { 
        sessionId, 
        action: 'type', 
        selector, 
        value 
      });
    }
  }, [socket, sessionId, mode, browserAutomation, addAgentAction]);
  
  const scroll = useCallback((x: number, y: number) => {
    if (!socket || !sessionId) {
      return browserAutomation.scroll(x, y);
    }
    
    if (mode === 'agent') {
      addAgentAction(`Scroll to position (${x}, ${y})`);
    } else {
      socket.emit('browser_action', { 
        sessionId, 
        action: 'scroll', 
        x, 
        y 
      });
    }
  }, [socket, sessionId, mode, browserAutomation, addAgentAction]);
  
  // Navigation controls
  const goBack = useCallback(() => {
    if (!socket || !sessionId || mode === 'agent') return;
    
    socket.emit('browser_action', { sessionId, action: 'back' });
  }, [socket, sessionId, mode]);
  
  const goForward = useCallback(() => {
    if (!socket || !sessionId || mode === 'agent') return;
    
    socket.emit('browser_action', { sessionId, action: 'forward' });
  }, [socket, sessionId, mode]);
  
  const reload = useCallback(() => {
    if (!socket || !sessionId || mode === 'agent') return;
    
    socket.emit('browser_action', { sessionId, action: 'reload' });
  }, [socket, sessionId, mode]);
  
  // Approve/Reject actions
  const approveAction = useCallback((actionId: string) => {
    if (!socket || !sessionId) return;
    
    socket.emit('approve_action', { sessionId, actionId, approved: true });
    
    // Update local state
    setAgentActions(prev => prev.map(action => 
      action.id === actionId ? { ...action, status: 'approved' } : action
    ));
  }, [socket, sessionId]);
  
  const rejectAction = useCallback((actionId: string) => {
    if (!socket || !sessionId) return;
    
    socket.emit('approve_action', { sessionId, actionId, approved: false });
    
    // Update local state
    setAgentActions(prev => prev.map(action => 
      action.id === actionId ? { ...action, status: 'failed' } : action
    ));
  }, [socket, sessionId]);
  
  // Clear actions
  const clearActions = useCallback(() => {
    setAgentActions([]);
  }, []);
  
  // Close session
  const closeSession = useCallback(() => {
    if (!socket || !sessionId) return;
    
    socket.emit('close_session', { sessionId }, () => {
      setSessionId(null);
      setAgentActions([]);
      setCurrentFrame(null);
    });
  }, [socket, sessionId]);
  
  return {
    // Connection state
    isConnected: isConnected || browserAutomation.sessionId !== null,
    sessionId: sessionId || browserAutomation.sessionId,
    
    // Mode and control
    mode,
    switchMode,
    isPaused,
    togglePause,
    
    // Browser state
    screenshot: currentFrame?.screenshot || browserAutomation.screenshot,
    currentUrl: currentFrame?.pageInfo?.url,
    isLoading: isLoading || browserAutomation.isLoading,
    error: error || browserAutomation.error,
    
    // Agent state
    agentActions,
    mousePosition,
    
    // Actions
    navigate,
    click,
    type,
    scroll,
    goBack,
    goForward,
    reload,
    
    // Agent control
    addAgentAction,
    approveAction,
    rejectAction,
    clearActions,
    
    // Session management
    createSession: socket ? undefined : browserAutomation.createSession,
    closeSession,
    
    // Fallback to regular browser automation if WebSocket fails
    ...(!socket && browserAutomation)
  };
}