import { useState, useCallback } from 'react';

import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundPrefs,
  setSoundPref,
  getVolume,
  setVolume,
  playSoundByType,
} from '../notificationSound.js';
import type { SoundType } from '../notificationSound.js';
import {
  getNotificationsToggle,
  setNotificationsEnabled,
} from '../notifications.js';
import { transport } from '../transport.js';

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

const SOUND_LABELS: Record<SoundType, string> = {
  done: 'Done chime',
  permission: 'Permission alert',
  stuck: 'Stuck alarm',
  spawn: 'Spawn note',
  search: 'Search click',
};

const Toggle = ({ checked, onClick }: { checked: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    style={{
      position: 'relative',
      width: 36,
      height: 20,
      borderRadius: 10,
      background: checked ? 'var(--accent)' : 'var(--btn-bg)',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      flexShrink: 0,
      transition: 'background 0.2s ease',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s ease',
      }}
    />
  </button>
);

export function SettingsModal({
  isOpen,
  onClose,
  isDebugMode,
  onToggleDebugMode,
}: SettingsModalProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [soundLocal, setSoundLocal] = useState(isSoundEnabled);
  const [theme, setTheme] = useState(getStoredTheme);
  const [notificationsOn, setNotificationsOn] = useState(getNotificationsToggle);
  const [soundPrefs, setSoundPrefsState] = useState(getSoundPrefs);
  const [volume, setVolumeState] = useState(getVolume);
  const [webhookUrl, setWebhookUrlState] = useState('');
  const [webhookLoaded, setWebhookLoaded] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Load webhook URL on first open
  if (isOpen && !webhookLoaded) {
    transport.postMessage({ type: 'getSettings' });
    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'settings') {
        setWebhookUrlState((msg.webhookUrl as string) || '');
        setWebhookLoaded(true);
        unsub();
      }
    });
    setTimeout(unsub, 3000);
  }

  const handleSetTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleToggleNotifications = useCallback(async () => {
    const newVal = !notificationsOn;
    await setNotificationsEnabled(newVal);
    setNotificationsOn(newVal);
  }, [notificationsOn]);

  const handleSoundPrefToggle = useCallback((type: SoundType) => {
    const newVal = !soundPrefs[type];
    setSoundPref(type, newVal);
    setSoundPrefsState(getSoundPrefs());
    setSoundLocal(isSoundEnabled());
  }, [soundPrefs]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value) / 100;
    setVolume(vol);
    setVolumeState(vol);
  }, []);

  const handleWebhookSave = useCallback(() => {
    transport.postMessage({ type: 'updateSettings', settings: { webhookUrl } });
  }, [webhookUrl]);

  const handleClearHistory = useCallback(() => {
    transport.postMessage({ type: 'clearHistory' });
    setClearConfirm(false);
  }, []);

  if (!isOpen) return null;

  const settingsItemStyle = (key: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 20px',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    background: hovered === key ? 'var(--btn-hover)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    minHeight: 40,
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 49,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          boxShadow: 'var(--shadow-lg)',
          minWidth: 380,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            onMouseEnter={() => setHovered('close')}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === 'close' ? 'var(--btn-hover)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Theme toggle - segmented control */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
          }}
        >
          <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>Theme</span>
          <div
            style={{
              display: 'flex',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--btn-bg)',
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => handleSetTheme('dark')}
              style={{
                padding: '4px 14px',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                background: theme === 'dark' ? 'var(--accent)' : 'transparent',
                color: theme === 'dark' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Dark
            </button>
            <button
              onClick={() => handleSetTheme('light')}
              style={{
                padding: '4px 14px',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                background: theme === 'light' ? 'var(--accent)' : 'transparent',
                color: theme === 'light' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Light
            </button>
          </div>
        </div>

        {/* Notifications toggle */}
        <button
          onClick={handleToggleNotifications}
          onMouseEnter={() => setHovered('notif')}
          onMouseLeave={() => setHovered(null)}
          style={settingsItemStyle('notif')}
        >
          <span>Notifications</span>
          <Toggle checked={notificationsOn} />
        </button>

        {/* Sound master toggle */}
        <button
          onClick={() => {
            const newVal = !isSoundEnabled();
            setSoundEnabled(newVal);
            setSoundLocal(newVal);
            setSoundPrefsState(getSoundPrefs());
          }}
          onMouseEnter={() => setHovered('sound')}
          onMouseLeave={() => setHovered(null)}
          style={settingsItemStyle('sound')}
        >
          <span>Sound Notifications</span>
          <Toggle checked={soundLocal} />
        </button>

        {/* Per-sound toggles */}
        <div style={{ padding: '0 20px 12px 36px' }}>
          {(Object.keys(SOUND_LABELS) as SoundType[]).map((type) => (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                fontSize: 'var(--text-base)',
                color: 'var(--text-secondary)',
              }}
            >
              <span>{SOUND_LABELS[type]}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => playSoundByType(type)}
                  style={{
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                  }}
                >
                  Test
                </button>
                <Toggle checked={soundPrefs[type]} onClick={() => handleSoundPrefToggle(type)} />
              </div>
            </div>
          ))}

          {/* Volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={handleVolumeChange}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Webhook URL */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Webhook URL
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrlState(e.target.value)}
              placeholder="Discord or Slack webhook URL"
              style={{
                flex: 1,
                background: 'var(--btn-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '10px 14px',
                fontSize: 'var(--text-base)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <button
              onClick={handleWebhookSave}
              style={{
                background: 'var(--btn-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent)',
                cursor: 'pointer',
                padding: '10px 16px',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Debug */}
        <button
          onClick={onToggleDebugMode}
          onMouseEnter={() => setHovered('debug')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...settingsItemStyle('debug'),
            borderTop: '1px solid var(--border)',
          }}
        >
          <span>Debug View</span>
          {isDebugMode && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          )}
        </button>

        {/* Clear History - Danger Zone */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          {!clearConfirm ? (
            <button
              onClick={() => setClearConfirm(true)}
              onMouseEnter={() => setHovered('clear')}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: 0,
                fontSize: 'var(--text-base)',
                color: 'var(--red, #ff453a)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Clear History
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
                Clear all history?
              </span>
              <button
                onClick={handleClearHistory}
                style={{
                  background: 'var(--red, #ff453a)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                style={{
                  background: 'var(--btn-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  fontSize: 'var(--text-base)',
                  fontWeight: 500,
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
