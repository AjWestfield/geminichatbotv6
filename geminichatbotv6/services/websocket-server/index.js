import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createClient } from 'redis';
import { z } from 'zod';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize Redis client for pub/sub
const redis = createClient({ url: REDIS_URL });
const redisPub = createClient({ url: REDIS_URL });
await redis.connect();
await redisPub.connect();

// WebSocket message schema
const WSMessageSchema = z.object({
  sessionId: z.string(),
  type: z.enum([
    'session:start',
    'session:started', 
    'session:end',
    'agent:status_update',
    'rrweb:event',
    'hitl:pause_request',
    'hitl:resume_request',
    'hitl:credential_needed',
    'hitl:credential_submit',
    'agent:error'
  ]),
  payload: z.record(z.any()).optional(),
});

class WebSocketService {
  constructor() {
    this.clients = new Map(); // sessionId -> Set of WebSocket connections
    this.sessionClients = new Map(); // WebSocket -> sessionId
  }

  addClient(ws, sessionId) {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Set());
    }
    this.clients.get(sessionId).add(ws);
    this.sessionClients.set(ws, sessionId);
    
    console.log(`[WebSocket] Client connected to session: ${sessionId}`);
    console.log(`[WebSocket] Total sessions: ${this.clients.size}`);
  }

  removeClient(ws) {
    const sessionId = this.sessionClients.get(ws);
    if (sessionId) {
      const sessionClients = this.clients.get(sessionId);
      if (sessionClients) {
        sessionClients.delete(ws);
        if (sessionClients.size === 0) {
          this.clients.delete(sessionId);
        }
      }
      this.sessionClients.delete(ws);
      
      console.log(`[WebSocket] Client disconnected from session: ${sessionId}`);
      console.log(`[WebSocket] Total sessions: ${this.clients.size}`);
    }
  }

  broadcast(sessionId, message) {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients) {
      console.log(`[WebSocket] No clients for session: ${sessionId}`);
      return;
    }

    const messageStr = JSON.stringify(message);
    const deadClients = [];

    sessionClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('[WebSocket] Send error:', error.message);
          deadClients.push(ws);
        }
      } else {
        deadClients.push(ws);
      }
    });

    // Clean up dead connections
    deadClients.forEach(ws => {
      sessionClients.delete(ws);
      this.sessionClients.delete(ws);
    });

    console.log(`[WebSocket] Broadcasted to ${sessionClients.size} clients in session: ${sessionId}`);
  }

  handleMessage(ws, message) {
    try {
      const parsed = JSON.parse(message);
      const validated = WSMessageSchema.parse(parsed);
      
      console.log(`[WebSocket] Received message:`, validated.type, 'for session:', validated.sessionId);

      switch (validated.type) {
        case 'session:start':
          this.addClient(ws, validated.sessionId);
          ws.send(JSON.stringify({
            type: 'session:started',
            sessionId: validated.sessionId,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'hitl:pause_request':
        case 'hitl:resume_request':
        case 'hitl:credential_submit':
          // Forward to orchestrator via Redis pub/sub
          redisPub.publish('agent:commands', JSON.stringify(validated));
          break;

        default:
          console.log(`[WebSocket] Unhandled message type: ${validated.type}`);
      }

    } catch (error) {
      console.error('[WebSocket] Message handling error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format'
      }));
    }
  }
}

// Initialize WebSocket service
const wsService = new WebSocketService();

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/agent-stream'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  console.log(`[WebSocket] New connection for session: ${sessionId}`);

  // Add client to session
  wsService.addClient(ws, sessionId);

  // Handle messages
  ws.on('message', (message) => {
    wsService.handleMessage(ws, message.toString());
  });

  // Handle disconnection
  ws.on('close', () => {
    wsService.removeClient(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error:', error.message);
    wsService.removeClient(ws);
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection:established',
    sessionId: sessionId,
    timestamp: new Date().toISOString()
  }));
});

// API Routes for internal service communication
app.post('/broadcast', (req, res) => {
  try {
    const { sessionId, type, payload } = req.body;
    
    if (!sessionId || !type) {
      return res.status(400).json({ error: 'sessionId and type are required' });
    }

    const message = {
      type,
      sessionId,
      payload: payload || {},
      timestamp: new Date().toISOString()
    };

    wsService.broadcast(sessionId, message);
    res.json({ success: true, broadcasted: true });
  } catch (error) {
    console.error('[API] Broadcast error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/sessions', (req, res) => {
  const sessions = Array.from(wsService.clients.keys()).map(sessionId => ({
    sessionId,
    clientCount: wsService.clients.get(sessionId).size
  }));
  
  res.json({ sessions, totalSessions: sessions.length });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'websocket-server',
    activeSessions: wsService.clients.size,
    totalConnections: wsService.sessionClients.size,
    timestamp: new Date().toISOString()
  });
});

// Subscribe to Redis for agent commands
redis.subscribe('agent:commands', (message) => {
  try {
    const command = JSON.parse(message);
    console.log('[WebSocket] Received agent command from Redis:', command.type);
    
    // Forward to appropriate session clients
    wsService.broadcast(command.sessionId, command);
  } catch (error) {
    console.error('[WebSocket] Redis command handling error:', error.message);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`[WebSocket Server] Running on port ${PORT}`);
  console.log(`[WebSocket Server] WebSocket endpoint: ws://localhost:${PORT}/agent-stream`);
  console.log(`[WebSocket Server] Redis: ${REDIS_URL}`);
});