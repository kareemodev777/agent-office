import { useEffect, useState, useCallback, useRef } from 'react';
import { transport } from '../transport.js';

interface InspectPanelProps {
  agentId: number;
  agentLabel?: string;
  agentRole?: string | null;
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
      let preview = '';
      let toolName: string | undefined;

      if (Array.isArray(content)) {
        const textBlocks: string[] = [];
        for (const b of content) {
          if (b.type === 'text' && b.text) textBlocks.push(b.text);
          if (b.type === 'tool_use') toolName = b.name;
        }
        if (toolName) {
          return { type: 'tool', summary: `${toolName}`, timestamp, toolName };
        }
        preview = textBlocks.join(' ').slice(0, 120);
      } else if (typeof content === 'string') {
        preview = content.slice(0, 120);
      }
      return { type: 'assistant', summary: preview || '(thinking)', timestamp };
    }

    if (obj.type === 'user' || obj.role === 'user') {
      const content = obj.message?.content || obj.content || '';
      if (Array.isArray(content)) {
        const hasToolResult = content.some((b: { type: string }) => b.type === 'tool_result');
        if (hasToolResult) return null; // Skip tool results in display
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

    // Skip other system/progress records
    if (obj.type === 'system' || obj.type === 'progress') return null;

    return null;
  } catch {
    return null;
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'user': return '#7ec8e3';
    case 'assistant': return '#a8d8a8';
    case 'tool': return '#e8c87e';
    case 'system': return '#888';
    default: return 'var(--pixel-text-dim)';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'user': return 'USR';
    case 'assistant': return 'AST';
    case 'tool': return 'TUL';
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
  architect: '#7ec8e3',
  builder: '#a8d8a8',
  reviewer: '#c8a8e8',
  tester: '#e8c87e',
  documenter: '#8ee8d8',
};

export function InspectPanel({ agentId, agentLabel, agentRole, onClose }: InspectPanelProps) {
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
  const displayRole = meta?.role || agentRole;
  const roleColor = displayRole ? ROLE_COLORS[displayRole] || 'var(--pixel-text-dim)' : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 100,
        background: 'var(--pixel-bg)',
        borderLeft: '2px solid var(--pixel-border)',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '2px solid var(--pixel-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: '22px', color: 'var(--pixel-text)', fontWeight: 'bold' }}>
              {displayLabel}
            </span>
            {displayRole && (
              <span
                style={{
                  fontSize: '14px',
                  color: roleColor,
                  border: `1px solid ${roleColor}`,
                  padding: '1px 5px',
                  borderRadius: 2,
                  textTransform: 'uppercase',
                  flexShrink: 0,
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
              color: 'var(--pixel-close-text)',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: '28px',
              lineHeight: 1,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-text)';
            }}
          >
            x
          </button>
        </div>

        {/* Metadata row */}
        {meta && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: '16px', color: 'var(--pixel-text-dim)' }}>
            {meta.gitBranch && (
              <span title="Git branch">
                <span style={{ color: '#a8d8a8' }}>branch:</span> {meta.gitBranch}
              </span>
            )}
            {meta.startedAt > 0 && (
              <span title="Running time">
                <span style={{ color: '#e8c87e' }}>time:</span> {formatDuration(meta.startedAt)}
              </span>
            )}
          </div>
        )}

        {/* Token stats row */}
        {meta && (meta.inputTokens > 0 || meta.outputTokens > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2, fontSize: '16px', color: 'var(--pixel-text-dim)' }}>
            <span>
              <span style={{ color: '#7ec8e3' }}>in:</span> {formatTokens(meta.inputTokens)}
            </span>
            <span>
              <span style={{ color: '#a8d8a8' }}>out:</span> {formatTokens(meta.outputTokens)}
            </span>
            <span>
              <span style={{ color: '#e8c87e' }}>cost:</span> {formatCost(meta.inputTokens, meta.outputTokens)}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            onClick={handleCopyTranscript}
            style={{
              background: 'var(--pixel-btn-bg)',
              border: '1px solid var(--pixel-border)',
              color: 'var(--pixel-text-dim)',
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: '16px',
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
          padding: '6px 10px',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--pixel-text-dim)', fontSize: '20px', padding: 12 }}>
            Loading...
          </div>
        ) : lines.length === 0 ? (
          <div style={{ color: 'var(--pixel-text-dim)', fontSize: '20px', padding: 12 }}>
            No activity data available.
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              style={{
                padding: '3px 0',
                borderBottom: '1px solid var(--pixel-border)',
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: typeColor(line.type),
                  flexShrink: 0,
                  minWidth: 28,
                  textAlign: 'center',
                  padding: '1px 3px',
                  border: `1px solid ${typeColor(line.type)}`,
                  borderRadius: 2,
                  lineHeight: '14px',
                }}
              >
                {typeLabel(line.type)}
              </span>
              <span
                style={{
                  fontSize: '15px',
                  color: 'var(--pixel-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word',
                  lineHeight: '17px',
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
            bottom: 8,
            right: 20,
            background: 'var(--pixel-bg)',
            border: '1px solid var(--pixel-border)',
            padding: '2px 8px',
            fontSize: '14px',
            color: 'var(--pixel-text-dim)',
            cursor: 'pointer',
            zIndex: 101,
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
