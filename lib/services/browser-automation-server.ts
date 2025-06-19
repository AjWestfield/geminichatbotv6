import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Types
export const WebActionSchema = z.enum([
  'click',
  'scroll',
  'extract',
  'highlight',
  'navigate',
  'screenshot',
  'back',
  'forward',
  'reload',
  'type',
  'wait'
]);

export type WebAction = z.infer<typeof WebActionSchema>;

export interface BrowserOptions {
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  timeout?: number;
}

export interface BrowserSession {
  id: string;
  url: string;
  title: string;
  screenshot?: string; // base64
  context?: BrowserContext;
  page?: Page;
  createdAt: Date;
  lastActivity: Date;
}

export interface PageContent {
  url: string;
  title: string;
  html: string;
  text: string;
  screenshot?: string;
  metadata?: Record<string, any>;
}

export interface ExtractedData {
  selector: string;
  content: string | string[];
  attributes?: Record<string, string>[];
  count: number;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
}

export interface TextHighlight {
  text: string;
  color?: string;
  tooltip?: string;
}

export interface WebPageContext {
  url: string;
  title: string;
  content: string;
  highlights: TextHighlight[];
  allowedActions: WebAction[];
}

export interface WebViewSession {
  id: string;
  url: string;
  active: boolean;
  createdAt: Date;
  context?: WebPageContext;
}

