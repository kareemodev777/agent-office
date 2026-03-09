import { useEffect, useRef, useState } from 'react';

import type { WorkspaceFolder } from '../hooks/useExtensionMessages.js';
import { transport } from '../transport.js';
import { SettingsModal } from './SettingsModal.js';

interface BottomToolbarProps {
  isEditMode: boolean;
  onOpenClaude: () => void;
  onToggleEditMode: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
  workspaceFolders: WorkspaceFolder[];
  onSpawnAgent?: () => void;
  onShowHistory?: () => void;
  onShowShortcuts?: () => void;
  onToggleWidget?: () => void;
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 'var(--z-controls)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 20,
  padding: '4px 6px',
  boxShadow: 'var(--shadow-md)',
};

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'var(--btn-bg)',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--btn-active)',
  color: 'var(--accent)',
};

export function BottomToolbar({
  isEditMode,
  onOpenClaude,
  onToggleEditMode,
  isDebugMode,
  onToggleDebugMode,
  workspaceFolders,
  onSpawnAgent,
  onShowHistory,
  onShowShortcuts,
  onToggleWidget,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState<number | null>(null);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  // Close folder picker on outside click
  useEffect(() => {
    if (!isFolderPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setIsFolderPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isFolderPickerOpen]);

  const hasMultipleFolders = workspaceFolders.length > 1;

  const handleAgentClick = () => {
    if (hasMultipleFolders) {
      setIsFolderPickerOpen((v) => !v);
    } else {
      onOpenClaude();
    }
  };

  const handleFolderSelect = (folder: WorkspaceFolder) => {
    setIsFolderPickerOpen(false);
    transport.postMessage({ type: 'openClaude', folderPath: folder.path });
  };

  return (
    <>
    <div style={panelStyle}>
      <div ref={folderPickerRef} style={{ position: 'relative' }}>
        <button
          onClick={handleAgentClick}
          onMouseEnter={() => setHovered('agent')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            background:
              hovered === 'agent' || isFolderPickerOpen
                ? 'rgba(48, 209, 88, 0.2)'
                : 'rgba(48, 209, 88, 0.12)',
            border: '1px solid rgba(48, 209, 88, 0.3)',
            color: '#30D158',
          }}
        >
          + Agent
        </button>
        {isFolderPickerOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              minWidth: 160,
              zIndex: 'var(--z-controls)',
            }}
          >
            {workspaceFolders.map((folder, i) => (
              <button
                key={folder.path}
                onClick={() => handleFolderSelect(folder)}
                onMouseEnter={() => setHoveredFolder(i)}
                onMouseLeave={() => setHoveredFolder(null)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 14px',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  background: hoveredFolder === i ? 'var(--btn-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {folder.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {onSpawnAgent && (
        <button
          onClick={onSpawnAgent}
          onMouseEnter={() => setHovered('spawn')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            background: hovered === 'spawn' ? 'var(--btn-hover)' : btnBase.background,
          }}
          title="Spawn a new agent with a prompt"
        >
          Spawn
        </button>
      )}
      {onToggleWidget && (
        <button
          onClick={onToggleWidget}
          onMouseEnter={() => setHovered('widget')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            background: hovered === 'widget' ? 'var(--btn-hover)' : btnBase.background,
          }}
          title="Compact widget mode (W)"
        >
          Widget
        </button>
      )}
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--btn-hover)' : btnBase.background,
              }
        }
        title="Edit office layout"
      >
        Layout
      </button>
      {onShowHistory && (
        <button
          onClick={onShowHistory}
          onMouseEnter={() => setHovered('history')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            background: hovered === 'history' ? 'var(--btn-hover)' : btnBase.background,
          }}
          title="Session history"
        >
          History
        </button>
      )}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background:
                    hovered === 'settings' ? 'var(--btn-hover)' : btnBase.background,
                }
          }
          title="Settings"
        >
          Settings
        </button>
      </div>
      {onShowShortcuts && (
        <button
          onClick={onShowShortcuts}
          onMouseEnter={() => setHovered('shortcuts')}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...btnBase,
            background: hovered === 'shortcuts' ? 'var(--btn-hover)' : btnBase.background,
          }}
          title="Keyboard shortcuts (?)"
        >
          Keys
        </button>
      )}
    </div>
    {isSettingsOpen && (
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDebugMode={isDebugMode}
        onToggleDebugMode={onToggleDebugMode}
      />
    )}
    </>
  );
}
