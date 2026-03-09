import { useState } from 'react';

import type { AgentInfo } from '../hooks/useExtensionMessages.js';
import { calculateCost } from '../hooks/useExtensionMessages.js';

interface TopBarProps {
  activeAgents: number;
  toolsRunning: number;
  sessionsToday: number;
  totalCost: number;
  agentInfos: Record<number, AgentInfo>;
}

export function TopBar({
  activeAgents,
  toolsRunning,
  sessionsToday,
  totalCost,
  agentInfos,
}: TopBarProps) {
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 56,
        zIndex: 'var(--pixel-controls-z)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border)',
        padding: '6px 14px',
        boxShadow: 'var(--pixel-shadow)',
      }}
    >
      <Stat value={activeAgents} label="active" color="#5ac88c" />
      <Sep />
      <Stat value={toolsRunning} label="tools" color="#e8c87e" />
      <Sep />
      <Stat value={sessionsToday} label="today" color="#7ec8e3" />
      <Sep />
      <div style={{ position: 'relative' }}>
        <span
          onClick={() => setShowCostBreakdown(!showCostBreakdown)}
          style={{
            fontSize: 'var(--text-lg)',
            fontFamily: 'var(--system-font)',
            color: '#c8a8e8',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          title="Total cost today (click for breakdown)"
        >
          ${totalCost.toFixed(2)}
        </span>
        {showCostBreakdown && Object.keys(agentInfos).length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              background: 'var(--pixel-bg)',
              border: '2px solid var(--pixel-border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4), var(--pixel-shadow)',
              padding: '10px 14px',
              minWidth: 220,
              zIndex: 200,
              borderRadius: 4,
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--pixel-font)',
                color: 'var(--pixel-text-dim)',
                marginBottom: 8,
                borderBottom: '1px solid var(--pixel-border)',
                paddingBottom: 6,
              }}
            >
              Cost Breakdown
            </div>
            {Object.entries(agentInfos).map(([idStr, info]) => {
              const cost = calculateCost(info);
              return (
                <div
                  key={idStr}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    fontSize: 'var(--text-base)',
                    fontFamily: 'var(--system-font)',
                    color: 'var(--pixel-text)',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                    }}
                  >
                    {info.slug || info.label}
                  </span>
                  <span style={{ color: '#c8a8e8', flexShrink: 0 }}>${cost.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color, fontWeight: 'bold', fontSize: 'var(--pxfont-lg)', fontFamily: 'var(--pixel-font)' }}>{value}</span>
      <span style={{ fontFamily: 'var(--pixel-font)', fontSize: 'var(--pxfont-sm)', color: 'var(--pixel-text-dim)' }}>{label}</span>
    </span>
  );
}

function Sep() {
  return <span style={{ color: 'var(--pixel-border-light)', fontSize: 'var(--pxfont-base)' }}>|</span>;
}
