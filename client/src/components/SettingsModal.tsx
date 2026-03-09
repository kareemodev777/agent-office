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

const menuItemBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '10px 14px',
  fontSize: 'var(--text-base)',
  fontFamily: 'var(--system-font)',
  color: 'var(--pixel-text)',
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  textAlign: 'left',
  minHeight: 36,
};

const SOUND_LABELS: Record<SoundType, string> = {
  done: 'Done chime',
  permission: 'Permission alert',
  stuck: 'Stuck alarm',
  spawn: 'Spawn note',
  search: 'Search click',
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

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
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

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <span
      style={{
        width: 18,
        height: 18,
        border: '2px solid var(--pixel-border-light)',
        borderRadius: 2,
        background: checked ? 'var(--pixel-accent)' : 'transparent',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--system-font)',
        lineHeight: 1,
        color: '#fff',
      }}
    >
      {checked ? '✓' : ''}
    </span>
  );

  return (
    <>
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
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          borderRadius: 4,
          padding: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), var(--pixel-shadow)',
          minWidth: 340,
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
            padding: '8px 14px',
            borderBottom: '1px solid var(--pixel-border)',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-text)' }}>Settings</span>
          <button
            onClick={onClose}
            onMouseEnter={() => setHovered('close')}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === 'close' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
              border: 'none',
              borderRadius: 0,
              color: 'var(--pixel-text-dim)',
              fontSize: 'var(--text-xl)',
              fontFamily: 'var(--system-font)',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              minHeight: 32,
            }}
          >
            ×
          </button>
        </div>

        {/* Theme toggle */}
        <button
          onClick={handleToggleTheme}
          onMouseEnter={() => setHovered('theme')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...menuItemBase, background: hovered === 'theme' ? 'var(--pixel-btn-hover-bg)' : 'transparent' }}
        >
          <span>Theme</span>
          <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-accent)', border: '1px solid var(--pixel-accent)', padding: '2px 10px', borderRadius: 8 }}>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* Notifications toggle */}
        <button
          onClick={handleToggleNotifications}
          onMouseEnter={() => setHovered('notif')}
          onMouseLeave={() => setHovered(null)}
          style={{ ...menuItemBase, background: hovered === 'notif' ? 'var(--pixel-btn-hover-bg)' : 'transparent' }}
        >
          <span>Notifications</span>
          <Checkbox checked={notificationsOn} />
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
          style={{ ...menuItemBase, background: hovered === 'sound' ? 'var(--pixel-btn-hover-bg)' : 'transparent' }}
        >
          <span>Sound Notifications</span>
          <Checkbox checked={soundLocal} />
        </button>

        {/* Per-sound toggles */}
        <div style={{ padding: '0 14px 8px 28px' }}>
          {(Object.keys(SOUND_LABELS) as SoundType[]).map((type) => (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--system-font)',
                color: 'var(--pixel-text-dim)',
              }}
            >
              <span>{SOUND_LABELS[type]}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => playSoundByType(type)}
                  style={{
                    background: 'var(--pixel-btn-bg)',
                    border: '1px solid var(--pixel-border)',
                    color: 'var(--pixel-text-dim)',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--pixel-font)',
                    minHeight: 28,
                  }}
                >
                  Test
                </button>
                <button
                  onClick={() => handleSoundPrefToggle(type)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Checkbox checked={soundPrefs[type]} />
                </button>
              </div>
            </div>
          ))}

          {/* Volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 'var(--text-base)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)' }}>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={handleVolumeChange}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)', minWidth: 36, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Webhook URL */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--pixel-border)' }}>
          <div style={{ fontSize: 'var(--text-base)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-text)', marginBottom: 6 }}>Webhook URL</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrlState(e.target.value)}
              placeholder="Discord or Slack webhook URL"
              style={{
                flex: 1,
                background: 'var(--pixel-btn-bg)',
                border: '1px solid var(--pixel-border)',
                color: 'var(--pixel-text)',
                padding: '6px 10px',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--system-font)',
                outline: 'none',
                minHeight: 36,
              }}
            />
            <button
              onClick={handleWebhookSave}
              style={{
                background: 'var(--pixel-btn-bg)',
                border: '1px solid var(--pixel-border)',
                color: 'var(--pixel-accent)',
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: 'var(--text-base)',
                fontFamily: 'var(--pixel-font)',
                minHeight: 36,
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
          style={{ ...menuItemBase, background: hovered === 'debug' ? 'var(--pixel-btn-hover-bg)' : 'transparent', borderTop: '1px solid var(--pixel-border)' }}
        >
          <span>Debug View</span>
          {isDebugMode && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pixel-accent)', flexShrink: 0 }} />
          )}
        </button>

        {/* Clear History */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--pixel-border)' }}>
          {!clearConfirm ? (
            <button
              onClick={() => setClearConfirm(true)}
              onMouseEnter={() => setHovered('clear')}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...menuItemBase,
                padding: 0,
                color: 'var(--pixel-text-dim)',
                background: hovered === 'clear' ? 'var(--pixel-btn-hover-bg)' : 'transparent',
              }}
            >
              Clear History
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-base)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)' }}>Clear all history?</span>
              <button
                onClick={handleClearHistory}
                style={{
                  background: 'var(--pixel-danger-bg)',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--pixel-font)',
                  minHeight: 36,
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                style={{
                  background: 'var(--pixel-btn-bg)',
                  border: '1px solid var(--pixel-border)',
                  color: 'var(--pixel-text)',
                  cursor: 'pointer',
                  padding: '6px 14px',
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--pixel-font)',
                  minHeight: 36,
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
