interface ShortcutsHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { key: 'S', desc: 'Open Spawn dialog' },
  { key: 'I', desc: 'Toggle Inspect panel' },
  { key: 'K', desc: 'Kill selected agent' },
  { key: 'M', desc: 'Toggle Minimap' },
  { key: 'W', desc: 'Toggle Widget mode' },
  { key: '/', desc: 'Open Search' },
  { key: '1-9', desc: 'Select agent by index' },
  { key: 'Esc', desc: 'Close panel / deselect' },
  { key: '?', desc: 'Show this help' },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          width: 380,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Keyboard Shortcuts</span>
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
        {shortcuts.map(({ key, desc }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                minWidth: 32,
                textAlign: 'center',
              }}
            >
              {key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
