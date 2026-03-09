import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cancelPermissionTimer, cancelWaitingTimer } from './timerManager.js';
import { processTranscriptLine } from './parser.js';
import type { AgentState } from './types.js';

type BroadcastFn = (msg: unknown) => void;

let nextAgentId = 1;

// Map from JSONL file path → AgentState
const agents = new Map<number, AgentState>();
const agentsByFile = new Map<string, number>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function getAgents(): Map<number, AgentState> {
  return agents;
}

export function deriveLabel(jsonlPath: string): string {
  // Path like: ~/.claude/projects/-Users-kareemo-Projects-myapp/session.jsonl
  // dirName looks like: -Users-kareemo-Projects-myapp
  const dir = path.dirname(jsonlPath);
  const dirName = path.basename(dir);

  // Try to extract project name after common path markers
  const markers = ['Projects', 'projects', 'repos', 'src', 'code', 'dev', 'workspace'];
  for (const marker of markers) {
    const idx = dirName.indexOf(marker);
    if (idx !== -1) {
      // Everything after the marker is the project name (may include hyphens)
      const after = dirName.slice(idx + marker.length + 1); // +1 for the dash
      if (after) return after;
    }
  }

  // Fallback: take last segment after splitting on common path separators
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
  // Check if we already track this file
  const existingId = agentsByFile.get(jsonlFile);
  if (existingId !== undefined && agents.has(existingId)) {
    return existingId;
  }

  const id = nextAgentId++;
  const openclawLabel = getOpenClawLabel(jsonlFile);
  const label = openclawLabel || deriveLabel(jsonlFile);
  const agent: AgentState = {
    id,
    label,
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
  };

  agents.set(id, agent);
  agentsByFile.set(jsonlFile, id);

  // Skip to end of file (only process new lines)
  try {
    const stat = fs.statSync(jsonlFile);
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

    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, broadcast);
    }
  } catch (e) {
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

export function getSnapshot(): Array<{ id: number; label: string; isWaiting: boolean; tools: Array<{ toolId: string; status: string }> }> {
  const result = [];
  for (const agent of agents.values()) {
    const tools = [];
    for (const [toolId, status] of agent.activeToolStatuses) {
      tools.push({ toolId, status });
    }
    result.push({
      id: agent.id,
      label: agent.label,
      isWaiting: agent.isWaiting,
      tools,
    });
  }
  return result;
}
