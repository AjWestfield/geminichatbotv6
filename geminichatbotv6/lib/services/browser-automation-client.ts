import { z } from 'zod';
import {
  WebAction,
  WebActionSchema,
  BrowserOptions,
  BrowserSession,
  PageContent,
  ExtractedData,
  ActionResult,
  TextHighlight,
  WebPageContext,
  WebViewSession
} from './browser-automation';

// Browser automation client that connects to the server API
export class BrowserAutomationClient {
  private baseUrl: string;
  private sessions: Map<string, BrowserSession> = new Map();
  private eventStreams: Map<string, EventSource> = new Map();

  constructor(baseUrl: string = '/api/browser') {
    this.baseUrl = baseUrl;
  }

  async createSession(options: BrowserOptions = {}): Promise<BrowserSession> {
    const response = await fetch(`${this.baseUrl}?action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create session');
    }

    const { session } = await response.json();
    this.sessions.set(session.id, session);
    
    // Start event stream for real-time updates
    this.startEventStream(session.id);
    
    return session;
  }

  async navigateTo(sessionId: string, url: string): Promise<PageContent> {
    const response = await fetch(`${this.baseUrl}?action=navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to navigate');
    }

    const { pageContent } = await response.json();
    
    // Update local session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.url = pageContent.url;
      session.title = pageContent.title;
      session.screenshot = pageContent.screenshot;
    }
    
    return pageContent;
  }

  async extractContent(sessionId: string, selector: string): Promise<ExtractedData> {
    const response = await fetch(`${this.baseUrl}?action=extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, selector })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract content');
    }

    const { data } = await response.json();
    return data;
  }

  async performAction(sessionId: string, action: WebAction, params?: any): Promise<ActionResult> {
    const response = await fetch(`${this.baseUrl}?action=perform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action, params })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Action failed' };
    }

    const { result } = await response.json();
    
    // Update screenshot if available
    if (result.screenshot) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.screenshot = result.screenshot;
      }
    }
    
    return result;
  }

  async takeScreenshot(sessionId: string, fullPage = false): Promise<string> {
    const response = await fetch(`${this.baseUrl}?action=screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, fullPage })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to take screenshot');
    }

    const { screenshot } = await response.json();
    
    // Update local session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.screenshot = screenshot;
    }
    
    return screenshot;
  }

  async evaluateScript(sessionId: string, script: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}?action=evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, script })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to evaluate script');
    }

    const { result } = await response.json();
    return result;
  }

  async closeSession(sessionId: string): Promise<void> {
    // Close event stream
    const eventSource = this.eventStreams.get(sessionId);
    if (eventSource) {
      eventSource.close();
      this.eventStreams.delete(sessionId);
    }

    // Close session on server
    const response = await fetch(`${this.baseUrl}?sessionId=${sessionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to close session');
    }

    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  // Real-time event handling
  private startEventStream(sessionId: string): void {
    const eventSource = new EventSource(`${this.baseUrl}/stream?sessionId=${sessionId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleBrowserEvent(sessionId, data);
      } catch (error) {
        console.error('Failed to parse browser event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Browser event stream error:', error);
      eventSource.close();
      this.eventStreams.delete(sessionId);
    };

    this.eventStreams.set(sessionId, eventSource);
  }

  private handleBrowserEvent(sessionId: string, event: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    switch (event.type) {
      case 'navigation':
        session.url = event.url;
        session.title = event.title;
        this.notifyListeners('navigation', sessionId, event);
        break;
        
      case 'screenshot':
        session.screenshot = event.screenshot;
        this.notifyListeners('screenshot', sessionId, event);
        break;
        
      case 'session_closed':
        this.sessions.delete(sessionId);
        this.eventStreams.get(sessionId)?.close();
        this.eventStreams.delete(sessionId);
        this.notifyListeners('closed', sessionId, event);
        break;
        
      case 'error':
        this.notifyListeners('error', sessionId, event);
        break;
    }
  }

  // Event listener management
  private listeners: Map<string, Set<(sessionId: string, data: any) => void>> = new Map();

  on(event: string, callback: (sessionId: string, data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (sessionId: string, data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private notifyListeners(event: string, sessionId: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(sessionId, data);
      } catch (error) {
        console.error(`Error in browser event listener:`, error);
      }
    });
  }

  // Utility methods
  async waitForSelector(sessionId: string, selector: string, timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.extractContent(sessionId, selector);
        if (result.count > 0) return true;
      } catch {
        // Ignore errors, keep trying
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }

  async fillForm(sessionId: string, formData: Record<string, string>): Promise<void> {
    for (const [selector, value] of Object.entries(formData)) {
      await this.performAction(sessionId, 'type', { selector, text: value });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between inputs
    }
  }

  async clickAndWait(sessionId: string, selector: string, waitForSelector?: string, timeout = 5000): Promise<void> {
    await this.performAction(sessionId, 'click', { selector });
    
    if (waitForSelector) {
      await this.waitForSelector(sessionId, waitForSelector, timeout);
    } else {
      await this.performAction(sessionId, 'wait', { timeout: 1000 });
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Close all event streams
    for (const eventSource of this.eventStreams.values()) {
      eventSource.close();
    }
    this.eventStreams.clear();

    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        console.error(`Failed to close session ${sessionId}:`, error);
      }
    }
    this.sessions.clear();
  }
}

// Singleton instance for client-side use
let clientInstance: BrowserAutomationClient | null = null;

export function getBrowserAutomationClient(): BrowserAutomationClient {
  if (!clientInstance) {
    clientInstance = new BrowserAutomationClient();
  }
  return clientInstance;
}