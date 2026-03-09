import type { AgentInfo, ClosedSession } from '../hooks/useExtensionMessages.js';
import { calculateCost } from '../hooks/useExtensionMessages.js';

interface HistoryPanelProps {
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  closedSessions: ClosedSession[];
  onClose: () => void;
  onInspect?: (id: number) => void;
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ${min % 60}m`;
}

export function HistoryPanel({
  agents,
  agentInfos,
  closedSessions,
  onClose,
  onInspect,
}: HistoryPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 360,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
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
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Session History</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xl)',
            cursor: 'pointer',
            padding: '4px 8px',
            minHeight: 32,
          }}
        >
          ×
        </button>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Active sessions */}
        {agents.map((id) => {
          const info = agentInfos[id];
          if (!info) return null;
          const cost = calculateCost(info);
          const duration = Date.now() - info.startedAt;
          return (
            <button
              key={`active-${id}`}
              onClick={() => onInspect?.(id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#30D158',
                    boxShadow: '0 0 6px rgba(48, 209, 88, 0.5)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {info.slug || info.label}
                </span>
                {info.role && (
                  <span
                    style={{
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      padding: '2px 8px',
                      borderRadius: 12,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {info.role}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 10,
                }}
              >
                <span>{formatDuration(duration)}</span>
                <span style={{ color: '#BF5AF2' }}>${cost.toFixed(2)}</span>
              </div>
            </button>
          );
        })}

        {/* Closed sessions */}
        {[...closedSessions].reverse().map((s) => {
          const cost = calculateCost(s);
          return (
            <div
              key={`closed-${s.id}-${s.closedAt}`}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                opacity: 0.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--border)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.slug || s.label}
                </span>
                {s.role && (
                  <span
                    style={{
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      padding: '2px 8px',
                      borderRadius: 12,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.role}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 10,
                }}
              >
                <span>{formatDuration(s.duration)}</span>
                <span style={{ color: '#BF5AF2' }}>${cost.toFixed(2)}</span>
                <span>finished</span>
              </div>
            </div>
          );
        })}

        {agents.length === 0 && closedSessions.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            No sessions yet today
          </div>
        )}
      </div>
    </div>
  );
}
