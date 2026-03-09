import { useEffect, useState } from 'react';

import { CHARACTER_SITTING_OFFSET_PX } from '../../constants.js';
import type { OfficeState } from '../engine/officeState.js';
import { CharacterState, TILE_SIZE } from '../types.js';

const ROLE_COLORS: Record<string, string> = {
  architect: '#7ec8e3',
  builder: '#a8d8a8',
  reviewer: '#c8a8e8',
  tester: '#e8c87e',
  documenter: '#8ee8d8',
};

interface ConnectionLinesProps {
  officeState: OfficeState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  panRef: React.RefObject<{ x: number; y: number }>;
  agentInfos: Record<number, { role: string | null }>;
}

export function ConnectionLines({
  officeState,
  containerRef,
  zoom,
  panRef,
  agentInfos,
}: ConnectionLinesProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      setTick((n) => n + 1);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const el = containerRef.current;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const canvasW = Math.round(rect.width * dpr);
  const canvasH = Math.round(rect.height * dpr);
  const layout = officeState.getLayout();
  const mapW = layout.cols * TILE_SIZE * zoom;
  const mapH = layout.rows * TILE_SIZE * zoom;
  const deviceOffsetX = Math.floor((canvasW - mapW) / 2) + Math.round(panRef.current.x);
  const deviceOffsetY = Math.floor((canvasH - mapH) / 2) + Math.round(panRef.current.y);

  const lines: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
  }> = [];

  for (const [subId, meta] of officeState.subagentMeta) {
    const parentCh = officeState.characters.get(meta.parentAgentId);
    const childCh = officeState.characters.get(subId);
    if (!parentCh || !childCh) continue;
    if (parentCh.matrixEffect === 'despawn' || childCh.matrixEffect === 'despawn') continue;

    const parentSitOffset = parentCh.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const childSitOffset = childCh.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;

    const x1 = (deviceOffsetX + parentCh.x * zoom) / dpr;
    const y1 = (deviceOffsetY + (parentCh.y + parentSitOffset - 12) * zoom) / dpr;
    const x2 = (deviceOffsetX + childCh.x * zoom) / dpr;
    const y2 = (deviceOffsetY + (childCh.y + childSitOffset - 12) * zoom) / dpr;

    const parentInfo = agentInfos[meta.parentAgentId];
    const role = parentInfo?.role;
    const color = (role && ROLE_COLORS[role]) || '#5a8cff';

    lines.push({ x1, y1, x2, y2, color });
  }

  if (lines.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      <defs>
        <style>
          {`
            @keyframes dash-march {
              to { stroke-dashoffset: -12; }
            }
          `}
        </style>
      </defs>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.color}
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          style={{ animation: 'dash-march 0.8s linear infinite' }}
        />
      ))}
    </svg>
  );
}
