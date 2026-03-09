import { useState } from 'react';

import type { AgentInfo } from '../hooks/useExtensionMessages.js';
import { calculateCost } from '../hooks/useExtensionMessages.js';
import type { ToolActivity } from '../office/types.js';

interface WidgetModeProps {
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  agentTools: Record<number, ToolActivity[]>;
  totalCost: number;
  onInspect: (id: number) => void;
  onExit: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  architect: '#7ec8e3',
  builder: '#a8d8a8',
  reviewer: '#c8a8e8',
  tester: '#e8c87e',
  documenter: '#8ee8d8',
};

function formatDuration(startedAt: number): string {
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getCurrentTool(tools: ToolActivity[] | undefined): string {
  if (!tools || tools.length === 0) return 'Idle';
  const active = [...tools].reverse().find((t) => !t.done);
  if (active) {
    if (active.permissionWait) return 'Needs approval';
    return active.status;
  }
  return 'Idle';
}

export function WidgetMode({ agents, agentInfos, agentTools, totalCost, onInspect, onExit }: WidgetModeProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Duration ticker
  useState(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--pixel-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '2px solid var(--pixel-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '20px', color: 'var(--pixel-text)' }}>
          Agent Office
        </span>
        <button
          onClick={onExit}
          style={{
            background: 'var(--pixel-btn-bg)',
            border: '1px solid var(--pixel-border)',
            color: 'var(--pixel-text)',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '16px',
          }}
        >
          Office View
        </button>
      </div>

      {/* Agent list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {agents.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: '18px', color: 'var(--pixel-text-dim)' }}>
            No agents running
          </div>
        )}
        {agents.map((id) => {
          const info = agentInfos[id];
          if (!info) return null;
          const tools = agentTools[id];
          const currentTool = getCurrentTool(tools);
          const cost = calculateCost(info);
          const role = info.role;
          const dotColor = (role && ROLE_COLORS[role]) || '#5a8cff';
          const isExpanded = expandedId === id;
          const totalTokens = info.inputTokens + info.outputTokens;

          return (
            <div key={id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  gap: 8,
                  padding: '6px 12px',
                  background: isExpanded ? 'var(--pixel-btn-hover-bg)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--pixel-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: dotColor,
                    boxShadow: `0 0 4px ${dotColor}`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '16px', color: 'var(--pixel-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {info.slug || info.label}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--pixel-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentTool}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--pixel-text-dim)' }}>
                    {formatDuration(info.startedAt)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#c8a8e8' }}>
                    ${cost.toFixed(2)}
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div
                  style={{
                    padding: '6px 12px 6px 28px',
                    borderBottom: '1px solid var(--pixel-border)',
                    background: 'var(--pixel-btn-bg)',
                  }}
                >
                  <div style={{ fontSize: '13px', color: 'var(--pixel-text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {role && <span style={{ color: ROLE_COLORS[role] || 'var(--pixel-accent)', textTransform: 'uppercase' }}>{role}</span>}
                    {info.gitBranch && <span>branch: {info.gitBranch}</span>}
                    <span>tokens: {formatTokens(totalTokens)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onInspect(id); }}
                    style={{
                      marginTop: 4,
                      background: 'var(--pixel-btn-bg)',
                      border: '1px solid var(--pixel-border)',
                      color: 'var(--pixel-accent)',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      fontSize: '13px',
                    }}
                  >
                    Inspect
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total cost footer */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '2px solid var(--pixel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '14px', color: 'var(--pixel-text-dim)' }}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''} running
        </span>
        <span style={{ fontSize: '16px', color: '#c8a8e8' }}>
          Total: ~${totalCost.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
