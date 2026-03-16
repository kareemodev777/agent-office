import * as path from 'path';
import type { AgentState } from './types.js';

export interface FileConflict {
  file: string;
  agentIds: number[];
  detectedAt: number;
}

export interface ProjectGroup {
  projectPath: string;
  agentIds: number[];
  activeFiles: Record<number, string[]>; // agentId → files being touched
  conflicts: FileConflict[];
}

// Track files each agent is currently touching
const agentActiveFiles = new Map<number, Set<string>>();

// Cache of detected conflicts
const activeConflicts = new Map<string, FileConflict>();

/**
 * Record that an agent is touching a file (from tool status parsing).
 * Returns a new conflict if one is detected, null otherwise.
 */
export function trackFileAccess(agentId: number, filePath: string, agents: Map<number, AgentState>): FileConflict | null {
  let files = agentActiveFiles.get(agentId);
  if (!files) {
    files = new Set();
    agentActiveFiles.set(agentId, files);
  }
  files.add(filePath);

  // Check if another agent on the same project is touching this file
  const agent = agents.get(agentId);
  if (!agent) return null;

  const projectPath = getProjectPathForAgent(agent);
  const conflictingAgentIds: number[] = [agentId];

  for (const [otherId, otherFiles] of agentActiveFiles) {
    if (otherId === agentId) continue;
    if (!otherFiles.has(filePath)) continue;
    const otherAgent = agents.get(otherId);
    if (!otherAgent) continue;
    if (getProjectPathForAgent(otherAgent) === projectPath) {
      conflictingAgentIds.push(otherId);
    }
  }

  if (conflictingAgentIds.length > 1) {
    const key = `${projectPath}:${filePath}`;
    const existing = activeConflicts.get(key);
    if (existing) {
      // Update agent list
      existing.agentIds = [...new Set(conflictingAgentIds)];
      return existing;
    }
    const conflict: FileConflict = {
      file: filePath,
      agentIds: conflictingAgentIds,
      detectedAt: Date.now(),
    };
    activeConflicts.set(key, conflict);
    return conflict;
  }

  return null;
}

/**
 * Clear file tracking when an agent's tools complete.
 */
export function clearAgentFiles(agentId: number): void {
  agentActiveFiles.delete(agentId);
  // Remove any conflicts involving this agent
  for (const [key, conflict] of activeConflicts) {
    conflict.agentIds = conflict.agentIds.filter(id => id !== agentId);
    if (conflict.agentIds.length <= 1) {
      activeConflicts.delete(key);
    }
  }
}

/**
 * Remove all tracking for an agent (on close).
 */
export function removeAgentTracking(agentId: number): void {
  clearAgentFiles(agentId);
}

/**
 * Build project groups from current agents.
 */
export function getProjectGroups(agents: Map<number, AgentState>): ProjectGroup[] {
  const groupMap = new Map<string, ProjectGroup>();

  for (const agent of agents.values()) {
    const projectPath = getProjectPathForAgent(agent);
    if (!projectPath) continue;

    let group = groupMap.get(projectPath);
    if (!group) {
      group = { projectPath, agentIds: [], activeFiles: {}, conflicts: [] };
      groupMap.set(projectPath, group);
    }
    group.agentIds.push(agent.id);
    const files = agentActiveFiles.get(agent.id);
    if (files && files.size > 0) {
      group.activeFiles[agent.id] = [...files];
    }
  }

  // Attach conflicts to groups
  for (const conflict of activeConflicts.values()) {
    // Find which group this conflict belongs to
    for (const group of groupMap.values()) {
      if (conflict.agentIds.some(id => group.agentIds.includes(id))) {
        group.conflicts.push(conflict);
        break;
      }
    }
  }

  return [...groupMap.values()].filter(g => g.agentIds.length > 0);
}

/**
 * Get active files for a specific agent.
 */
export function getAgentFiles(agentId: number): string[] {
  const files = agentActiveFiles.get(agentId);
  return files ? [...files] : [];
}

function getProjectPathForAgent(agent: AgentState): string {
  // Derive from jsonlFile path, matching deriveProjectPath logic
  const dir = path.basename(path.dirname(agent.jsonlFile));
  if (!dir.startsWith('-')) return agent.label;

  const markers = ['-Projects-', '-projects-', '-repos-', '-src-', '-code-', '-dev-', '-workspace-'];
  for (const marker of markers) {
    const idx = dir.indexOf(marker);
    if (idx !== -1) {
      const projectName = dir.slice(idx + marker.length);
      const markerWord = marker.slice(1, -1);
      return `~/${markerWord}/${projectName}`;
    }
  }
  return agent.label;
}

/**
 * Extract file path from a tool status string.
 * Returns null if no file path is found.
 */
export function extractFileFromStatus(status: string): string | null {
  // Patterns: "Reading filename.ts", "Editing filename.ts", "Writing filename.ts"
  const fileMatch = status.match(/^(?:Reading|Editing|Writing)\s+(.+)$/);
  if (fileMatch) return fileMatch[1];
  return null;
}
