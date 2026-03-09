import { useEffect, useState, useCallback } from 'react';
import { transport } from '../transport.js';

interface InspectPanelProps {
  agentId: number;
  onClose: () => void;
}

interface ParsedLine {
  type: string;
  summary: string;
  timestamp?: string;
}

function parseLine(raw: string): ParsedLine | null {
  try {
    const obj = JSON.parse(raw);

    // Extract timestamp
    const timestamp = obj.timestamp || obj.ts || obj.created_at || undefined;

    // Determine type and summary
    if (obj.type === 'assistant' || obj.role === 'assistant') {
      const text = obj.message?.content || obj.content || '';
      const preview = typeof text === 'string'
        ? text.slice(0, 100)
        : Array.isArray(text)
          ? text.map((b: any) => (typeof b === 'string' ? b : b.text || '')).join(' ').slice(0, 100)
          : '';
      return { type: 'assistant', summary: preview || '(thinking)', timestamp };
    }

    if (obj.type === 'user' || obj.role === 'user') {
      const text = obj.message?.content || obj.content || '';
      const preview = typeof text === 'string' ? text.slice(0, 100) : String(text).slice(0, 100);
      return { type: 'user', summary: preview || '(input)', timestamp };
    }

    if (obj.type === 'tool_use' || obj.type === 'tool_result') {
      const name = obj.name || obj.tool_name || obj.type;
      const input = obj.input ? JSON.stringify(obj.input).slice(0, 80) : '';
      return { type: 'tool', summary: `${name}${input ? ': ' + input : ''}`, timestamp };
    }

    // Content block types
    if (obj.type === 'content_block_start' || obj.type === 'content_block_delta') {
      const block = obj.content_block || obj.delta || {};
      if (block.type === 'tool_use') {
        return { type: 'tool', summary: `Tool: ${block.name || 'unknown'}`, timestamp };
      }
      if (block.type === 'text' || block.text) {
        const text = block.text || '';
        return { type: 'assistant', summary: text.slice(0, 100) || '...', timestamp };
      }
    }

    // Fallback: show the type field if present
    if (obj.type) {
      return { type: obj.type, summary: obj.type, timestamp };
    }

    return { type: 'unknown', summary: raw.slice(0, 80), timestamp };
  } catch {
    return { type: 'raw', summary: raw.slice(0, 80) };
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'user': return '#7ec8e3';
    case 'assistant': return '#a8d8a8';
    case 'tool': return '#e8c87e';
    default: return 'var(--pixel-text-dim)';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'user': return 'USR';
    case 'assistant': return 'AST';
    case 'tool': return 'TUL';
    default: return type.slice(0, 3).toUpperCase();
  }
}

export function InspectPanel({ agentId, onClose }: InspectPanelProps) {
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [loading, setLoading] = useState(true);

  const requestInspect = useCallback(() => {
    setLoading(true);
    transport.postMessage({ type: 'inspectAgent', id: agentId });
  }, [agentId]);

  useEffect(() => {
    requestInspect();

    const unsub = transport.onMessage((msg: any) => {
      if (msg.type === 'inspectData' && msg.id === agentId) {
        const rawLines = msg.lines as string[];
        const parsed = rawLines
          .map(parseLine)
          .filter((p): p is ParsedLine => p !== null);
        setLines(parsed);
        setLoading(false);
      }
    });

    return unsub;
  }, [agentId, requestInspect]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 340,
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '2px solid var(--pixel-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '22px', color: 'var(--pixel-text)' }}>
          Agent #{agentId} Activity
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={requestInspect}
            title="Refresh"
            style={{
              background: 'none',
              border: '1px solid var(--pixel-border)',
              color: 'var(--pixel-text-dim)',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '18px',
            }}
          >
            Refresh
          </button>
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
      </div>

      {/* Content */}
      <div
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
                padding: '4px 0',
                borderBottom: '1px solid var(--pixel-border)',
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: typeColor(line.type),
                  flexShrink: 0,
                  minWidth: 28,
                  textAlign: 'center',
                  padding: '1px 3px',
                  border: `1px solid ${typeColor(line.type)}`,
                  borderRadius: 2,
                  lineHeight: '16px',
                }}
              >
                {typeLabel(line.type)}
              </span>
              <span
                style={{
                  fontSize: '16px',
                  color: 'var(--pixel-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-word',
                  lineHeight: '18px',
                }}
              >
                {line.summary}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
