import express from 'express';
import { createServer } from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { execSync, spawn as cpSpawn } from 'child_process';
import { SERVER_PORT, STUCK_CHECK_INTERVAL_MS, STATS_BROADCAST_INTERVAL_MS } from './constants.js';
import {
  getSnapshot,
  getRecentLines,
  getFullTranscript,
  getAgentById,
  getAgents,
  getStats,
  checkStuckAgents,
  subscribeInspect,
  unsubscribeInspect,
  unsubscribeAllInspect,
} from './agentManager.js';
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

  // Send initial stats
  const stats = getStats();
  ws.send(JSON.stringify({ type: 'stats', ...stats }));

  ws.on('close', () => {
    clients.delete(ws);
    unsubscribeAllInspect(ws);
    console.log('[Agent Office] WebSocket client disconnected');
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[Agent Office] Client message:', msg.type);

      if (msg.type === 'inspectAgent') {
        const agentId = msg.id as number;
        const lines = getRecentLines(agentId, 50);
        ws.send(JSON.stringify({ type: 'inspectData', id: agentId, lines }));
      } else if (msg.type === 'subscribeAgent') {
        const agentId = msg.id as number;
        subscribeInspect(agentId, ws);
        // Send initial batch with metadata
        const lines = getRecentLines(agentId, 50);
        const agent = getAgentById(agentId);
        ws.send(JSON.stringify({
          type: 'inspectData',
          id: agentId,
          lines,
          slug: agent?.slug,
          role: agent?.role,
          gitBranch: agent?.gitBranch,
          inputTokens: agent?.inputTokens ?? 0,
          outputTokens: agent?.outputTokens ?? 0,
          cacheCreationTokens: agent?.cacheCreationTokens ?? 0,
          cacheReadTokens: agent?.cacheReadTokens ?? 0,
          startedAt: agent?.startedAt ?? 0,
        }));
      } else if (msg.type === 'unsubscribeAgent') {
        const agentId = msg.id as number;
        unsubscribeInspect(agentId, ws);
      } else if (msg.type === 'getTranscript') {
        const agentId = msg.id as number;
        const content = getFullTranscript(agentId);
        ws.send(JSON.stringify({ type: 'transcript', id: agentId, content }));
      } else if (msg.type === 'killAgent') {
        const agentId = msg.id as number;
        const agent = getAgentById(agentId);
        if (agent) {
          try {
            const output = execSync(`lsof -t "${agent.jsonlFile}" 2>/dev/null`).toString().trim();
            const pids = output.split('\n').filter(Boolean);
            for (const pidStr of pids) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid)) {
                process.kill(pid, 'SIGTERM');
                console.log(`[Agent Office] Killed PID ${pid} for agent ${agentId}`);
              }
            }
          } catch {
            console.log(`[Agent Office] Could not find process for agent ${agentId}`);
          }
        }
      } else if (msg.type === 'getProjects') {
        try {
          const projectsDir = path.join(os.homedir(), 'Projects');
          const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
          const folders = entries
            .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
            .map((e) => ({ name: e.name, path: path.join(projectsDir, e.name) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          ws.send(JSON.stringify({ type: 'projects', folders }));
        } catch {
          ws.send(JSON.stringify({ type: 'projects', folders: [] }));
        }
      } else if (msg.type === 'spawnAgent') {
        const cwd = msg.cwd as string;
        const prompt = msg.prompt as string;
        if (cwd && prompt) {
          const child = cpSpawn('claude', ['--print', prompt], {
            cwd,
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          console.log(`[Agent Office] Spawned agent in ${cwd}: ${prompt.slice(0, 50)}`);
        }
      }
    } catch {
      // ignore
    }
  });
});

// Start watching JSONL files
startWatching(broadcast);

// Periodic stats + token updates broadcast
setInterval(() => {
  const stats = getStats();
  broadcast({ type: 'stats', ...stats });
  // Broadcast token updates for all active agents
  for (const agent of getAgents().values()) {
    broadcast({
      type: 'agentTokenUpdate',
      id: agent.id,
      inputTokens: agent.inputTokens,
      outputTokens: agent.outputTokens,
      cacheCreationTokens: agent.cacheCreationTokens,
      cacheReadTokens: agent.cacheReadTokens,
    });
  }
}, STATS_BROADCAST_INTERVAL_MS);

// Periodic stuck detection
setInterval(() => {
  checkStuckAgents(broadcast);
}, STUCK_CHECK_INTERVAL_MS);

server.listen(SERVER_PORT, () => {
  console.log(`[Agent Office] Server running on http://localhost:${SERVER_PORT}`);
  console.log(`[Agent Office] WebSocket available at ws://localhost:${SERVER_PORT}/ws`);
});
