import express from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { SERVER_PORT } from './constants.js';
import { getSnapshot, getRecentLines } from './agentManager.js';
import { startWatching } from './watcher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

// Serve static client files in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('[Agent Office] WebSocket client connected');
  clients.add(ws);

  // Send current state snapshot
  const snapshot = getSnapshot();
  ws.send(JSON.stringify({ type: 'snapshot', agents: snapshot }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[Agent Office] WebSocket client disconnected');
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[Agent Office] Client message:', msg.type);
      if (msg.type === 'inspectAgent') {
        const agentId = msg.id as number;
        const lines = getRecentLines(agentId, 20);
        ws.send(JSON.stringify({ type: 'inspectData', id: agentId, lines }));
      }
    } catch {
      // ignore
    }
  });
});

// Start watching JSONL files
startWatching(broadcast);

server.listen(SERVER_PORT, () => {
  console.log(`[Agent Office] Server running on http://localhost:${SERVER_PORT}`);
  console.log(`[Agent Office] WebSocket available at ws://localhost:${SERVER_PORT}/ws`);
});