// Browser automation service (server-side with Playwright)
export class BrowserAutomationServer {
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();
  private readonly maxSessions = 5;
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes
  
  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupInactiveSessions(), 60 * 1000); // Every minute
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async createSession(options: BrowserOptions = {}): Promise<BrowserSession> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest session
      const oldestSession = Array.from(this.sessions.values())
        .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime())[0];
      if (oldestSession) {
        await this.closeSession(oldestSession.id);
      }
    }

    const browser = await this.ensureBrowser();
    const context = await browser.newContext({
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent
    });
    
    const page = await context.newPage();
    const sessionId = `session_${uuidv4()}`;
    
    const session: BrowserSession = {
      id: sessionId,
      url: 'about:blank',
      title: 'New Session',
      context,
      page,
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.sessions.set(sessionId, session);
    return {
      id: session.id,
      url: session.url,
      title: session.title,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    };
  }

  async navigateTo(sessionId: string, url: string): Promise<PageContent> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) {
      throw new Error('Session not found or invalid');
    }

    try {
      session.lastActivity = new Date();
      
      // Navigate to URL
      await session.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait a bit for dynamic content
      await session.page.waitForTimeout(1000);
      
      // Update session
      session.url = session.page.url();
      session.title = await session.page.title();
      
      // Get page content
      const html = await session.page.content();
      const text = await session.page.evaluate(() => document.body.innerText || '');
      
      // Take screenshot
      const screenshotBuffer = await session.page.screenshot({ 
        type: 'png',
        fullPage: false 
      });
      const screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
      
      return {
        url: session.url,
        title: session.title,
        html,
        text,
        screenshot,
        metadata: {
          loadTime: Date.now(),
          viewport: session.page.viewportSize()
        }
      };
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error(`Failed to navigate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractContent(sessionId: string, selector: string): Promise<ExtractedData> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) {
      throw new Error('Session not found or invalid');
    }

    try {
      session.lastActivity = new Date();
      
      // Wait for selector if needed
      try {
        await session.page.waitForSelector(selector, { timeout: 5000 });
      } catch {
        // Selector might not exist, continue anyway
      }
      
      // Extract content
      const result = await session.page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        const content: string[] = [];
        const attributes: Record<string, string>[] = [];
        
        elements.forEach(el => {
          content.push(el.textContent || '');
          const attrs: Record<string, string> = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            attrs[attr.name] = attr.value;
          }
          attributes.push(attrs);
        });
        
        return { content, attributes, count: elements.length };
      }, selector);
      
      return {
        selector,
        content: result.count === 1 ? result.content[0] : result.content,
        attributes: result.attributes,
        count: result.count
      };
    } catch (error) {
      console.error('Extract error:', error);
      throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async performAction(sessionId: string, action: WebAction, params?: any): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) {
      return { success: false, error: 'Session not found or invalid' };
    }

    session.lastActivity = new Date();

    try {
      switch (action) {
        case 'screenshot': {
          const screenshotBuffer = await session.page.screenshot({ 
            type: 'png',
            fullPage: params?.fullPage || false 
          });
          const screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
          return {
            success: true,
            data: { screenshot },
            screenshot
          };
        }

        case 'click': {
          if (!params?.selector) {
            return { success: false, error: 'Selector required for click action' };
          }
          await session.page.click(params.selector);
          await session.page.waitForTimeout(500); // Wait for any navigation/changes
          return { success: true };
        }

        case 'type': {
          if (!params?.selector || params?.text === undefined) {
            return { success: false, error: 'Selector and text required for type action' };
          }
          await session.page.fill(params.selector, params.text);
          return { success: true };
        }

        case 'scroll': {
          const x = params?.x || 0;
          const y = params?.y || 100;
          await session.page.evaluate(({ x, y }) => {
            window.scrollBy(x, y);
          }, { x, y });
          return { success: true };
        }

        case 'highlight': {
          if (!params?.selector) {
            return { success: false, error: 'Selector required for highlight action' };
          }
          
          await session.page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            elements.forEach(el => {
              const element = el as HTMLElement;
              element.style.backgroundColor = '#ffeb3b';
              element.style.border = '2px solid #f57c00';
              element.style.boxShadow = '0 0 10px rgba(255, 235, 59, 0.5)';
            });
          }, params.selector);
          
          // Take screenshot after highlighting
          const screenshotBuffer = await session.page.screenshot({ type: 'png' });
          const screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
          
          return { success: true, screenshot };
        }

        case 'navigate': {
          if (!params?.url) {
            return { success: false, error: 'URL required for navigate action' };
          }
          const pageContent = await this.navigateTo(sessionId, params.url);
          return { 
            success: true, 
            data: pageContent,
            screenshot: pageContent.screenshot 
          };
        }

        case 'back': {
          await session.page.goBack();
          await session.page.waitForLoadState('domcontentloaded');
          session.url = session.page.url();
          session.title = await session.page.title();
          return { success: true };
        }

        case 'forward': {
          await session.page.goForward();
          await session.page.waitForLoadState('domcontentloaded');
          session.url = session.page.url();
          session.title = await session.page.title();
          return { success: true };
        }

        case 'reload': {
          await session.page.reload();
          await session.page.waitForLoadState('domcontentloaded');
          return { success: true };
        }

        case 'wait': {
          const timeout = params?.timeout || 1000;
          await session.page.waitForTimeout(timeout);
          return { success: true };
        }

        default:
          return { success: false, error: `Unsupported action: ${action}` };
      }
    } catch (error) {
      console.error(`Action ${action} error:`, error);
      return { 
        success: false, 
        error: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async takeScreenshot(sessionId: string, fullPage = false): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) {
      throw new Error('Session not found or invalid');
    }

    session.lastActivity = new Date();
    return await session.page.screenshot({ type: 'png', fullPage });
  }

  async evaluateScript(sessionId: string, script: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.page) {
      throw new Error('Session not found or invalid');
    }

    session.lastActivity = new Date();
    return await session.page.evaluate(script);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.context) {
          await session.context.close();
        }
      } catch (error) {
        console.error('Error closing session:', error);
      }
      this.sessions.delete(sessionId);
    }
  }

  getSession(sessionId: string): BrowserSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        id: session.id,
        url: session.url,
        title: session.title,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      };
    }
    return undefined;
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      url: session.url,
      title: session.title,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }));
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        sessionsToRemove.push(id);
      }
    }

    for (const id of sessionsToRemove) {
      await this.closeSession(id);
      console.log(`Cleaned up inactive session: ${id}`);
    }
  }

  async shutdown(): Promise<void> {
    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Singleton instance
let serverInstance: BrowserAutomationServer | null = null;

export function getBrowserAutomationServer(): BrowserAutomationServer {
  if (!serverInstance) {
    serverInstance = new BrowserAutomationServer();
  }
  return serverInstance;
}