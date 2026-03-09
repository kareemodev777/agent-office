import { useState } from 'react';

import { isSoundEnabled, setSoundEnabled } from '../notificationSound.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
}

const THEME_KEY = 'agent-office-theme';

export function getStoredTheme(): 'dark' | 'light' {
  return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
}

export function applyTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

// Apply theme on module load
applyTheme(getStoredTheme());

const menuItemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '6px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  textAlign: 'left',
};

export function SettingsModal({
  isOpen,
  onClose,
  isDebugMode,
  onToggleDebugMode,
}: SettingsModalProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [soundLocal, setSoundLocal] = useState(isSoundEnabled);
  const [theme, setTheme] = useState(getStoredTheme);

  if (!isOpen) return null;

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <>
      {/* Dark backdrop -- click to close */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 49,
        }}
      />
      {/* Centered modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          borderRadius: 0,
          padding: '4px',
          boxShadow: 'var(--pixel-shadow)',
          minWidth: 200,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            borderBottom: '1px solid var(--pixel-border)',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '24px', color: 'var(--pixel-text)' }}>Settings</span>
          <button
            onClick={onClose}
            onMouseEnter={() => setHovered('close')}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === 'close' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
              border: 'none',
              borderRadius: 0,
              color: 'var(--pixel-text-dim)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            X
          </button>
        </div>
        {/* Theme toggle */}
        <button
          onClick={handleToggleTheme}
          onMouseEnter={() => setHovered('theme')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...menuItemBase,
            background: hovered === 'theme' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
          }}
        >
          <span>Theme</span>
          <span
            style={{
              fontSize: '18px',
              color: 'var(--pixel-accent)',
              border: '1px solid var(--pixel-accent)',
              padding: '0 6px',
            }}
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>
        {/* Sound */}
        <button
          onClick={() => {
            const newVal = !isSoundEnabled();
            setSoundEnabled(newVal);
            setSoundLocal(newVal);
          }}
          onMouseEnter={() => setHovered('sound')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...menuItemBase,
            background: hovered === 'sound' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
          }}
        >
          <span>Sound Notifications</span>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid var(--pixel-border-light)',
              borderRadius: 0,
              background: soundLocal ? 'var(--pixel-accent)' : 'transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              lineHeight: 1,
              color: '#fff',
            }}
          >
            {soundLocal ? 'X' : ''}
          </span>
        </button>
        {/* Debug */}
        <button
          onClick={onToggleDebugMode}
          onMouseEnter={() => setHovered('debug')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...menuItemBase,
            background: hovered === 'debug' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
          }}
        >
          <span>Debug View</span>
          {isDebugMode && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--pixel-accent)',
                flexShrink: 0,
              }}
            />
          )}
        </button>
      </div>
    </>
  );
}
