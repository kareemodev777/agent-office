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
        background: 'rgba(0,0,0,0.5)',
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
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), var(--pixel-shadow)',
          padding: 20,
          width: 360,
          borderRadius: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-text)' }}>Keyboard Shortcuts</span>
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
        {shortcuts.map(({ key, desc }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: 'var(--text-base)',
              fontFamily: 'var(--system-font)',
              color: 'var(--pixel-text)',
            }}
          >
            <span style={{ color: 'var(--pixel-text-dim)' }}>{desc}</span>
            <span
              style={{
                color: 'var(--pixel-accent)',
                fontFamily: 'var(--pixel-font)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--pixel-border)',
                padding: '2px 10px',
                borderRadius: 4,
                minWidth: 28,
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
