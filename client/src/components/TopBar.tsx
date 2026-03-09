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
        zIndex: 'var(--z-controls)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 14px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <Stat value={activeAgents} label="active" color="#30D158" />
      <Sep />
      <Stat value={toolsRunning} label="tools" color="#FFD60A" />
      <Sep />
      <Stat value={sessionsToday} label="today" color="#0A84FF" />
      <Sep />
      <div style={{ position: 'relative' }}>
        <span
          onClick={() => setShowCostBreakdown(!showCostBreakdown)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
          title="Total cost today (click for breakdown)"
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#BF5AF2',
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#BF5AF2', fontWeight: 'bold', fontSize: 'var(--text-lg)' }}>
            ${totalCost.toFixed(2)}
          </span>
        </span>
        {showCostBreakdown && Object.keys(agentInfos).length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              padding: '10px 14px',
              minWidth: 220,
              zIndex: 200,
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginBottom: 8,
                borderBottom: '1px solid var(--border)',
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
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
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
                  <span style={{ color: '#BF5AF2', flexShrink: 0 }}>${cost.toFixed(2)}</span>
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ color, fontWeight: 'bold', fontSize: 'var(--text-lg)' }}>{value}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
    </span>
  );
}

function Sep() {
  return (
    <span
      style={{
        display: 'inline-block',
        borderLeft: '1px solid var(--border)',
        height: 16,
        alignSelf: 'center',
      }}
    />
  );
}
