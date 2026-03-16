import { useRef, useEffect, useState, useMemo } from 'react';

import type { AgentInfo, AgentPhase, PhaseInfo, ActivityEvent, FileConflict } from '../hooks/useExtensionMessages.js';
import { calculateCost } from '../hooks/useExtensionMessages.js';
import type { ToolActivity } from '../office/types.js';

interface ConsoleModeProps {
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  agentTools: Record<number, ToolActivity[]>;
  agentPhases: Record<number, PhaseInfo>;
  activityFeed: ActivityEvent[];
  fileConflicts: FileConflict[];
  totalCost: number;
  onExit: () => void;
  onInspect: (id: number) => void;
}

const PHASE_SYMBOLS: Record<AgentPhase, string> = {
  exploring: 'EXPLORE',
  planning: 'PLAN',
  coding: 'CODE',
  testing: 'TEST',
  reviewing: 'REVIEW',
  idle: 'IDLE',
};

const PHASE_ANSI: Record<AgentPhase, string> = {
  exploring: '#0A84FF',
  planning: '#BF5AF2',
  coding: '#30D158',
  testing: '#FFD60A',
  reviewing: '#FF9F0A',
  idle: '#636366',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ConsoleMode({
  agents,
  agentInfos,
  agentTools,
  agentPhases,
  activityFeed,
  fileConflicts,
  totalCost,
  onExit,
  onInspect,
}: ConsoleModeProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [activityFeed.length, autoScroll]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  const filteredFeed = useMemo(() => {
    if (!filter) return activityFeed;
    const lower = filter.toLowerCase();
    return activityFeed.filter(
      (e) =>
        e.agentName.toLowerCase().includes(lower) ||
        e.detail.toLowerCase().includes(lower),
    );
  }, [activityFeed, filter]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0d1117',
        color: '#c9d1d9',
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid #21262d',
          background: '#161b22',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#58a6ff', fontWeight: 700 }}>agent-office</span>
          <span style={{ color: '#484f58' }}>|</span>
          <span style={{ color: '#30D158' }}>{agents.length} agents</span>
          <span style={{ color: '#484f58' }}>|</span>
          <span style={{ color: '#BF5AF2' }}>${totalCost.toFixed(2)}</span>
          {fileConflicts.length > 0 && (
            <>
              <span style={{ color: '#484f58' }}>|</span>
              <span style={{ color: '#FF453A' }}>{fileConflicts.length} conflict{fileConflicts.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 4,
              padding: '3px 8px',
              color: '#c9d1d9',
              fontSize: 12,
              fontFamily: 'inherit',
              width: 140,
              outline: 'none',
            }}
          />
          <button
            onClick={onExit}
            style={{
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 4,
              padding: '3px 10px',
              color: '#c9d1d9',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ESC Office View
          </button>
        </div>
      </div>

      {/* Agent status bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #21262d',
          background: '#161b22',
          overflowX: 'auto',
        }}
      >
        {agents.map((id) => {
          const info = agentInfos[id];
          const phase = agentPhases[id];
          const tools = agentTools[id] || [];
          const phaseName = phase?.phase || 'idle';
          const cost = info ? calculateCost(info) : 0;
          const activeTool = tools.find((t) => !t.done);

          return (
            <div
              key={id}
              onClick={() => onInspect(id)}
              style={{
                padding: '6px 14px',
                borderRight: '1px solid #21262d',
                cursor: 'pointer',
                minWidth: 160,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#1c2128';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e6edf3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                  {info?.slug || info?.label || `#${id}`}
                </span>
                <span
                  style={{
                    color: PHASE_ANSI[phaseName],
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: `${PHASE_ANSI[phaseName]}18`,
                  }}
                >
                  {PHASE_SYMBOLS[phaseName]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#484f58' }}>
                {activeTool ? (
                  <span style={{ color: '#58a6ff' }}>{activeTool.status}</span>
                ) : (
                  <span>waiting</span>
                )}
                <span style={{ float: 'right', color: '#BF5AF2' }}>${cost.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div style={{ padding: '10px 14px', color: '#484f58', fontStyle: 'italic' }}>
            No active agents. Start Claude Code in a project.
          </div>
        )}
      </div>

      {/* Log feed */}
      <div
        ref={feedRef}
        onMouseEnter={() => setAutoScroll(false)}
        onMouseLeave={() => setAutoScroll(true)}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {filteredFeed.slice().reverse().map((event) => {
          const isConflict = event.type === 'conflict';
          const isPhase = event.type === 'phase_change';
          const phaseColor = isPhase ? PHASE_ANSI[event.detail as AgentPhase] || '#c9d1d9' : undefined;

          return (
            <div
              key={event.id}
              onClick={() => onInspect(event.agentId)}
              style={{
                display: 'flex',
                gap: 0,
                padding: '1px 16px',
                cursor: 'pointer',
                lineHeight: '20px',
                background: isConflict ? 'rgba(255, 69, 58, 0.06)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = isConflict
                  ? 'rgba(255, 69, 58, 0.1)'
                  : '#161b22';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isConflict
                  ? 'rgba(255, 69, 58, 0.06)'
                  : 'transparent';
              }}
            >
              <span style={{ color: '#484f58', minWidth: 70, flexShrink: 0 }}>
                {formatTime(event.timestamp)}
              </span>
              <span
                style={{
                  color: isConflict ? '#FF453A' : '#8b949e',
                  minWidth: 100,
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {event.agentName}
              </span>
              <span style={{ color: isConflict ? '#FF453A' : phaseColor || '#c9d1d9' }}>
                {event.detail}
              </span>
            </div>
          );
        })}
        {filteredFeed.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#484f58', textAlign: 'center' }}>
            {filter ? 'No matching events' : 'Waiting for activity...'}
          </div>
        )}
      </div>

      {/* Status line */}
      <div
        style={{
          padding: '4px 16px',
          borderTop: '1px solid #21262d',
          background: '#161b22',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#484f58',
        }}
      >
        <span>{filteredFeed.length} events</span>
        <span>{autoScroll ? 'auto-scroll ON' : 'auto-scroll OFF (hover to pause)'}</span>
      </div>
    </div>
  );
}
