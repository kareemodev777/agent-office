interface TopBarProps {
  activeAgents: number;
  toolsRunning: number;
  sessionsToday: number;
}

export function TopBar({ activeAgents, toolsRunning, sessionsToday }: TopBarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 'var(--pixel-controls-z)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border)',
        padding: '4px 10px',
        boxShadow: 'var(--pixel-shadow)',
      }}
    >
      <Stat value={activeAgents} label="active" color="#5ac88c" />
      <Sep />
      <Stat value={toolsRunning} label="tools" color="#e8c87e" />
      <Sep />
      <Stat value={sessionsToday} label="today" color="#7ec8e3" />
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span style={{ fontSize: '20px', color: 'var(--pixel-text-dim)' }}>
      <span style={{ color, fontWeight: 'bold' }}>{value}</span> {label}
    </span>
  );
}

function Sep() {
  return <span style={{ color: 'var(--pixel-border-light)', fontSize: '20px' }}>|</span>;
}
