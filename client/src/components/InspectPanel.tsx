import { useEffect, useState, useCallback, useRef } from 'react';
import { transport } from '../transport.js';

interface InspectPanelProps {
  agentId: number;
  agentLabel?: string;
  agentRole?: string | null;
  agentProjectPath?: string;
  onClose: () => void;
}

interface ParsedLine {
  type: string;
  summary: string;
  timestamp?: string;
  toolName?: string;
}

interface AgentMeta {
  slug: string | null;
  role: string | null;
  gitBranch: string | null;
  projectPath: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  startedAt: number;
}

function parseLine(raw: string): ParsedLine | null {
  try {
    const obj = JSON.parse(raw);
    const timestamp = obj.timestamp || obj.ts || obj.created_at || undefined;

    if (obj.type === 'assistant' || obj.role === 'assistant') {
      const content = obj.message?.content || obj.content || '';
      const results: ParsedLine[] = [];

      if (Array.isArray(content)) {
        const textBlocks: string[] = [];
        for (const b of content) {
          if (b.type === 'text' && b.text) textBlocks.push(b.text);
          if (b.type === 'tool_use' && b.name) {
            const name = b.name as string;
            const input = b.input || {};
            if (name === 'Task' || name === 'Agent') {
              const desc = typeof input.description === 'string' ? input.description : '';
              const subType = typeof input.subagent_type === 'string' ? input.subagent_type : '';
              const prefix = subType ? `[${subType}] ` : '';
              const summary = desc ? `${prefix}${desc}` : `Starting ${name.toLowerCase()}`;
              const type = name === 'Task' ? 'task' : 'agent';
              results.push({ type, summary, timestamp, toolName: name });
            } else {
              const inputStr = formatToolInput(name, input);
              const summary = inputStr ? `${name}: ${inputStr}` : name;
              results.push({ type: 'tool', summary, timestamp, toolName: name });
            }
          }
        }
        // If we found tool_use blocks, return the first one (most important)
        if (results.length > 0) return results[0];
        // Otherwise show the text content
        const preview = textBlocks.join(' ').split('\n').find(l => l.trim())?.trim().slice(0, 120);
        if (preview) return { type: 'assistant', summary: preview, timestamp };
        return { type: 'assistant', summary: '(thinking)', timestamp };
      } else if (typeof content === 'string') {
        const preview = content.slice(0, 120);
        return { type: 'assistant', summary: preview || '(thinking)', timestamp };
      }
      return { type: 'assistant', summary: '(thinking)', timestamp };
    }

    if (obj.type === 'user' || obj.role === 'user') {
      const content = obj.message?.content || obj.content || '';
      if (Array.isArray(content)) {
        const toolResults = content.filter((b: { type: string }) => b.type === 'tool_result');
        if (toolResults.length > 0) {
          // Show tool result summaries instead of skipping
          for (const tr of toolResults) {
            const resultContent = tr.content;
            let preview = '';
            if (typeof resultContent === 'string') {
              preview = resultContent.split('\n').find((l: string) => l.trim())?.trim().slice(0, 80) || '';
            } else if (Array.isArray(resultContent)) {
              const textBlock = resultContent.find((b: { type: string }) => b.type === 'text');
              if (textBlock?.text) {
                preview = textBlock.text.split('\n').find((l: string) => l.trim())?.trim().slice(0, 80) || '';
              }
            }
            if (tr.is_error) {
              return { type: 'error', summary: preview || 'Tool error', timestamp };
            }
            if (preview) {
              return { type: 'result', summary: preview, timestamp };
            }
          }
          return null;
        }
        const text = content.map((b: { type: string; text?: string }) =>
          b.type === 'text' ? b.text || '' : ''
        ).join(' ').trim();
        if (!text) return null;
        return { type: 'user', summary: text.slice(0, 120), timestamp };
      }
      const preview = typeof content === 'string' ? content.slice(0, 120) : '';
      if (!preview) return null;
      return { type: 'user', summary: preview, timestamp };
    }

    if (obj.type === 'system' && obj.subtype === 'turn_duration') {
      return { type: 'system', summary: 'Turn complete', timestamp };
    }

    // Progress records — extract useful info from TodoWrite, subagent activity
    if (obj.type === 'progress') {
      const data = obj.data;
      if (data?.type === 'todo_update' && data.text) {
        const status = data.status === 'completed' ? 'Done' : data.status || '';
        return { type: 'system', summary: `[${status}] ${data.text}`.slice(0, 120), timestamp };
      }
      // Show subagent text activity
      if (data?.message?.type === 'assistant') {
        const innerContent = data.message.message?.content;
        if (Array.isArray(innerContent)) {
          for (const b of innerContent) {
            if (b.type === 'tool_use' && b.name) {
              const inputStr = formatToolInput(b.name, b.input || {});
              return { type: 'tool', summary: `Sub: ${b.name}${inputStr ? ': ' + inputStr : ''}`, timestamp, toolName: b.name };
            }
          }
        }
      }
      return null;
    }

    if (obj.type === 'system') return null;

    return null;
  } catch {
    return null;
  }
}

