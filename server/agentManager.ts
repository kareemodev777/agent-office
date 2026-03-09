import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cancelPermissionTimer, cancelWaitingTimer } from './timerManager.js';
import { processTranscriptLine } from './parser.js';
import type { AgentState } from './types.js';
import { WebSocket } from 'ws';
import { STUCK_TIMEOUT_MS } from './constants.js';

type BroadcastFn = (msg: unknown) => void;

let nextAgentId = 1;

const agents = new Map<number, AgentState>();
const agentsByFile = new Map<string, number>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

// Live inspect subscriptions: agentId → set of WebSocket clients
const inspectSubscriptions = new Map<number, Set<WebSocket>>();

// Track all sessions seen today for stats
const sessionsSeenToday = new Set<number>();
let sessionDayStart = getStartOfDay();

function getStartOfDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getAgents(): Map<number, AgentState> {
  return agents;
}

export function getAgentById(id: number): AgentState | undefined {
  return agents.get(id);
}

export function deriveLabel(jsonlPath: string): string {
  const dir = path.dirname(jsonlPath);
  const dirName = path.basename(dir);

  const markers = ['Projects', 'projects', 'repos', 'src', 'code', 'dev', 'workspace'];
  for (const marker of markers) {
    const idx = dirName.indexOf(marker);
    if (idx !== -1) {
      const after = dirName.slice(idx + marker.length + 1);
      if (after) return after;
    }
  }

  const parts = dirName.split('-').filter(Boolean);
  return parts[parts.length - 1] || dirName;
}

function getOpenClawLabel(jsonlFile: string): string | null {
  const sessionId = path.basename(jsonlFile, '.jsonl');
  const openclawDir = path.join(os.homedir(), '.openclaw', 'agents');
  try {
    const files = fs.readdirSync(openclawDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const config = JSON.parse(fs.readFileSync(path.join(openclawDir, file), 'utf-8'));
        if (config.sessionId === sessionId || config.session_id === sessionId) {
          return config.role || config.name || config.label || null;
        }
      } catch { continue; }
    }
  } catch { /* dir doesn't exist */ }
  return null;
}

export function addAgent(jsonlFile: string, broadcast: BroadcastFn): number {
  const existingId = agentsByFile.get(jsonlFile);
  if (existingId !== undefined && agents.has(existingId)) {
    return existingId;
  }

  const id = nextAgentId++;
  const openclawLabel = getOpenClawLabel(jsonlFile);
  const label = openclawLabel || deriveLabel(jsonlFile);
  const now = Date.now();
  const agent: AgentState = {
    id,
    label,
    slug: null,
    role: null,
    gitBranch: null,
    jsonlFile,
    fileOffset: 0,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    startedAt: now,
    lastActivityAt: now,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };

  agents.set(id, agent);
  agentsByFile.set(jsonlFile, id);

  // Track sessions seen today
  const today = getStartOfDay();
  if (today !== sessionDayStart) {
    sessionsSeenToday.clear();
    sessionDayStart = today;
  }
  sessionsSeenToday.add(id);

  // Read last ~50KB of file to discover active sub-agents and metadata
  try {
    const stat = fs.statSync(jsonlFile);
    const TAIL_BYTES = 50 * 1024;
    const readFrom = Math.max(0, stat.size - TAIL_BYTES);
    const buf = Buffer.alloc(stat.size - readFrom);
    const fd = fs.openSync(jsonlFile, 'r');
    fs.readSync(fd, buf, 0, buf.length, readFrom);
    fs.closeSync(fd);

    const text = buf.toString('utf-8');
    const lines = text.split('\n');
    // If we started mid-file, first line may be partial — skip it
    if (readFrom > 0) lines.shift();

    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(id, line, agents, waitingTimers, permissionTimers, broadcast);
    }

    // Set offset to end so we only get new lines going forward
    agent.fileOffset = stat.size;
  } catch {
    // File may not exist yet
  }

  console.log(`[Agent Office] Agent ${id} created: "${label}" (${path.basename(jsonlFile)})`);
  broadcast({ type: 'agentCreated', id, label });
  return id;
}

export function removeAgent(agentId: number, broadcast: BroadcastFn): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);

  agentsByFile.delete(agent.jsonlFile);
  agents.delete(agentId);
  inspectSubscriptions.delete(agentId);

  console.log(`[Agent Office] Agent ${agentId} removed`);
  broadcast({ type: 'agentClosed', id: agentId });
}

