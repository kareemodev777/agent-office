import chokidar from 'chokidar';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { INACTIVE_REMOVAL_DELAY_MS } from './constants.js';
import { addAgent, getAgentIdByFile, readNewLines, removeAgent } from './agentManager.js';

type BroadcastFn = (msg: unknown) => void;

const pollTimers = new Map<number, ReturnType<typeof setInterval>>();
const removalTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function startWatching(broadcast: BroadcastFn): void {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

  console.log(`[Agent Office] Watching: ${claudeProjectsDir}`);

  // Ensure directory exists
  if (!fs.existsSync(claudeProjectsDir)) {
    fs.mkdirSync(claudeProjectsDir, { recursive: true });
  }

  // Only track recently-active sessions (modified within last 10 minutes)
  const RECENT_THRESHOLD_MS = 10 * 60 * 1000;

  const watcher = chokidar.watch(claudeProjectsDir, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    usePolling: false,
    depth: 2,
    // Skip subagent transcripts (handled via progress records in parent)
    ignored: /\/subagents\//,
  });

  watcher.on('add', (filePath: string) => {
    // Only track .jsonl files
    if (!filePath.endsWith('.jsonl')) return;

    // On initial scan, only pick up recently-modified files
    try {
      const stat = fs.statSync(filePath);
      const age = Date.now() - stat.mtimeMs;
      if (age > RECENT_THRESHOLD_MS) return;
    } catch { return; }

    console.log(`[Agent Office] JSONL file detected: ${path.basename(filePath)}`);
    const agentId = addAgent(filePath, broadcast);

    // Cancel any pending removal timer
    const removalTimer = removalTimers.get(agentId);
    if (removalTimer) {
      clearTimeout(removalTimer);
      removalTimers.delete(agentId);
    }

    // Start polling for new lines
    const timer = setInterval(() => {
      readNewLines(agentId, broadcast);
    }, 1000);
    pollTimers.set(agentId, timer);
  });

  watcher.on('change', (filePath: string) => {
    if (!filePath.endsWith('.jsonl')) return;
    const agentId = getAgentIdByFile(filePath);
    if (agentId !== undefined) {
      readNewLines(agentId, broadcast);
    }
  });

  watcher.on('unlink', (filePath: string) => {
    const agentId = getAgentIdByFile(filePath);
    if (agentId !== undefined) {
      // Stop polling
      const timer = pollTimers.get(agentId);
      if (timer) {
        clearInterval(timer);
        pollTimers.delete(agentId);
      }
      // Delay removal so character stays visible briefly
      const removalTimer = setTimeout(() => {
        removalTimers.delete(agentId);
        removeAgent(agentId, broadcast);
      }, INACTIVE_REMOVAL_DELAY_MS);
      removalTimers.set(agentId, removalTimer);
    }
  });
}
