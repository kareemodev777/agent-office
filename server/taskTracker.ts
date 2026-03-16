import type { AgentState } from './types.js';

export type AgentPhase = 'exploring' | 'planning' | 'coding' | 'testing' | 'reviewing' | 'idle';

interface PhaseTracker {
  currentPhase: AgentPhase;
  filesRead: number;
  filesModified: number;
  toolCounts: Record<string, number>;
  phaseStartedAt: number;
  recentTools: string[]; // last 10 tools for phase detection
}

const trackers = new Map<number, PhaseTracker>();

// Tools that indicate each phase
const EXPLORE_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']);
const CODE_TOOLS = new Set(['Edit', 'Write']);
const TEST_PATTERNS = [/\btest\b/i, /\bjest\b/i, /\bvitest\b/i, /\bpytest\b/i, /\bnpm\s+test\b/i, /\bcargo\s+test\b/i];

export function initTracker(agentId: number): void {
  if (!trackers.has(agentId)) {
    trackers.set(agentId, {
      currentPhase: 'idle',
      filesRead: 0,
      filesModified: 0,
      toolCounts: {},
      phaseStartedAt: Date.now(),
      recentTools: [],
    });
  }
}

export function removeTracker(agentId: number): void {
  trackers.delete(agentId);
}

/**
 * Record a tool usage and detect phase transitions.
 * Returns the new phase if it changed, null otherwise.
 */
export function recordToolUsage(
  agentId: number,
  toolName: string,
  status: string,
): { phase: AgentPhase; changed: boolean } {
  let tracker = trackers.get(agentId);
  if (!tracker) {
    initTracker(agentId);
    tracker = trackers.get(agentId)!;
  }

  // Update counts
  tracker.toolCounts[toolName] = (tracker.toolCounts[toolName] || 0) + 1;
  tracker.recentTools.push(toolName);
  if (tracker.recentTools.length > 10) {
    tracker.recentTools.shift();
  }

  // Track file metrics
  if (toolName === 'Read' || toolName === 'Grep' || toolName === 'Glob') {
    tracker.filesRead++;
  } else if (toolName === 'Edit' || toolName === 'Write') {
    tracker.filesModified++;
  }

  // Detect phase from recent tool window
  const newPhase = detectPhase(tracker, toolName, status);
  const changed = newPhase !== tracker.currentPhase;
  if (changed) {
    tracker.currentPhase = newPhase;
    tracker.phaseStartedAt = Date.now();
  }

  return { phase: tracker.currentPhase, changed };
}

/**
 * Set agent to idle phase (when waiting).
 */
export function setIdle(agentId: number): { phase: AgentPhase; changed: boolean } {
  const tracker = trackers.get(agentId);
  if (!tracker) return { phase: 'idle', changed: false };
  const changed = tracker.currentPhase !== 'idle';
  if (changed) {
    tracker.currentPhase = 'idle';
    tracker.phaseStartedAt = Date.now();
  }
  return { phase: 'idle', changed };
}

export function getPhaseInfo(agentId: number): {
  phase: AgentPhase;
  filesRead: number;
  filesModified: number;
  phaseStartedAt: number;
} | null {
  const tracker = trackers.get(agentId);
  if (!tracker) return null;
  return {
    phase: tracker.currentPhase,
    filesRead: tracker.filesRead,
    filesModified: tracker.filesModified,
    phaseStartedAt: tracker.phaseStartedAt,
  };
}

function detectPhase(tracker: PhaseTracker, toolName: string, status: string): AgentPhase {
  // Planning: explicit plan mode
  if (toolName === 'EnterPlanMode') return 'planning';

  // Testing: Bash commands with test patterns
  if (toolName === 'Bash') {
    for (const pattern of TEST_PATTERNS) {
      if (pattern.test(status)) return 'testing';
    }
  }

  // Use recent tool window (last 5) to detect dominant activity
  const recent = tracker.recentTools.slice(-5);
  const exploreCnt = recent.filter(t => EXPLORE_TOOLS.has(t)).length;
  const codeCnt = recent.filter(t => CODE_TOOLS.has(t)).length;

  // If mostly coding tools recently
  if (codeCnt >= 3) return 'coding';

  // If currently using a code tool
  if (CODE_TOOLS.has(toolName)) return 'coding';

  // If mostly explore tools recently (and after some coding has happened)
  if (exploreCnt >= 3 && tracker.filesModified > 0) return 'reviewing';

  // If mostly explore tools (before any coding)
  if (exploreCnt >= 3) return 'exploring';

  // If individual tool matches
  if (EXPLORE_TOOLS.has(toolName)) return 'exploring';

  return tracker.currentPhase === 'idle' ? 'exploring' : tracker.currentPhase;
}
