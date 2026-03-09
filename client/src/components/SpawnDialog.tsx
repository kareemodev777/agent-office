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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  fontSize: 'var(--text-base)',
  background: 'var(--btn-bg)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  outline: 'none',
};

function applyFocusRing(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--accent)';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.15)';
}

function removeFocusRing(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = 'var(--border)';
  e.currentTarget.style.boxShadow = 'none';
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
          width: 480,
        }}
      >
        {/* Title */}
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
          Spawn Agent
        </div>

        {/* Working Directory */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            Working Directory
            <button
              onClick={() => setShowBrowser(!showBrowser)}
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--accent)',
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
                if (prompt.trim()) {
                  handleSubmit();
                }
              }
            }}
            placeholder="/path/to/project"
            style={inputStyle}
            onFocus={applyFocusRing}
            onBlur={removeFocusRing}
          />
        </div>

        {/* Project browser */}
        {showBrowser && projects.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              maxHeight: 160,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--btn-bg)',
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
                  padding: '8px 14px',
                  fontSize: 'var(--text-base)',
                  color: cwd === p.path ? '#fff' : 'var(--text-primary)',
                  background:
                    cwd === p.path
                      ? 'var(--accent)'
                      : hoveredProject === i
                        ? 'var(--btn-hover)'
                        : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Recent projects */}
        {!showBrowser && recentProjects.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Recent:</span>
            {recentProjects.map((rp) => {
              const name = rp.split('/').pop() || rp;
              return (
                <button
                  key={rp}
                  onClick={() => setCwd(rp)}
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent)',
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    padding: '2px 10px',
                    textDecoration: 'none',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {/* Prompt */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'block',
              marginBottom: 6,
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
              ...inputStyle,
              resize: 'vertical',
            }}
            onFocus={applyFocusRing}
            onBlur={removeFocusRing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || !e.shiftKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
            Press Enter to submit, Shift+Enter for newline
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--btn-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '8px 16px',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              background: '#30D158',
              color: '#fff',
              border: 'none',
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
