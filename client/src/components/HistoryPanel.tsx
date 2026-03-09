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
        background: 'var(--pixel-bg)',
        borderRight: '2px solid var(--pixel-border)',
        boxShadow: '4px 0 8px rgba(0,0,0,0.3)',
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
          padding: '8px 12px',
          borderBottom: '2px solid var(--pixel-border)',
        }}
      >
        <span style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-text)' }}>Session History</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--pixel-text-dim)',
            fontSize: 'var(--text-xl)',
            fontFamily: 'var(--system-font)',
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
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--pixel-border)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#5ac88c',
                    boxShadow: '0 0 4px #5ac88c',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontFamily: 'var(--system-font)',
                    color: 'var(--pixel-text)',
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
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--pixel-font)',
                      color: 'var(--pixel-accent)',
                      border: '1px solid var(--pixel-accent)',
                      padding: '1px 6px',
                      borderRadius: 8,
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
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--system-font)',
                  color: 'var(--pixel-text-dim)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span>{formatDuration(duration)}</span>
                <span>${cost.toFixed(2)}</span>
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
                padding: '10px 14px',
                borderBottom: '1px solid var(--pixel-border)',
                opacity: 0.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--pixel-border)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontFamily: 'var(--system-font)',
                    color: 'var(--pixel-text)',
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
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--pixel-font)',
                      color: 'var(--pixel-text-dim)',
                      border: '1px solid var(--pixel-border)',
                      padding: '1px 6px',
                      borderRadius: 8,
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
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--system-font)',
                  color: 'var(--pixel-text-dim)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span>{formatDuration(s.duration)}</span>
                <span>${cost.toFixed(2)}</span>
                <span>finished</span>
              </div>
            </div>
          );
        })}

        {agents.length === 0 && closedSessions.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              fontSize: 'var(--text-base)',
              fontFamily: 'var(--system-font)',
              color: 'var(--pixel-text-dim)',
            }}
          >
            No sessions yet today
          </div>
        )}
      </div>
    </div>
  );
}
