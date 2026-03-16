import { useState } from 'react';

import type { AgentInfo, SystemStats } from '../hooks/useExtensionMessages.js';
import { calculateCost } from '../hooks/useExtensionMessages.js';

interface TopBarProps {
  activeAgents: number;
  toolsRunning: number;
  sessionsToday: number;
  totalCost: number;
  agentInfos: Record<number, AgentInfo>;
  systemStats: SystemStats;
}

export function TopBar({
  activeAgents,
  toolsRunning,
  sessionsToday,
  totalCost,
  agentInfos,
  systemStats,
}: TopBarProps) {
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showResourceDetail, setShowResourceDetail] = useState(false);

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

      {/* Resource utilisation meter */}
      {systemStats.memTotalMB > 0 && (
        <>
          <Sep />
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowResourceDetail(!showResourceDetail)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              title="System resources (click for details)"
            >
              {/* CPU meter */}
              <ResourceBar
                value={systemStats.cpuPercent}
                label="CPU"
                color={systemStats.cpuPercent > 80 ? '#FF453A' : systemStats.cpuPercent > 50 ? '#FFD60A' : '#30D158'}
              />
              {/* RAM meter */}
              <ResourceBar
                value={systemStats.memPercent}
                label="RAM"
                color={systemStats.memPercent > 85 ? '#FF453A' : systemStats.memPercent > 65 ? '#FFD60A' : '#0A84FF'}
              />
              {/* Capacity pill */}
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: systemStats.estimatedCapacity === 0 ? '#FF453A' : '#30D158',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}
                title={`~${systemStats.estimatedCapacity} more agents can run based on free RAM`}
              >
                +{systemStats.estimatedCapacity}
              </span>
            </div>

            {/* Expanded resource detail panel */}
            {showResourceDetail && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '12px 14px',
                  minWidth: 260,
                  zIndex: 200,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: 10,
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  System Resources
                </div>

                {/* CPU row */}
                <ResourceDetailRow
                  label="CPU"
                  value={`${systemStats.cpuPercent}%`}
                  percent={systemStats.cpuPercent}
                  color={systemStats.cpuPercent > 80 ? '#FF453A' : systemStats.cpuPercent > 50 ? '#FFD60A' : '#30D158'}
                />

                {/* RAM row */}
                <ResourceDetailRow
                  label="RAM"
                  value={`${systemStats.memUsedMB >= 1024
                    ? (systemStats.memUsedMB / 1024).toFixed(1) + ' GB'
                    : systemStats.memUsedMB + ' MB'
                  } / ${(systemStats.memTotalMB / 1024).toFixed(0)} GB`}
                  percent={systemStats.memPercent}
                  color={systemStats.memPercent > 85 ? '#FF453A' : systemStats.memPercent > 65 ? '#FFD60A' : '#0A84FF'}
                />

                {/* Capacity estimate */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 'var(--text-sm)',
                    padding: '6px 0',
                    borderTop: '1px solid var(--border)',
                    marginTop: 6,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>Capacity (est.)</span>
                  <span
                    style={{
                      color: systemStats.estimatedCapacity === 0 ? '#FF453A' : '#30D158',
                      fontWeight: 'bold',
                    }}
                  >
                    ~{systemStats.estimatedCapacity} more agent{systemStats.estimatedCapacity !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Per-process breakdown */}
                {systemStats.processes.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        marginTop: 10,
                        marginBottom: 6,
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: 4,
                      }}
                    >
                      Claude Processes ({systemStats.processes.length})
                    </div>
                    {systemStats.processes.map((p) => (
                      <div
                        key={p.pid}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-primary)',
                          padding: '3px 0',
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                            fontSize: 11,
                          }}
                        >
                          {p.pid}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            fontSize: 11,
                          }}
                          title={p.cmd}
                        >
                          {p.cmd}
                        </span>
                        <span style={{ color: '#FFD60A', flexShrink: 0, fontSize: 11 }}>
                          {p.cpu.toFixed(1)}%
                        </span>
                        <span style={{ color: '#0A84FF', flexShrink: 0, fontSize: 11 }}>
                          {p.memMB >= 1024
                            ? (p.memMB / 1024).toFixed(1) + 'G'
                            : p.memMB + 'M'}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {systemStats.processes.length === 0 && (
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      marginTop: 8,
                      fontStyle: 'italic',
                    }}
                  >
                    No claude processes detected
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
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

/** Compact inline bar (label + thin progress bar + %) */
function ResourceBar({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          display: 'inline-block',
          width: 40,
          height: 4,
          borderRadius: 2,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${Math.min(100, value)}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.5s ease, background 0.3s ease',
          }}
        />
      </span>
      <span style={{ fontSize: 'var(--text-sm)', color, fontWeight: 'bold', minWidth: 28 }}>
        {value}%
      </span>
    </span>
  );
}

/** Full-width row for the detail panel */
function ResourceDetailRow({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--text-sm)',
          marginBottom: 4,
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)' }}>{value}</span>
      </div>
      <div
        style={{
          width: '100%',
          height: 4,
          borderRadius: 2,
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, percent)}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.5s ease, background 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