function formatToolInput(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
    case 'Edit':
    case 'Write': {
      const fp = input.file_path;
      if (typeof fp === 'string') {
        const parts = fp.split('/');
        return parts[parts.length - 1] || '';
      }
      return '';
    }
    case 'Bash': {
      const cmd = typeof input.command === 'string' ? input.command : '';
      return cmd.slice(0, 80);
    }
    case 'Grep':
      return typeof input.pattern === 'string' ? `"${input.pattern.slice(0, 60)}"` : '';
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern.slice(0, 60) : '';
    default:
      return '';
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'user': return '#64D2FF';
    case 'assistant': return '#30D158';
    case 'tool': return '#FFD60A';
    case 'task': return '#FF9F0A';
    case 'agent': return '#BF5AF2';
    case 'result': return 'var(--text-tertiary)';
    case 'error': return '#FF453A';
    case 'system': return 'var(--text-tertiary)';
    default: return 'var(--text-secondary)';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'user': return 'USR';
    case 'assistant': return 'AST';
    case 'tool': return 'TUL';
    case 'task': return 'TSK';
    case 'agent': return 'AGT';
    case 'result': return 'RES';
    case 'error': return 'ERR';
    case 'system': return 'SYS';
    default: return type.slice(0, 3).toUpperCase();
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(startedAt: number): string {
  const sec = Math.floor((Date.now() - startedAt) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatCost(inputTokens: number, outputTokens: number): string {
  // Opus pricing: $15/M input, $75/M output
  const cost = (inputTokens * 15 + outputTokens * 75) / 1_000_000;
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

const ROLE_COLORS: Record<string, string> = {
  architect: '#64D2FF',
  builder: '#30D158',
  reviewer: '#BF5AF2',
  tester: '#FFD60A',
  documenter: '#5AC8FA',
};

export function InspectPanel({ agentId, agentLabel, agentRole, agentProjectPath, onClose }: InspectPanelProps) {
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [durationTick, setDurationTick] = useState(0);

  // Subscribe to live updates
  useEffect(() => {
    transport.postMessage({ type: 'subscribeAgent', id: agentId });

    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'inspectData' && msg.id === agentId) {
        const rawLines = msg.lines as string[];
        const parsed = rawLines
          .map(parseLine)
          .filter((p): p is ParsedLine => p !== null);
        setLines(parsed);
        setLoading(false);
        setMeta({
          slug: (msg.slug as string) || null,
          role: (msg.role as string) || null,
          gitBranch: (msg.gitBranch as string) || null,
          projectPath: (msg.projectPath as string) || '',
          inputTokens: (msg.inputTokens as number) || 0,
          outputTokens: (msg.outputTokens as number) || 0,
          cacheCreationTokens: (msg.cacheCreationTokens as number) || 0,
          cacheReadTokens: (msg.cacheReadTokens as number) || 0,
          startedAt: (msg.startedAt as number) || 0,
        });
      } else if (msg.type === 'inspectLine' && msg.id === agentId) {
        const parsed = parseLine(msg.line as string);
        if (parsed) {
          setLines((prev) => {
            const next = [...prev, parsed];
            // Keep last 200 lines
            return next.length > 200 ? next.slice(-200) : next;
          });
        }
      } else if (msg.type === 'agentLabelUpdate' && msg.id === agentId) {
        setMeta((prev) => prev ? { ...prev, slug: msg.slug as string } : prev);
      } else if (msg.type === 'agentRoleUpdate' && msg.id === agentId) {
        setMeta((prev) => prev ? { ...prev, role: msg.role as string } : prev);
      }
    });

    return () => {
      unsub();
      transport.postMessage({ type: 'unsubscribeAgent', id: agentId });
    };
  }, [agentId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Duration ticker
  useEffect(() => {
    const interval = setInterval(() => setDurationTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  const handleCopyTranscript = useCallback(() => {
    transport.postMessage({ type: 'getTranscript', id: agentId });
    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'transcript' && msg.id === agentId) {
        navigator.clipboard.writeText(msg.content as string).catch(() => {});
        unsub();
      }
    });
    // Auto-cleanup after 5s
    setTimeout(unsub, 5000);
  }, [agentId]);

  void durationTick; // used to trigger re-render

  const displayLabel = meta?.slug || agentLabel || `Agent #${agentId}`;
  const projectPath = meta?.projectPath || agentProjectPath || '';
  const projectName = agentLabel;
  const showProject = projectName && projectName !== displayLabel;
  const displayRole = meta?.role || agentRole;
  const roleColor = displayRole ? ROLE_COLORS[displayRole] || 'var(--text-secondary)' : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 100,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {displayLabel}
              </span>
              {projectPath ? (
                <span style={{ fontSize: 'var(--text-sm)', color: '#8E8E93', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1.5 2.5h5l2 2h6v9h-13z" stroke="#8E8E93" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                  </svg>
                  {projectPath}
                </span>
              ) : showProject && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {projectName}
                </span>
              )}
            </div>
            {displayRole && (
              <span
                style={{
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  color: roleColor,
                  background: `${roleColor}18`,
                  border: `1px solid ${roleColor}`,
                  padding: '2px 8px',
                  borderRadius: 12,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                  letterSpacing: '0.5px',
                }}
              >
                {displayRole}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
              minHeight: 32,
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--red)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
            }}
          >
            ×
          </button>
        </div>

        {/* Metadata row */}
        {meta && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}>
            {meta.gitBranch && (
              <span title="Git branch">
                <span style={{ color: '#30D158', fontWeight: 600, marginRight: 4 }}>branch</span>
                {meta.gitBranch}
              </span>
            )}
            {meta.startedAt > 0 && (
              <span title="Running time">
                <span style={{ color: '#FFD60A', fontWeight: 600, marginRight: 4 }}>time</span>
                {formatDuration(meta.startedAt)}
              </span>
            )}
          </div>
        )}

        {/* Token stats row */}
        {meta && (meta.inputTokens > 0 || meta.outputTokens > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 6, fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' }}>
            <span>
              <span style={{ color: '#64D2FF', fontWeight: 600, marginRight: 4 }}>in</span>
              {formatTokens(meta.inputTokens)}
            </span>
            <span>
              <span style={{ color: '#30D158', fontWeight: 600, marginRight: 4 }}>out</span>
              {formatTokens(meta.outputTokens)}
            </span>
            <span>
              <span style={{ color: '#BF5AF2', fontWeight: 600, marginRight: 4 }}>cost</span>
              {formatCost(meta.inputTokens, meta.outputTokens)}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={handleCopyTranscript}
            style={{
              background: 'var(--btn-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px 14px',
              fontSize: 'var(--text-base)',
              minHeight: 32,
              borderRadius: 'var(--radius-sm)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--btn-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--btn-bg)';
            }}
          >
            Copy Transcript
          </button>
        </div>
      </div>

      {/* Content - scrollable activity log */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 14px',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', padding: 16 }}>
            Loading...
          </div>
        ) : lines.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', padding: 16 }}>
            No activity data available.
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: typeColor(line.type),
                  flexShrink: 0,
                  minWidth: 36,
                  textAlign: 'center',
                  padding: '2px 6px',
                  background: `${typeColor(line.type)}18`,
                  border: `1px solid ${typeColor(line.type)}`,
                  borderRadius: 10,
                  lineHeight: '14px',
                  letterSpacing: '0.5px',
                }}
              >
                {typeLabel(line.type)}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word',
                  lineHeight: '20px',
                }}
              >
                {line.summary}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Scroll lock indicator */}
      {!autoScroll && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            right: 24,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: '6px 14px',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            zIndex: 101,
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--radius-md)',
            transition: 'background 0.15s ease',
          }}
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
        >
          Scroll locked - click to resume
        </div>
      )}
    </div>
  );
}
