import { useState, useRef, useEffect } from 'react';

interface SpawnDialogProps {
  onSpawn: (cwd: string, prompt: string) => void;
  onClose: () => void;
}

export function SpawnDialog({ onSpawn, onClose }: SpawnDialogProps) {
  const [cwd, setCwd] = useState('');
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (cwd.trim() && prompt.trim()) {
      onSpawn(cwd.trim(), prompt.trim());
      onClose();
    }
  };

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
          boxShadow: 'var(--pixel-shadow)',
          padding: 16,
          width: 400,
        }}
      >
        <div style={{ fontSize: '22px', color: 'var(--pixel-text)', marginBottom: 12 }}>
          Spawn Agent
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
            Working Directory
          </label>
          <input
            ref={inputRef}
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/project"
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '18px',
              background: 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text)',
              border: '1px solid var(--pixel-border)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '16px', color: 'var(--pixel-text-dim)', display: 'block', marginBottom: 4 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the agent do?"
            rows={3}
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '18px',
              background: 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text)',
              border: '1px solid var(--pixel-border)',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handleSubmit();
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              fontSize: '20px',
              background: 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text)',
              border: '1px solid var(--pixel-border)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '4px 12px',
              fontSize: '20px',
              background: 'var(--pixel-agent-bg)',
              color: 'var(--pixel-agent-text)',
              border: '1px solid var(--pixel-agent-border)',
              cursor: 'pointer',
            }}
          >
            Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
