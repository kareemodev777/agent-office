import { useEffect, useRef } from 'react';

import type { AgentInfo } from '../hooks/useExtensionMessages.js';
import type { OfficeState } from '../office/engine/officeState.js';
import { CharacterState, TILE_SIZE } from '../office/types.js';

interface MinimapProps {
  officeState: OfficeState;
  agents: number[];
  agentInfos: Record<number, AgentInfo>;
  zoom: number;
  panRef: React.RefObject<{ x: number; y: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCenterAgent: (agentId: number) => void;
}

const MINIMAP_W = 120;
const MINIMAP_H = 80;
const DOT_SIZE = 4;

const ROLE_COLORS: Record<string, string> = {
  architect: '#7ec8e3',
  builder: '#a8d8a8',
  reviewer: '#c8a8e8',
  tester: '#e8c87e',
  documenter: '#8ee8d8',
};

export function Minimap({
  officeState,
  agents,
  agentInfos,
  zoom,
  panRef,
  containerRef,
  onCenterAgent,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const layout = officeState.getLayout();
      const mapW = layout.cols * TILE_SIZE;
      const mapH = layout.rows * TILE_SIZE;
      const scaleX = MINIMAP_W / mapW;
      const scaleY = MINIMAP_H / mapH;
      const scale = Math.min(scaleX, scaleY);

      ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

      // Background
      ctx.fillStyle = 'rgba(30, 30, 46, 0.85)';
      ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

      // Draw floor tiles as colored area
      const tileMap = officeState.tileMap;
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          const tile = tileMap[r]?.[c];
          if (tile !== undefined && tile > 0) {
            ctx.fillStyle = 'rgba(60, 60, 80, 0.6)';
            ctx.fillRect(c * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
          }
        }
      }

      // Draw agents as colored dots
      const now = Date.now();
      for (const id of agents) {
        const ch = officeState.characters.get(id);
        if (!ch) continue;
        const info = agentInfos[id];
        const role = info?.role;
        const color = (role && ROLE_COLORS[role]) || '#5a8cff';

        const x = ch.x * scale;
        const y = ch.y * scale;

        const isActive = ch.state === CharacterState.TYPE;
        const pulse = isActive ? 0.6 + 0.4 * Math.sin(now / 400) : 0.4;

        ctx.globalAlpha = pulse;
        ctx.fillStyle = color;
        ctx.fillRect(x - DOT_SIZE / 2, y - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
      }
      ctx.globalAlpha = 1;

      // Draw viewport rectangle
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const canvasW = rect.width * dpr;
        const canvasH = rect.height * dpr;
        const deviceMapW = mapW * zoom;
        const deviceMapH = mapH * zoom;
        const deviceOffsetX = (canvasW - deviceMapW) / 2 + panRef.current.x;
        const deviceOffsetY = (canvasH - deviceMapH) / 2 + panRef.current.y;

        // Visible world rect
        const worldLeft = -deviceOffsetX / zoom;
        const worldTop = -deviceOffsetY / zoom;
        const worldW = canvasW / zoom;
        const worldH = canvasH / zoom;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          worldLeft * scale,
          worldTop * scale,
          worldW * scale,
          worldH * scale,
        );
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [officeState, agents, agentInfos, zoom, panRef, containerRef]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const layout = officeState.getLayout();
    const mapW = layout.cols * TILE_SIZE;
    const mapH = layout.rows * TILE_SIZE;
    const scale = Math.min(MINIMAP_W / mapW, MINIMAP_H / mapH);

    // Find closest agent to click
    let closestId: number | null = null;
    let closestDist = Infinity;
    for (const id of agents) {
      const ch = officeState.characters.get(id);
      if (!ch) continue;
      const ax = ch.x * scale;
      const ay = ch.y * scale;
      const dist = Math.hypot(ax - x, ay - y);
      if (dist < closestDist && dist < 12) {
        closestDist = dist;
        closestId = id;
      }
    }
    if (closestId !== null) {
      onCenterAgent(closestId);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 50,
        right: 10,
        zIndex: 'var(--pixel-controls-z)',
        border: '2px solid var(--pixel-border)',
        boxShadow: 'var(--pixel-shadow)',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        onClick={handleClick}
        style={{ display: 'block', width: MINIMAP_W, height: MINIMAP_H }}
      />
    </div>
  );
}
