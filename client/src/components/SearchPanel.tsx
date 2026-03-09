import { useState, useCallback, useRef, useEffect } from 'react';

import { transport } from '../transport.js';

interface SearchResult {
  agentId: number;
  agentName: string;
  line: string;
  lineNumber: number;
  context: string;
}

interface SearchPanelProps {
  onClose: () => void;
  onInspect: (agentId: number) => void;
}

export function SearchPanel({ onClose, onInspect }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setTruncated(false);
      return;
    }
    setSearching(true);
    transport.postMessage({ type: 'searchTranscripts', query: q.trim() });

    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'searchResults') {
        setResults(msg.results as SearchResult[]);
        setTruncated(msg.truncated as boolean);
        setSearching(false);
        unsub();
      }
    });
    // Cleanup if no response in 5s
    setTimeout(() => { unsub(); setSearching(false); }, 5000);
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      doSearch(query);
    }
  }, [onClose, doSearch, query]);

  // Highlight matching text
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ background: 'rgba(90, 140, 255, 0.3)', color: '#fff' }}>
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  // Group results by agent
  const grouped = results.reduce<Record<number, { name: string; items: SearchResult[] }>>((acc, r) => {
    if (!acc[r.agentId]) acc[r.agentId] = { name: r.agentName, items: [] };
    acc[r.agentId].items.push(r);
    return acc;
  }, {});

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        maxHeight: '50%',
        zIndex: 200,
        background: 'var(--pixel-bg)',
        borderBottom: '2px solid var(--pixel-border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          gap: 8,
          borderBottom: '1px solid var(--pixel-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 'var(--text-base)', fontFamily: 'var(--pixel-font)', color: 'var(--pixel-text-dim)' }}>Search:</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search transcripts..."
          style={{
            flex: 1,
            background: 'var(--pixel-btn-bg)',
            border: '1px solid var(--pixel-border)',
            color: 'var(--pixel-text)',
            padding: '8px 12px',
            fontSize: 'var(--text-base)',
            fontFamily: 'var(--system-font)',
            outline: 'none',
            minHeight: 36,
          }}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--pixel-text-dim)',
            fontSize: 'var(--text-xl)',
            fontFamily: 'var(--system-font)',
            cursor: 'pointer',
            padding: '4px 8px',
            minHeight: 32,
          }}
        >
          ×
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {searching && (
          <div style={{ padding: 12, fontSize: 'var(--text-base)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)', textAlign: 'center' }}>
            Searching...
          </div>
        )}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div style={{ padding: 12, fontSize: 'var(--text-base)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)', textAlign: 'center' }}>
            No results found
          </div>
        )}

        {Object.entries(grouped).map(([agentIdStr, group]) => {
          const agentId = parseInt(agentIdStr, 10);
          return (
            <div key={agentId}>
              <div
                style={{
                  padding: '6px 14px',
                  fontSize: 'var(--text-base)',
                  fontFamily: 'var(--pixel-font)',
                  color: 'var(--pixel-accent)',
                  fontWeight: 'bold',
                  background: 'var(--pixel-btn-bg)',
                }}
              >
                {group.name} ({group.items.length} match{group.items.length !== 1 ? 'es' : ''})
              </div>
              {group.items.map((item, i) => (
                <button
                  key={`${agentId}-${item.lineNumber}-${i}`}
                  onClick={() => onInspect(agentId)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 14px 8px 28px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--pixel-border)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-base)',
                    fontFamily: 'var(--system-font)',
                    color: 'var(--pixel-text)',
                    minHeight: 36,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: 'var(--pixel-text-dim)', marginRight: 6 }}>L{item.lineNumber}</span>
                  {highlightMatch(item.line, query)}
                </button>
              ))}
            </div>
          );
        })}

        {truncated && (
          <div style={{ padding: 10, textAlign: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--system-font)', color: 'var(--pixel-text-dim)' }}>
            Results truncated to 50 — refine your search
          </div>
        )}
      </div>
    </div>
  );
}
