import express from 'express';
import { createServer } from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { execSync, spawn as cpSpawn } from 'child_process';
import { SERVER_PORT, STUCK_CHECK_INTERVAL_MS, STATS_BROADCAST_INTERVAL_MS } from './constants.js';
import { getSystemStats } from './systemStats.js';
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
import {
  loadPersistence,
  startPeriodicSave,
  stopPeriodicSave,
  addSession,
  getData,
  updateSettings,
  clearHistory,
} from './persistence.js';
import { sendWebhook, setWebhookUrl, getConfiguredWebhookUrl } from './webhooks.js';
import type { SessionRecord } from './persistence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

// Serve static client files in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Load persistence data
loadPersistence();
startPeriodicSave();

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

// Wrap broadcast to also trigger webhooks and persistence for key events
function broadcastWithHooks(msg: unknown): void {
  broadcast(msg);

  const m = msg as Record<string, unknown>;
  if (m.type === 'agentClosed') {
    const agentId = m.id as number;
    const agent = getAgentById(agentId);
    if (agent) {
      const session: SessionRecord = {
        id: agent.id,
        label: agent.label,
        slug: agent.slug,
        role: agent.role,
        startedAt: agent.startedAt,
        endedAt: Date.now(),
        inputTokens: agent.inputTokens,
        outputTokens: agent.outputTokens,
        cacheCreationTokens: agent.cacheCreationTokens,
        cacheReadTokens: agent.cacheReadTokens,
        cwd: null,
        gitBranch: agent.gitBranch,
      };
      addSession(session);
      sendWebhook({
        event: 'agent_finished',
        agent: {
          name: agent.label,
          slug: agent.slug,
          duration: Date.now() - agent.startedAt,
          tokens: agent.inputTokens + agent.outputTokens,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } else if (m.type === 'agentStuck') {
    const agent = getAgentById(m.id as number);
    if (agent) {
      sendWebhook({
        event: 'agent_stuck',
        agent: { name: agent.label, slug: agent.slug, duration: Date.now() - agent.startedAt, tokens: agent.inputTokens + agent.outputTokens },
        timestamp: new Date().toISOString(),
      });
    }
  } else if (m.type === 'agentToolPermission') {
    const agent = getAgentById(m.id as number);
    if (agent) {
      sendWebhook({
        event: 'agent_permission_wait',
        agent: { name: agent.label, slug: agent.slug, duration: Date.now() - agent.startedAt, tokens: agent.inputTokens + agent.outputTokens },
        timestamp: new Date().toISOString(),
      });
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
        unsubscribeInspect(msg.id as number, ws);
      } else if (msg.type === 'getTranscript') {
        const content = getFullTranscript(msg.id as number);
        ws.send(JSON.stringify({ type: 'transcript', id: msg.id, content }));
      } else if (msg.type === 'killAgent') {
        const agent = getAgentById(msg.id as number);
        if (agent) {
          try {
            const output = execSync(`lsof -t "${agent.jsonlFile}" 2>/dev/null`).toString().trim();
            for (const pidStr of output.split('\n').filter(Boolean)) {
              const pid = parseInt(pidStr, 10);
              if (!isNaN(pid)) {
                process.kill(pid, 'SIGTERM');
                console.log(`[Agent Office] Killed PID ${pid} for agent ${agent.id}`);
              }
            }
          } catch {
            console.log(`[Agent Office] Could not find process for agent ${msg.id}`);
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
          const child = cpSpawn('claude', ['--print', prompt], { cwd, detached: true, stdio: 'ignore' });
          child.unref();
          console.log(`[Agent Office] Spawned agent in ${cwd}: ${prompt.slice(0, 50)}`);
        }
      } else if (msg.type === 'getHistory') {
        const d = getData();
        ws.send(JSON.stringify({ type: 'history', sessions: d.sessions, dailyCosts: d.dailyCosts, totalSessions: d.totalSessions }));
      } else if (msg.type === 'clearHistory') {
        clearHistory();
        ws.send(JSON.stringify({ type: 'historyCleared' }));
      } else if (msg.type === 'updateSettings') {
        const settings = msg.settings as Record<string, unknown>;
        if (settings) {
          updateSettings(settings);
          if (typeof settings.webhookUrl === 'string') setWebhookUrl(settings.webhookUrl);
        }
      } else if (msg.type === 'getSettings') {
        const d = getData();
        ws.send(JSON.stringify({ type: 'settings', settings: d.settings, webhookUrl: getConfiguredWebhookUrl() }));
      } else if (msg.type === 'searchTranscripts') {
        const query = (msg.query as string || '').trim();
        if (query.length < 2) {
          ws.send(JSON.stringify({ type: 'searchResults', results: [], truncated: false }));
          return;
        }
        const results: Array<{ agentId: number; agentName: string; line: string; lineNumber: number; context: string }> = [];
        const queryLower = query.toLowerCase();
        const limit = 50;
        for (const agent of getAgents().values()) {
          try {
            const content = fs.readFileSync(agent.jsonlFile, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && results.length < limit; i++) {
              if (!lines[i].trim() || !lines[i].toLowerCase().includes(queryLower)) continue;
              let preview = '';
              try {
                const record = JSON.parse(lines[i]);
                const c = record.message?.content;
                if (typeof c === 'string') preview = c.slice(0, 120);
                else if (Array.isArray(c)) {
                  for (const b of c) {
                    if (b.type === 'text' && b.text) { preview = b.text.slice(0, 120); break; }
                  }
                }
              } catch { preview = lines[i].slice(0, 120); }
              results.push({
                agentId: agent.id,
                agentName: agent.slug || agent.label,
                line: preview || lines[i].slice(0, 120),
                lineNumber: i + 1,
                context: `Line ${i + 1}`,
              });
            }
          } catch { /* file deleted */ }
        }
        ws.send(JSON.stringify({ type: 'searchResults', results, truncated: results.length >= limit }));
      }
    } catch {
      // ignore
    }
  });
});

// Start watching JSONL files
startWatching(broadcastWithHooks);

// Periodic stats + token updates broadcast
setInterval(() => {
  const stats = getStats();
  broadcast({ type: 'stats', ...stats });
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
  // Broadcast system resource utilisation
  const sysStats = getSystemStats();
  broadcast({ type: 'systemStats', ...sysStats });
}, STATS_BROADCAST_INTERVAL_MS);

// Periodic stuck detection
setInterval(() => {
  checkStuckAgents(broadcastWithHooks);
}, STUCK_CHECK_INTERVAL_MS);

// Graceful shutdown
function gracefulShutdown(): void {
  console.log('[Agent Office] Shutting down...');
  stopPeriodicSave();
  process.exit(0);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(SERVER_PORT, () => {
  console.log(`[Agent Office] Server running on http://localhost:${SERVER_PORT}`);
  console.log(`[Agent Office] WebSocket available at ws://localhost:${SERVER_PORT}/ws`);
});
