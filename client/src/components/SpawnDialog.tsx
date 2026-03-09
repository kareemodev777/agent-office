import { useState, useRef, useEffect } from 'react';

import { transport } from '../transport.js';

interface ProjectFolder {
  name: string;
  path: string;
}

interface SpawnDialogProps {
  onSpawn: (cwd: string, prompt: string) => void;
  onClose: () => void;
}

const RECENT_PROJECTS_KEY = 'agent-office-recent-projects';
const LAST_CWD_KEY = 'agent-office-last-cwd';

function getRecentProjects(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentProject(cwd: string): void {
  const recent = getRecentProjects().filter((p) => p !== cwd);
  recent.unshift(cwd);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent.slice(0, 5)));
  localStorage.setItem(LAST_CWD_KEY, cwd);
}

function getLastCwd(): string {
  return localStorage.getItem(LAST_CWD_KEY) || '';
}

export function SpawnDialog({ onSpawn, onClose }: SpawnDialogProps) {
  const [cwd, setCwd] = useState(getLastCwd);
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recentProjects = getRecentProjects();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Request project folders from server
    transport.postMessage({ type: 'getProjects' });
    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'projects') {
        setProjects(msg.folders as ProjectFolder[]);
      }
    });
    return unsub;
  }, []);

  const handleSubmit = () => {
    if (cwd.trim() && prompt.trim()) {
      saveRecentProject(cwd.trim());
      onSpawn(cwd.trim(), prompt.trim());
      onClose();
    }
  };

  const selectProject = (projectPath: string) => {
    setCwd(projectPath);
    setShowBrowser(false);
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
          width: 440,
        }}
      >
        <div style={{ fontSize: '22px', color: 'var(--pixel-text)', marginBottom: 12 }}>
          Spawn Agent
        </div>
        <div style={{ marginBottom: 8 }}>
          <label
            style={{
              fontSize: '16px',
              color: 'var(--pixel-text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            Working Directory
            <button
              onClick={() => setShowBrowser(!showBrowser)}
              style={{
                fontSize: '14px',
                color: 'var(--pixel-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showBrowser ? 'Hide' : 'Browse ~/Projects'}
            </button>
          </label>
          <input
            ref={inputRef}
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // If prompt is filled, submit; otherwise focus prompt
                if (prompt.trim()) {
                  handleSubmit();
                }
              }
            }}
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

        {/* Project browser */}
        {showBrowser && projects.length > 0 && (
          <div
            style={{
              marginBottom: 8,
              maxHeight: 160,
              overflowY: 'auto',
              border: '1px solid var(--pixel-border)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            {projects.map((p, i) => (
              <button
                key={p.path}
                onClick={() => selectProject(p.path)}
                onMouseEnter={() => setHoveredProject(i)}
                onMouseLeave={() => setHoveredProject(null)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '4px 8px',
                  fontSize: '16px',
                  color: cwd === p.path ? 'var(--pixel-agent-text)' : 'var(--pixel-text)',
                  background:
                    cwd === p.path
                      ? 'var(--pixel-agent-bg)'
                      : hoveredProject === i
                        ? 'var(--pixel-btn-hover-bg)'
                        : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Recent projects */}
        {!showBrowser && recentProjects.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '14px', color: 'var(--pixel-text-dim)' }}>Recent: </span>
            {recentProjects.map((rp) => {
              const name = rp.split('/').pop() || rp;
              return (
                <button
                  key={rp}
                  onClick={() => setCwd(rp)}
                  style={{
                    fontSize: '14px',
                    color: 'var(--pixel-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 4px',
                    textDecoration: 'underline',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: '16px',
              color: 'var(--pixel-text-dim)',
              display: 'block',
              marginBottom: 4,
            }}
          >
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
              if (e.key === 'Enter' && (e.metaKey || !e.shiftKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--pixel-text-dim)' }}>
            Press Enter to submit, Shift+Enter for newline
          </span>
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
