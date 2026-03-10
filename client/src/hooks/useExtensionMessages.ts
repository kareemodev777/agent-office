import { useEffect, useRef, useState } from 'react';

import { playDoneSound, playAlertSound, playStuckSound, playSpawnSound } from '../notificationSound.js';
import { sendBrowserNotification } from '../notifications.js';
import type { OfficeState } from '../office/engine/officeState.js';
import { extractToolName } from '../office/toolUtils.js';
import type { OfficeLayout, ToolActivity } from '../office/types.js';
import { transport } from '../transport.js';

export interface SubagentCharacter {
  id: number;
  parentAgentId: number;
  parentToolId: string;
  label: string;
}

export interface FurnitureAsset {
  id: string;
  name: string;
  label: string;
  category: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls: boolean;
  partOfGroup?: boolean;
  groupId?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
}

export interface WorkspaceFolder {
  name: string;
  path: string;
}

export interface AgentInfo {
  label: string;
  slug: string | null;
  role: string | null;
  gitBranch: string | null;
  projectPath: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  startedAt: number;
}

/** Calculate cost using Opus pricing */
export function calculateCost(info: {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): number {
  return (
    (info.inputTokens * 3 +
      info.outputTokens * 15 +
      (info.cacheCreationTokens ?? 0) * 3.75 +
      (info.cacheReadTokens ?? 0) * 0.3) /
    1_000_000
  );
}

export interface SystemProcessStats {
  pid: number;
  cpu: number;
  memMB: number;
  cmd: string;
}

export interface SystemStats {
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  processes: SystemProcessStats[];
  estimatedCapacity: number;
}

export interface ClosedSession {
  id: number;
  label: string;
  slug: string | null;
  role: string | null;
  duration: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  closedAt: number;
}

export interface ExtensionMessageState {
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  selectedAgent: number | null;
  agentTools: Record<number, ToolActivity[]>;
  agentStatuses: Record<number, string>;
  subagentTools: Record<number, Record<string, ToolActivity[]>>;
  subagentCharacters: SubagentCharacter[];
  layoutReady: boolean;
  loadedAssets?: { catalog: FurnitureAsset[]; sprites: Record<string, string[][]> };
  workspaceFolders: WorkspaceFolder[];
  stats: { activeAgents: number; toolsRunning: number; sessionsToday: number };
  stuckAgents: Set<number>;
  totalCost: number;
  closedSessions: ClosedSession[];
  textPreviews: Record<number, { text: string; timestamp: number }>;
  systemStats: SystemStats;
}

function saveAgentSeats(os: OfficeState): void {
  const seats: Record<number, { palette: number; hueShift: number; seatId: string | null }> = {};
  for (const ch of os.characters.values()) {
    if (ch.isSubagent) continue;
    seats[ch.id] = { palette: ch.palette, hueShift: ch.hueShift, seatId: ch.seatId };
  }
  try {
    localStorage.setItem('agent-office-seats', JSON.stringify(seats));
  } catch {
    // ignore
  }
}

function loadAgentSeats(): Record<number, { palette?: number; hueShift?: number; seatId?: string }> {
  try {
    const raw = localStorage.getItem('agent-office-seats');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

// Role → hue shift for character tinting
const ROLE_HUE_SHIFTS: Record<string, number> = {
  architect: 210,   // blue
  builder: 120,     // green
  reviewer: 270,    // purple
  tester: 30,       // orange
  documenter: 180,  // cyan
};

export function useExtensionMessages(
  getOfficeState: () => OfficeState,
  onLayoutLoaded?: (layout: OfficeLayout) => void,
  isEditDirty?: () => boolean,
): ExtensionMessageState {
  const [agents, setAgents] = useState<number[]>([]);
  const [agentInfos, setAgentInfos] = useState<Record<number, AgentInfo>>({});
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [agentTools, setAgentTools] = useState<Record<number, ToolActivity[]>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<number, string>>({});
  const [subagentTools, setSubagentTools] = useState<
    Record<number, Record<string, ToolActivity[]>>
  >({});
  const [subagentCharacters, setSubagentCharacters] = useState<SubagentCharacter[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [stats, setStats] = useState({ activeAgents: 0, toolsRunning: 0, sessionsToday: 0 });
  const [stuckAgents, setStuckAgents] = useState<Set<number>>(new Set());
  const [totalCost, setTotalCost] = useState(0);
  const [closedSessions, setClosedSessions] = useState<ClosedSession[]>([]);
  const [textPreviews, setTextPreviews] = useState<Record<number, { text: string; timestamp: number }>>({});
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuPercent: 0,
    memUsedMB: 0,
    memTotalMB: 0,
    memPercent: 0,
    processes: [],
    estimatedCapacity: 0,
  });
  const closedCostRef = useRef(0);

  const layoutReadyRef = useRef(false);

  useEffect(() => {
    // Initialize layout immediately (no VS Code layout loading)
    const os = getOfficeState();
    if (!layoutReadyRef.current) {
      try {
        const saved = localStorage.getItem('agent-office-layout');
        if (saved) {
          const layout = JSON.parse(saved);
          os.rebuildFromLayout(layout);
          onLayoutLoaded?.(layout);
        } else {
          onLayoutLoaded?.(os.getLayout());
        }
      } catch {
        onLayoutLoaded?.(os.getLayout());
      }
      layoutReadyRef.current = true;
      setLayoutReady(true);
    }

    const unsubscribe = transport.onMessage((msg: Record<string, unknown>) => {
      const os = getOfficeState();

      if (msg.type === 'snapshot') {
        const incoming = msg.agents as Array<{
          id: number;
          label: string;
          slug: string | null;
          role: string | null;
          gitBranch: string | null;
          projectPath?: string;
          isWaiting: boolean;
          inputTokens: number;
          outputTokens: number;
          cacheCreationTokens: number;
          cacheReadTokens: number;
          startedAt: number;
          tools: Array<{ toolId: string; status: string }>;
          subagents?: Array<{ parentToolId: string; tools: Array<{ toolId: string; status: string }> }>;
        }>;
        const meta = loadAgentSeats();
        const ids: number[] = [];
        const infos: Record<number, AgentInfo> = {};
        const newSubChars: SubagentCharacter[] = [];
        for (const a of incoming) {
          ids.push(a.id);
          infos[a.id] = {
            label: a.label,
            slug: a.slug,
            role: a.role,
            gitBranch: a.gitBranch,
            projectPath: a.projectPath || '',
            inputTokens: a.inputTokens,
            outputTokens: a.outputTokens,
            cacheCreationTokens: a.cacheCreationTokens ?? 0,
            cacheReadTokens: a.cacheReadTokens ?? 0,
            startedAt: a.startedAt,
          };
          const m = meta[a.id];
          os.addAgent(a.id, m?.palette, m?.hueShift, m?.seatId, true, a.label);
          for (const tool of a.tools) {
            const toolName = extractToolName(tool.status);
            os.setAgentTool(a.id, toolName);
            os.setAgentActive(a.id, true);
            // Spawn sub-agent characters for Task tools
            if (tool.status.startsWith('Subtask:')) {
              const label = tool.status.slice('Subtask:'.length).trim();
              const subId = os.addSubagent(a.id, tool.toolId);
              newSubChars.push({ id: subId, parentAgentId: a.id, parentToolId: tool.toolId, label });
            }
          }
          // Also restore sub-agents from snapshot subagents array
          if (a.subagents) {
            for (const sub of a.subagents) {
              // Only add if not already added via tool status above
              const existing = os.getSubagentId(a.id, sub.parentToolId);
              if (existing === null) {
                const subId = os.addSubagent(a.id, sub.parentToolId);
                newSubChars.push({ id: subId, parentAgentId: a.id, parentToolId: sub.parentToolId, label: '' });
              }
              for (const subTool of sub.tools) {
                const subId = os.getSubagentId(a.id, sub.parentToolId);
                if (subId !== null) {
                  const subToolName = extractToolName(subTool.status);
                  os.setAgentTool(subId, subToolName);
                  os.setAgentActive(subId, true);
                }
              }
            }
          }
          if (a.isWaiting) {
            os.setAgentActive(a.id, false);
            os.showWaitingBubble(a.id);
          }
        }
        if (newSubChars.length > 0) {
          setSubagentCharacters(newSubChars);
        }
        setAgents(ids);
        setAgentInfos(infos);
        if (ids.length > 0) {
          saveAgentSeats(os);
        }
      } else if (msg.type === 'agentCreated') {
        const id = msg.id as number;
        const label = msg.label as string | undefined;
        const projectPath = (msg.projectPath as string) || '';
        setAgents((prev) => (prev.includes(id) ? prev : [...prev, id]));
        setAgentInfos((prev) => ({
          ...prev,
          [id]: {
            label: label || `Agent #${id}`,
            slug: null,
            role: null,
            gitBranch: null,
            projectPath,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            startedAt: Date.now(),
          },
        }));
        setSelectedAgent(id);
        os.addAgent(id, undefined, undefined, undefined, undefined, label);
        saveAgentSeats(os);
        playSpawnSound();
        sendBrowserNotification('New agent', `New agent: ${label || 'Agent #' + id}`, id);
      } else if (msg.type === 'agentClosed') {
        const id = msg.id as number;
        // Accumulate cost and save to closed sessions before removing info
        setAgentInfos((prev) => {
          const info = prev[id];
          if (info) {
            closedCostRef.current += calculateCost(info);
            setClosedSessions((cs) => [
              ...cs,
              {
                id,
                label: info.label,
                slug: info.slug,
                role: info.role,
                duration: Date.now() - info.startedAt,
                inputTokens: info.inputTokens,
                outputTokens: info.outputTokens,
                cacheCreationTokens: info.cacheCreationTokens,
                cacheReadTokens: info.cacheReadTokens,
                closedAt: Date.now(),
              },
            ]);
          }
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setAgents((prev) => prev.filter((a) => a !== id));
        setSelectedAgent((prev) => (prev === id ? null : prev));
        setAgentTools((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setAgentStatuses((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSubagentTools((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        os.removeAllSubagents(id);
        setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id));
        os.removeAgent(id);
        setStuckAgents((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else if (msg.type === 'agentLabelUpdate') {
        const id = msg.id as number;
        const label = msg.label as string;
        const slug = msg.slug as string;
        setAgentInfos((prev) => ({
          ...prev,
          [id]: { ...prev[id], label, slug },
        }));
        // Update character folderName and refresh room assignments
        const ch = os.characters.get(id);
        if (ch) {
          ch.folderName = label;
          os.refreshRoomProjects();
        }
      } else if (msg.type === 'agentRoleUpdate') {
        const id = msg.id as number;
        const role = msg.role as string;
        setAgentInfos((prev) => ({
          ...prev,
          [id]: { ...prev[id], role },
        }));
        // Apply role-based hue shift to character
        const hueShift = ROLE_HUE_SHIFTS[role];
        if (hueShift !== undefined) {
          const ch = os.characters.get(id);
          if (ch) ch.hueShift = hueShift;
        }
      } else if (msg.type === 'agentToolStart') {
        const id = msg.id as number;
        const toolId = msg.toolId as string;
        const status = msg.status as string;
        setAgentTools((prev) => {
          const list = prev[id] || [];
          if (list.some((t) => t.toolId === toolId)) return prev;
          return { ...prev, [id]: [...list, { toolId, status, done: false }] };
        });
        const toolName = extractToolName(status);
        os.setAgentTool(id, toolName);
        os.setAgentActive(id, true);
        os.clearPermissionBubble(id);
        // Clear stuck status on activity
        setStuckAgents((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (status.startsWith('Subtask:')) {
          const label = status.slice('Subtask:'.length).trim();
          const subId = os.addSubagent(id, toolId);
          setSubagentCharacters((prev) => {
            if (prev.some((s) => s.id === subId)) return prev;
            return [...prev, { id: subId, parentAgentId: id, parentToolId: toolId, label }];
          });
        }
      } else if (msg.type === 'agentToolDone') {
        const id = msg.id as number;
        const toolId = msg.toolId as string;
        setAgentTools((prev) => {
          const list = prev[id];
          if (!list) return prev;
          return {
            ...prev,
            [id]: list.map((t) => (t.toolId === toolId ? { ...t, done: true } : t)),
          };
        });
      } else if (msg.type === 'agentToolsClear') {
        const id = msg.id as number;
        setAgentTools((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setSubagentTools((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        os.removeAllSubagents(id);
        setSubagentCharacters((prev) => prev.filter((s) => s.parentAgentId !== id));
        os.setAgentTool(id, null);
        os.clearPermissionBubble(id);
      } else if (msg.type === 'agentStatus') {
        const id = msg.id as number;
        const status = msg.status as string;
        setAgentStatuses((prev) => {
          if (status === 'active') {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          }
          return { ...prev, [id]: status };
        });
        os.setAgentActive(id, status === 'active');
        if (status === 'waiting') {
          os.showWaitingBubble(id);
          playDoneSound();
          const info = agentInfos[id];
          sendBrowserNotification('Agent finished', `Agent ${info?.slug || info?.label || id} finished`, id);
        }
      } else if (msg.type === 'agentToolPermission') {
        const id = msg.id as number;
        setAgentTools((prev) => {
          const list = prev[id];
          if (!list) return prev;
          return {
            ...prev,
            [id]: list.map((t) => (t.done ? t : { ...t, permissionWait: true })),
          };
        });
        os.showPermissionBubble(id);
        playAlertSound();
        const pInfo = agentInfos[id];
        sendBrowserNotification('Permission needed', `Agent ${pInfo?.slug || pInfo?.label || id} needs permission`, id);
      } else if (msg.type === 'subagentToolPermission') {
        const id = msg.id as number;
        const parentToolId = msg.parentToolId as string;
        const subId = os.getSubagentId(id, parentToolId);
        if (subId !== null) {
          os.showPermissionBubble(subId);
        }
      } else if (msg.type === 'agentToolPermissionClear') {
        const id = msg.id as number;
        setAgentTools((prev) => {
          const list = prev[id];
          if (!list) return prev;
          const hasPermission = list.some((t) => t.permissionWait);
          if (!hasPermission) return prev;
          return {
            ...prev,
            [id]: list.map((t) => (t.permissionWait ? { ...t, permissionWait: false } : t)),
          };
        });
        os.clearPermissionBubble(id);
        for (const [subId, meta] of os.subagentMeta) {
          if (meta.parentAgentId === id) {
            os.clearPermissionBubble(subId);
          }
        }
      } else if (msg.type === 'subagentToolStart') {
        const id = msg.id as number;
        const parentToolId = msg.parentToolId as string;
        const toolId = msg.toolId as string;
        const status = msg.status as string;
        setSubagentTools((prev) => {
          const agentSubs = prev[id] || {};
          const list = agentSubs[parentToolId] || [];
          if (list.some((t) => t.toolId === toolId)) return prev;
          return {
            ...prev,
            [id]: { ...agentSubs, [parentToolId]: [...list, { toolId, status, done: false }] },
          };
        });
        const subId = os.getSubagentId(id, parentToolId);
        if (subId !== null) {
          const subToolName = extractToolName(status);
          os.setAgentTool(subId, subToolName);
          os.setAgentActive(subId, true);
        }
      } else if (msg.type === 'subagentToolDone') {
        const id = msg.id as number;
        const parentToolId = msg.parentToolId as string;
        const toolId = msg.toolId as string;
        setSubagentTools((prev) => {
          const agentSubs = prev[id];
          if (!agentSubs) return prev;
          const list = agentSubs[parentToolId];
          if (!list) return prev;
          return {
            ...prev,
            [id]: {
              ...agentSubs,
              [parentToolId]: list.map((t) => (t.toolId === toolId ? { ...t, done: true } : t)),
            },
          };
        });
      } else if (msg.type === 'subagentClear') {
        const id = msg.id as number;
        const parentToolId = msg.parentToolId as string;
        setSubagentTools((prev) => {
          const agentSubs = prev[id];
          if (!agentSubs || !(parentToolId in agentSubs)) return prev;
          const next = { ...agentSubs };
          delete next[parentToolId];
          if (Object.keys(next).length === 0) {
            const outer = { ...prev };
            delete outer[id];
            return outer;
          }
          return { ...prev, [id]: next };
        });
        os.removeSubagent(id, parentToolId);
        setSubagentCharacters((prev) =>
          prev.filter((s) => !(s.parentAgentId === id && s.parentToolId === parentToolId)),
        );
      } else if (msg.type === 'agentTokenUpdate') {
        const id = msg.id as number;
        setAgentInfos((prev) => {
          if (!prev[id]) return prev;
          return {
            ...prev,
            [id]: {
              ...prev[id],
              inputTokens: msg.inputTokens as number,
              outputTokens: msg.outputTokens as number,
              cacheCreationTokens: (msg.cacheCreationTokens as number) ?? 0,
              cacheReadTokens: (msg.cacheReadTokens as number) ?? 0,
            },
          };
        });
      } else if (msg.type === 'stats') {
        setStats({
          activeAgents: msg.activeAgents as number,
          toolsRunning: msg.toolsRunning as number,
          sessionsToday: msg.sessionsToday as number,
        });
        // Recalculate total cost (closed + active agents)
        setAgentInfos((prev) => {
          let activeCost = 0;
          for (const info of Object.values(prev)) {
            activeCost += calculateCost(info);
          }
          setTotalCost(closedCostRef.current + activeCost);
          return prev;
        });
      } else if (msg.type === 'agentStuck') {
        const id = msg.id as number;
        setStuckAgents((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        playStuckSound();
        const sInfo = agentInfos[id];
        sendBrowserNotification('Agent stuck', `Agent ${sInfo?.slug || sInfo?.label || id} may be stuck`, id);
      } else if (msg.type === 'agentTextPreview') {
        const id = msg.id as number;
        const text = msg.text as string;
        setTextPreviews((prev) => ({ ...prev, [id]: { text, timestamp: Date.now() } }));
      } else if (msg.type === 'systemStats') {
        setSystemStats({
          cpuPercent: msg.cpuPercent as number,
          memUsedMB: msg.memUsedMB as number,
          memTotalMB: msg.memTotalMB as number,
          memPercent: msg.memPercent as number,
          processes: (msg.processes as SystemProcessStats[]) || [],
          estimatedCapacity: msg.estimatedCapacity as number,
        });
      }
    });

    return unsubscribe;
  }, [getOfficeState]);

  return {
    agents,
    agentInfos,
    selectedAgent,
    agentTools,
    agentStatuses,
    subagentTools,
    subagentCharacters,
    layoutReady,
    loadedAssets: undefined,
    workspaceFolders: [],
    stats,
    stuckAgents,
    totalCost,
    closedSessions,
    textPreviews,
    systemStats,
  };
}
