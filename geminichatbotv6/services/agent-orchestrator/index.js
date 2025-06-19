import express from 'express';
import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const PLAYWRIGHT_SERVICE_URL = process.env.PLAYWRIGHT_SERVICE_URL || 'http://localhost:3001';
const WEBSOCKET_SERVICE_URL = process.env.WEBSOCKET_SERVICE_URL || 'http://localhost:3002';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Redis client
const redis = createClient({ url: REDIS_URL });
redis.connect().catch(console.error);

// Session storage
const sessions = new Map();

// Agent action schema
const AgentActionSchema = z.object({
  type: z.enum(['navigate', 'click', 'type', 'scrape', 'screenshot', 'wait']),
  description: z.string(),
  params: z.record(z.any()),
});

// Session schema
const SessionSchema = z.object({
  id: z.string(),
  query: z.string(),
  status: z.enum(['planning', 'executing', 'paused', 'completed', 'failed']),
  plan: z.array(AgentActionSchema),
  currentActionIndex: z.number().default(0),
  playwrightSessionId: z.string().optional(),
  error: z.string().optional(),
});

// Plan-Execute-Verify Loop Implementation
class AgentOrchestrator {
  constructor() {
    this.sessions = new Map();
  }

  async createSession(query, sessionId = null) {
    const id = sessionId || `agent_${Date.now()}_${uuidv4().substr(0, 8)}`;
    
    const session = {
      id,
      query,
      status: 'planning',
      plan: [],
      currentActionIndex: 0,
      createdAt: new Date(),
    };

    this.sessions.set(id, session);
    await redis.set(`session:${id}`, JSON.stringify(session));

    console.log(`[Orchestrator] Created session: ${id}`);
    return session;
  }

