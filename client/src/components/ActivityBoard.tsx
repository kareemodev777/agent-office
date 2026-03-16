import { useState, useRef, useEffect } from 'react';

import type { AgentInfo, AgentPhase, PhaseInfo, ProjectGroup, FileConflict, ActivityEvent } from '../hooks/useExtensionMessages.js';

interface ActivityBoardProps {
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  agentPhases: Record<number, PhaseInfo>;
  projectGroups: ProjectGroup[];
  fileConflicts: FileConflict[];
  activityFeed: ActivityEvent[];
  onClose: () => void;
  onInspect: (id: number) => void;
}

const PHASE_COLORS: Record<AgentPhase, string> = {
  exploring: '#0A84FF',
  planning: '#BF5AF2',
  coding: '#30D158',
  testing: '#FFD60A',
  reviewing: '#FF9F0A',
  idle: '#636366',
};

const PHASE_LABELS: Record<AgentPhase, string> = {
  exploring: 'Exploring',
  planning: 'Planning',
  coding: 'Coding',
  testing: 'Testing',
  reviewing: 'Reviewing',
  idle: 'Idle',
};

const EVENT_COLORS: Record<ActivityEvent['type'], string> = {
  tool_start: '#30D158',
  tool_done: '#636366',
  phase_change: '#BF5AF2',
  conflict: '#FF453A',
  status_change: '#0A84FF',
};

export function ActivityBoard({
  agents,
  agentInfos,
  agentPhases,
  projectGroups,
  fileConflicts,
  activityFeed,
  onClose,
  onInspect,
}: ActivityBoardProps) {
  const [filter, setFilter] = useState<'all' | 'conflicts' | number>('all');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [activityFeed.length, autoScroll]);

  const filteredFeed = activityFeed.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'conflicts') return e.type === 'conflict';
    return e.agentId === filter;
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 'var(--z-panels)' as unknown as number,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Activity Board
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 18,
            padding: '2px 6px',
          }}
        >
          x
        </button>
      </div>

      {/* Agent Phase Summary */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
          Agent Phases
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {agents.map((id) => {
            const info = agentInfos[id];
            const phase = agentPhases[id];
            if (!info) return null;
            const phaseName = phase?.phase || 'idle';
            const color = PHASE_COLORS[phaseName];
            return (
              <button
                key={id}
                onClick={() => onInspect(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: 'var(--btn-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                  {info.slug || info.label}
                </span>
                <span style={{ color, fontSize: 11, fontWeight: 500 }}>
                  {PHASE_LABELS[phaseName]}
                </span>
              </button>
            );
          })}
          {agents.length === 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
              No active agents
            </span>
          )}
        </div>
      </div>

      {/* Project Groups */}
      {projectGroups.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Project Groups
          </div>
          {projectGroups.map((group) => (
            <div
              key={group.projectPath}
              style={{
                padding: '6px 10px',
                marginBottom: 4,
                background: group.conflicts.length > 0 ? 'rgba(255, 69, 58, 0.08)' : 'var(--btn-bg)',
                borderRadius: 'var(--radius-md)',
                border: group.conflicts.length > 0 ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {group.projectPath}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {group.agentIds.length} agent{group.agentIds.length !== 1 ? 's' : ''}
                </span>
              </div>
              {group.conflicts.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {group.conflicts.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 11,
                        color: '#FF453A',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>!</span>
                      <span>{c.file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conflicts Warning */}
      {fileConflicts.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(255, 69, 58, 0.08)',
            borderBottom: '1px solid rgba(255, 69, 58, 0.2)',
          }}
        >
          <div style={{ fontSize: 'var(--text-sm)', color: '#FF453A', fontWeight: 600 }}>
            {fileConflicts.length} File Conflict{fileConflicts.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <FilterBtn label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterBtn
          label="Conflicts"
          active={filter === 'conflicts'}
          onClick={() => setFilter('conflicts')}
          color="#FF453A"
        />
        {agents.map((id) => {
          const info = agentInfos[id];
          return (
            <FilterBtn
              key={id}
              label={info?.slug || info?.label || `#${id}`}
              active={filter === id}
              onClick={() => setFilter(id)}
            />
          );
        })}
      </div>

      {/* Activity Feed */}
      <div
        ref={feedRef}
        onMouseEnter={() => setAutoScroll(false)}
        onMouseLeave={() => setAutoScroll(true)}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {filteredFeed.length === 0 && (
          <div
            style={{
              padding: '20px 16px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              fontStyle: 'italic',
            }}
          >
            No activity yet
          </div>
        )}
        {filteredFeed.map((event) => (
          <div
            key={event.id}
            onMouseEnter={() => setHoveredRow(event.id)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              display: 'flex',
              gap: 8,
              padding: '4px 16px',
              fontSize: 'var(--text-sm)',
              background: hoveredRow === event.id ? 'var(--btn-hover)' : 'transparent',
              cursor: 'pointer',
              alignItems: 'flex-start',
            }}
            onClick={() => onInspect(event.agentId)}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 52, flexShrink: 0, fontFamily: 'monospace' }}>
              {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: EVENT_COLORS[event.type],
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <span
              style={{
                color: 'var(--text-secondary)',
                minWidth: 60,
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {event.agentName}
            </span>
            <span
              style={{
                color: event.type === 'conflict' ? '#FF453A' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {event.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterBtn({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        fontSize: 11,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: active ? (color || 'var(--accent)') : 'var(--btn-bg)',
        color: active ? '#fff' : (color || 'var(--text-secondary)'),
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