export function readNewLines(agentId: number, broadcast: BroadcastFn): void {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return;

    const buf = Buffer.alloc(stat.size - agent.fileOffset);
    const fd = fs.openSync(agent.jsonlFile, 'r');
    fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
    fs.closeSync(fd);
    agent.fileOffset = stat.size;

    const text = agent.lineBuffer + buf.toString('utf-8');
    const lines = text.split('\n');
    agent.lineBuffer = lines.pop() || '';

    const hasLines = lines.some((l) => l.trim());
    if (hasLines) {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      if (agent.permissionSent) {
        agent.permissionSent = false;
        broadcast({ type: 'agentToolPermissionClear', id: agentId });
      }
    }

    const subscribers = inspectSubscriptions.get(agentId);

    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, broadcast);

      // Push to inspect subscribers
      if (subscribers && subscribers.size > 0) {
        const data = JSON.stringify({ type: 'inspectLine', id: agentId, line });
        for (const ws of subscribers) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          } else {
            subscribers.delete(ws);
          }
        }
      }
    }
  } catch {
    // File might have been deleted
  }
}

export function getAgentIdByFile(jsonlFile: string): number | undefined {
  return agentsByFile.get(jsonlFile);
}

export function getRecentLines(agentId: number, count: number): string[] {
  const agent = agents.get(agentId);
  if (!agent) return [];
  try {
    const content = fs.readFileSync(agent.jsonlFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-count);
  } catch { return []; }
}

export function getFullTranscript(agentId: number): string {
  const agent = agents.get(agentId);
  if (!agent) return '';
  try {
    return fs.readFileSync(agent.jsonlFile, 'utf-8');
  } catch { return ''; }
}

// Inspect subscriptions
export function subscribeInspect(agentId: number, ws: WebSocket): void {
  let subs = inspectSubscriptions.get(agentId);
  if (!subs) {
    subs = new Set();
    inspectSubscriptions.set(agentId, subs);
  }
  subs.add(ws);
}

export function unsubscribeInspect(agentId: number, ws: WebSocket): void {
  const subs = inspectSubscriptions.get(agentId);
  if (subs) {
    subs.delete(ws);
    if (subs.size === 0) inspectSubscriptions.delete(agentId);
  }
}

export function unsubscribeAllInspect(ws: WebSocket): void {
  for (const [, subs] of inspectSubscriptions) {
    subs.delete(ws);
  }
}

// Stats
export function getStats(): { activeAgents: number; toolsRunning: number; sessionsToday: number } {
  const today = getStartOfDay();
  if (today !== sessionDayStart) {
    sessionsSeenToday.clear();
    sessionDayStart = today;
  }
  for (const agent of agents.values()) {
    sessionsSeenToday.add(agent.id);
  }

  let toolsRunning = 0;
  for (const agent of agents.values()) {
    toolsRunning += agent.activeToolIds.size;
    for (const subTools of agent.activeSubagentToolIds.values()) {
      toolsRunning += subTools.size;
    }
  }

  return {
    activeAgents: agents.size,
    toolsRunning,
    sessionsToday: sessionsSeenToday.size,
  };
}

// Stuck detection
export function checkStuckAgents(broadcast: BroadcastFn): void {
  const now = Date.now();
  for (const agent of agents.values()) {
    if (agent.activeToolIds.size > 0 && now - agent.lastActivityAt > STUCK_TIMEOUT_MS) {
      broadcast({ type: 'agentStuck', id: agent.id });
    }
  }
}

export function getSnapshot(): Array<{
  id: number;
  label: string;
  slug: string | null;
  role: string | null;
  gitBranch: string | null;
  isWaiting: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  startedAt: number;
  tools: Array<{ toolId: string; status: string }>;
  subagents: Array<{ parentToolId: string; tools: Array<{ toolId: string; status: string }> }>;
}> {
  const result = [];
  for (const agent of agents.values()) {
    const tools = [];
    for (const [toolId, status] of agent.activeToolStatuses) {
      tools.push({ toolId, status });
    }
    const subagents = [];
    for (const [parentToolId, subToolIds] of agent.activeSubagentToolIds) {
      const subTools: Array<{ toolId: string; status: string }> = [];
      for (const subToolId of subToolIds) {
        const subNames = agent.activeSubagentToolNames.get(parentToolId);
        const toolName = subNames?.get(subToolId) || '';
        subTools.push({ toolId: subToolId, status: `Using ${toolName}` });
      }
      subagents.push({ parentToolId, tools: subTools });
    }
    result.push({
      id: agent.id,
      label: agent.label,
      slug: agent.slug,
      role: agent.role,
      gitBranch: agent.gitBranch,
      isWaiting: agent.isWaiting,
      inputTokens: agent.inputTokens,
      outputTokens: agent.outputTokens,
      cacheCreationTokens: agent.cacheCreationTokens,
      cacheReadTokens: agent.cacheReadTokens,
      startedAt: agent.startedAt,
      tools,
      subagents,
    });
  }
  return result;
}