  async planSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    try {
      console.log(`[Orchestrator] Planning session: ${sessionId}`);
      
      // Send status update
      await this.broadcastStatusUpdate(sessionId, 'planning', 'Analyzing request and creating plan');

      // Use Claude to create a plan
      const planningPrompt = `You are an autonomous web automation agent. Your task is to break down the user's request into specific, executable browser actions.

User Request: "${session.query}"

Create a step-by-step plan using these action types:
- navigate: Go to a URL
- click: Click on an element (provide selector)
- type: Type text into an input field (provide selector and text)
- scrape: Extract content from the page (provide selector)
- screenshot: Take a screenshot
- wait: Wait for a condition or time

Return ONLY a JSON array of actions in this format:
[
  {
    "type": "navigate",
    "description": "Go to Google homepage",
    "params": { "url": "https://google.com" }
  },
  {
    "type": "type",
    "description": "Enter search query",
    "params": { "selector": "input[name='q']", "text": "search term" }
  }
]

Be specific with selectors and realistic about what can be automated. Focus on common, reliable selectors.`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: planningPrompt }],
      });

      let plan;
      try {
        // Extract JSON from the response
        const content = response.content[0].text;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        plan = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[Orchestrator] Failed to parse plan:', parseError);
        throw new Error('Failed to generate valid plan');
      }

      // Validate the plan
      const validatedPlan = plan.map(action => AgentActionSchema.parse(action));

      // Update session with plan
      session.plan = validatedPlan;
      session.status = 'executing';
      this.sessions.set(sessionId, session);
      await redis.set(`session:${sessionId}`, JSON.stringify(session));

      console.log(`[Orchestrator] Plan created for ${sessionId}:`, validatedPlan.length, 'actions');
      
      // Broadcast plan to WebSocket clients
      await this.broadcastStatusUpdate(sessionId, 'executing', 'Plan created, starting execution', {
        plan: validatedPlan,
        totalActions: validatedPlan.length
      });

      return validatedPlan;

    } catch (error) {
      console.error(`[Orchestrator] Planning failed for ${sessionId}:`, error);
      session.status = 'failed';
      session.error = error.message;
      this.sessions.set(sessionId, session);
      
      await this.broadcastStatusUpdate(sessionId, 'failed', `Planning failed: ${error.message}`);
      throw error;
    }
  }

  async executeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    try {
      console.log(`[Orchestrator] Executing session: ${sessionId}`);

      // Create Playwright session
      const playwrightResponse = await axios.post(`${PLAYWRIGHT_SERVICE_URL}/session/create`, {
        sessionId: sessionId
      });
      
      session.playwrightSessionId = playwrightResponse.data.sessionId;
      
      // Execute each action in the plan
      for (let i = 0; i < session.plan.length; i++) {
        if (session.status === 'paused') {
          console.log(`[Orchestrator] Session ${sessionId} paused at action ${i}`);
          await this.broadcastStatusUpdate(sessionId, 'paused', `Paused at step ${i + 1}/${session.plan.length}`);
          return; // Exit execution loop, wait for resume
        }

        if (session.status === 'failed') {
          console.log(`[Orchestrator] Session ${sessionId} failed, stopping execution`);
          return;
        }

        const action = session.plan[i];
        session.currentActionIndex = i;
        
        console.log(`[Orchestrator] Executing action ${i + 1}/${session.plan.length}:`, action.type);
        
        await this.broadcastStatusUpdate(sessionId, 'executing', 
          `Executing step ${i + 1}/${session.plan.length}: ${action.description}`,
          { currentAction: i, totalActions: session.plan.length }
        );

        try {
          // Execute action via Playwright service
          const actionResponse = await axios.post(`${PLAYWRIGHT_SERVICE_URL}/session/${session.playwrightSessionId}/action`, {
            type: action.type,
            params: action.params
          });

          console.log(`[Orchestrator] Action ${action.type} completed successfully`);

          // Verify action success (simplified for now)
          await this.verifyAction(sessionId, action, actionResponse.data);

        } catch (actionError) {
          console.error(`[Orchestrator] Action ${action.type} failed:`, actionError.message);
          
          // Try to recover or mark as failed
          const shouldContinue = await this.handleActionFailure(sessionId, action, actionError);
          if (!shouldContinue) {
            throw new Error(`Action failed: ${actionError.message}`);
          }
        }

        // Update session progress
        this.sessions.set(sessionId, session);
        await redis.set(`session:${sessionId}`, JSON.stringify(session));
      }

      // Mark session as completed
      session.status = 'completed';
      session.completedAt = new Date();
      this.sessions.set(sessionId, session);
      await redis.set(`session:${sessionId}`, JSON.stringify(session));

      console.log(`[Orchestrator] Session ${sessionId} completed successfully`);
      await this.broadcastStatusUpdate(sessionId, 'completed', 'Task completed successfully');

    } catch (error) {
      console.error(`[Orchestrator] Execution failed for ${sessionId}:`, error);
      session.status = 'failed';
      session.error = error.message;
      this.sessions.set(sessionId, session);
      
      await this.broadcastStatusUpdate(sessionId, 'failed', `Execution failed: ${error.message}`);
      throw error;
    }
  }

  async verifyAction(sessionId, action, result) {
    // Simple verification - in production, this would use Claude to verify
    // that the action achieved its intended purpose
    console.log(`[Orchestrator] Verifying action: ${action.type}`);
    
    // For now, just check if the action returned a success status
    if (result && result.success === false) {
      throw new Error(result.error || 'Action verification failed');
    }
    
    return true;
  }

  async handleActionFailure(sessionId, action, error) {
    // Simple retry logic - in production, this would be more sophisticated
    console.log(`[Orchestrator] Handling failure for action: ${action.type}`);
    
    // For now, don't retry and fail the session
    return false;
  }

  async pauseSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'paused';
    this.sessions.set(sessionId, session);
    await redis.set(`session:${sessionId}`, JSON.stringify(session));

    console.log(`[Orchestrator] Session ${sessionId} paused`);
    await this.broadcastStatusUpdate(sessionId, 'paused', 'Session paused by user');
  }

  async resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'executing';
    this.sessions.set(sessionId, session);
    await redis.set(`session:${sessionId}`, JSON.stringify(session));

    console.log(`[Orchestrator] Session ${sessionId} resumed`);
    await this.broadcastStatusUpdate(sessionId, 'executing', 'Session resumed');

    // Continue execution from where we left off
    await this.executeSession(sessionId);
  }

  async cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'failed';
    session.error = 'Cancelled by user';
    this.sessions.set(sessionId, session);
    await redis.set(`session:${sessionId}`, JSON.stringify(session));

    // Clean up Playwright session
    if (session.playwrightSessionId) {
      try {
        await axios.delete(`${PLAYWRIGHT_SERVICE_URL}/session/${session.playwrightSessionId}`);
      } catch (error) {
        console.error('[Orchestrator] Failed to clean up Playwright session:', error.message);
      }
    }

    console.log(`[Orchestrator] Session ${sessionId} cancelled`);
    await this.broadcastStatusUpdate(sessionId, 'failed', 'Session cancelled by user');
  }

  async broadcastStatusUpdate(sessionId, status, message, data = {}) {
    try {
      await axios.post(`${WEBSOCKET_SERVICE_URL}/broadcast`, {
        sessionId,
        type: 'agent:status_update',
        payload: {
          status,
          message,
          timestamp: new Date().toISOString(),
          ...data
        }
      });
    } catch (error) {
      console.error('[Orchestrator] Failed to broadcast status update:', error.message);
    }
  }
}

// Initialize orchestrator
const orchestrator = new AgentOrchestrator();

// API Routes
app.post('/session/create', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const session = await orchestrator.createSession(query, sessionId);
    res.json(session);
  } catch (error) {
    console.error('[API] Create session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:sessionId/start', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Start planning and execution
    const plan = await orchestrator.planSession(sessionId);
    orchestrator.executeSession(sessionId).catch(console.error); // Don't await, run in background
    
    res.json({ sessionId, plan });
  } catch (error) {
    console.error('[API] Start session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await orchestrator.pauseSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Pause session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    orchestrator.resumeSession(sessionId).catch(console.error); // Don't await, run in background
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Resume session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/:sessionId/cancel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await orchestrator.cancelSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Cancel session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/session/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = orchestrator.sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('[API] Get session status error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'agent-orchestrator',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Agent Orchestrator] Service running on port ${PORT}`);
  console.log(`[Agent Orchestrator] Playwright Service: ${PLAYWRIGHT_SERVICE_URL}`);
  console.log(`[Agent Orchestrator] WebSocket Service: ${WEBSOCKET_SERVICE_URL}`);
  console.log(`[Agent Orchestrator] Redis: ${REDIS_URL}`);
});