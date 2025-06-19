import express from 'express';
import { chromium } from 'playwright';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const WEBSOCKET_SERVICE_URL = process.env.WEBSOCKET_SERVICE_URL || 'http://localhost:3002';

// Browser session storage
const sessions = new Map();

// Action schema
const ActionSchema = z.object({
  type: z.enum(['navigate', 'click', 'type', 'scrape', 'screenshot', 'wait']),
  params: z.record(z.any()),
});

// rrweb script to inject into pages
const rrwebScript = `
  window.stopRecording = window.rrweb.record({
    emit(event) {
      // Send event to our service via postMessage
      if (window.sendRRWebEvent) {
        window.sendRRWebEvent(event);
      }
    },
    maskAllInputs: true,
    maskAllText: false,
    blockClass: 'rr-block',
    ignoreClass: 'rr-ignore',
    checkoutEveryNms: 10000,
  });
`;

class PlaywrightService {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(sessionId) {
    try {
      console.log(`[Playwright] Creating session: ${sessionId}`);
      
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();

      // Set up rrweb event handling
      await page.exposeFunction('sendRRWebEvent', async (event) => {
        try {
          await this.broadcastRRWebEvent(sessionId, event);
        } catch (error) {
          console.error('[Playwright] Failed to broadcast rrweb event:', error.message);
        }
      });

      const session = {
        id: sessionId,
        browser,
        context,
        page,
        currentUrl: 'about:blank',
        createdAt: new Date(),
      };

      this.sessions.set(sessionId, session);
      console.log(`[Playwright] Session created: ${sessionId}`);
      
      return session;
    } catch (error) {
      console.error(`[Playwright] Failed to create session: ${error.message}`);
      throw error;
    }
  }

  async executeAction(sessionId, action) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { page } = session;
    console.log(`[Playwright] Executing ${action.type} for session ${sessionId}`);

    try {
      let result = { success: true };

      switch (action.type) {
        case 'navigate':
          await page.goto(action.params.url, { waitUntil: 'networkidle' });
          session.currentUrl = action.params.url;
          
          // Inject rrweb recording script
          await page.addScriptTag({ content: await this.getRRWebScript() });
          await page.evaluate(rrwebScript);
          
          result.url = action.params.url;
          result.title = await page.title();
          break;

        case 'click':
          await page.waitForSelector(action.params.selector, { timeout: 10000 });
          await page.click(action.params.selector);
          result.selector = action.params.selector;
          break;

        case 'type':
          await page.waitForSelector(action.params.selector, { timeout: 10000 });
          await page.fill(action.params.selector, action.params.text);
          result.selector = action.params.selector;
          result.text = action.params.text;
          break;

        case 'scrape':
          await page.waitForSelector(action.params.selector, { timeout: 10000 });
          const content = await page.textContent(action.params.selector);
          result.content = content;
          result.selector = action.params.selector;
          break;

        case 'screenshot':
          const screenshot = await page.screenshot({ 
            fullPage: action.params.fullPage || false,
            type: 'png'
          });
          result.screenshot = screenshot.toString('base64');
          break;

        case 'wait':
          if (action.params.ms) {
            await page.waitForTimeout(action.params.ms);
          } else if (action.params.selector) {
            await page.waitForSelector(action.params.selector, { 
              timeout: action.params.timeout || 30000 
            });
          }
          result.waited = action.params.ms || action.params.selector;
          break;

        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      console.log(`[Playwright] Action ${action.type} completed successfully`);
      return result;

    } catch (error) {
      console.error(`[Playwright] Action ${action.type} failed:`, error.message);
      throw new Error(`Action ${action.type} failed: ${error.message}`);
    }
  }

  async takeScreenshot(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const screenshot = await session.page.screenshot({ type: 'png' });
      return screenshot.toString('base64');
    } catch (error) {
      console.error(`[Playwright] Screenshot failed for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  async getPageInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const { page } = session;
      return {
        url: page.url(),
        title: await page.title(),
        sessionId: sessionId,
      };
    } catch (error) {
      console.error(`[Playwright] Failed to get page info for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      await session.browser.close();
      this.sessions.delete(sessionId);
      console.log(`[Playwright] Session closed: ${sessionId}`);
    } catch (error) {
      console.error(`[Playwright] Failed to close session ${sessionId}:`, error.message);
      throw error;
    }
  }

  async getRRWebScript() {
    // In production, this would load the actual rrweb script
    // For now, return a simplified version
    return `
      if (!window.rrweb) {
        window.rrweb = {
          record: function(options) {
            console.log('[rrweb] Recording started');
            // Simplified rrweb implementation
            const observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                if (options.emit) {
                  options.emit({
                    type: 'mutation',
                    timestamp: Date.now(),
                    data: {
                      source: 2,
                      type: mutation.type,
                      target: mutation.target.tagName
                    }
                  });
                }
              });
            });
            
            observer.observe(document, {
              childList: true,
              subtree: true,
              attributes: true
            });
            
            return function stopRecording() {
              observer.disconnect();
            };
          }
        };
      }
    `;
  }

  async broadcastRRWebEvent(sessionId, event) {
    try {
      await axios.post(`${WEBSOCKET_SERVICE_URL}/broadcast`, {
        sessionId,
        type: 'rrweb:event',
        payload: { event }
      });
    } catch (error) {
      console.error('[Playwright] Failed to broadcast rrweb event:', error.message);
    }
  }
}

// Initialize service
const playwrightService = new PlaywrightService();

// API Routes
app.post('/session/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const id = sessionId || `playwright_${uuidv4()}`;
    
    const session = await playwrightService.createSession(id);
    res.json({ sessionId: session.id, created: true });
  } catch (error) {
    console.error('[API] Create session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:sessionId/action', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const action = ActionSchema.parse(req.body);
    
    const result = await playwrightService.executeAction(sessionId, action);
    res.json({ success: true, result });
  } catch (error) {
    console.error('[API] Execute action error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/session/:sessionId/screenshot', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const screenshot = await playwrightService.takeScreenshot(sessionId);
    res.json({ screenshot });
  } catch (error) {
    console.error('[API] Screenshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/session/:sessionId/info', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const info = await playwrightService.getPageInfo(sessionId);
    res.json(info);
  } catch (error) {
    console.error('[API] Get page info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await playwrightService.closeSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Close session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'playwright-service',
    sessions: playwrightService.sessions.size,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Playwright Service] Running on port ${PORT}`);
  console.log(`[Playwright Service] WebSocket Service: ${WEBSOCKET_SERVICE_URL}`);
});