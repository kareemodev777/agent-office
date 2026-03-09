import { useEffect, useState } from 'react';

import { CHARACTER_SITTING_OFFSET_PX, TOOL_OVERLAY_VERTICAL_OFFSET } from '../../constants.js';
import type { AgentInfo, SubagentCharacter } from '../../hooks/useExtensionMessages.js';
import type { OfficeState } from '../engine/officeState.js';
import type { ToolActivity } from '../types.js';
import { CharacterState, TILE_SIZE } from '../types.js';

interface ToolOverlayProps {
  officeState: OfficeState;
  agents: number[];
  agentTools: Record<number, ToolActivity[]>;
  agentInfos: Record<number, AgentInfo>;
  subagentCharacters: SubagentCharacter[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  panRef: React.RefObject<{ x: number; y: number }>;
  onCloseAgent: (id: number) => void;
  stuckAgents: Set<number>;
  textPreviews?: Record<number, { text: string; timestamp: number }>;
}

const ROLE_COLORS: Record<string, string> = {
  architect: '#7ec8e3',
  builder: '#a8d8a8',
  reviewer: '#c8a8e8',
  tester: '#e8c87e',
  documenter: '#8ee8d8',
};

/** Derive a short human-readable activity string from tools/status */
function getActivityText(
  agentId: number,
  agentTools: Record<number, ToolActivity[]>,
  isActive: boolean,
): string {
  const tools = agentTools[agentId];
  if (tools && tools.length > 0) {
    const activeTool = [...tools].reverse().find((t) => !t.done);
    if (activeTool) {
      if (activeTool.permissionWait) return 'Needs approval';
      return activeTool.status;
    }
    if (isActive) {
      const lastTool = tools[tools.length - 1];
      if (lastTool) return lastTool.status;
    }
  }
  return 'Idle';
}

export function ToolOverlay({
  officeState,
  agents,
  agentTools,
  agentInfos,
  subagentCharacters,
  containerRef,
  zoom,
  panRef,
  onCloseAgent,
  stuckAgents,
  textPreviews,
}: ToolOverlayProps) {
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

  const selectedId = officeState.selectedAgentId;
  const hoveredId = officeState.hoveredAgentId;

  const allIds = [...agents, ...subagentCharacters.map((s) => s.id)];

  return (
    <>
      {allIds.map((id) => {
        const ch = officeState.characters.get(id);
        if (!ch) return null;

        const isSelected = selectedId === id;
        const isHovered = hoveredId === id;
        const isSub = ch.isSubagent;
        const isStuck = stuckAgents.has(id);

        if (!isSelected && !isHovered) return null;

        const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
        const screenX = (deviceOffsetX + ch.x * zoom) / dpr;
        const screenY =
          (deviceOffsetY + (ch.y + sittingOffset - TOOL_OVERLAY_VERTICAL_OFFSET) * zoom) / dpr;

        const subHasPermission = isSub && ch.bubbleType === 'permission';
        let activityText: string;
        if (isSub) {
          if (subHasPermission) {
            activityText = 'Needs approval';
          } else {
            const sub = subagentCharacters.find((s) => s.id === id);
            activityText = sub ? sub.label : 'Subtask';
          }
        } else {
          activityText = getActivityText(id, agentTools, ch.isActive);
        }

        const tools = agentTools[id];
        const hasPermission = subHasPermission || tools?.some((t) => t.permissionWait && !t.done);
        const hasActiveTools = tools?.some((t) => !t.done);
        const isActive = ch.isActive;

        let dotColor: string | null = null;
        if (hasPermission) {
          dotColor = 'var(--pixel-status-permission)';
        } else if (isActive && hasActiveTools) {
          dotColor = 'var(--pixel-status-active)';
        }

        const info = agentInfos[id];
        const role = info?.role;
        const roleColor = role ? ROLE_COLORS[role] : undefined;
        const displayLabel = info?.slug || info?.label;

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY - 24,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              pointerEvents: isSelected ? 'auto' : 'none',
              zIndex: isSelected ? 'var(--pixel-overlay-selected-z)' : 'var(--pixel-overlay-z)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--pixel-bg)',
                border: isSelected
                  ? '2px solid var(--pixel-border-light)'
                  : '2px solid var(--pixel-border)',
                borderRadius: 4,
                padding: isSelected ? '6px 8px 6px 10px' : '6px 10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4), var(--pixel-shadow)',
                whiteSpace: 'nowrap',
                maxWidth: 280,
              }}
            >
              {dotColor && (
                <span
                  className={isActive && !hasPermission ? 'pixel-agents-pulse' : undefined}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
              )}
              {isStuck && (
                <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--pixel-font)', color: '#e8c87e', flexShrink: 0 }} title="Agent may be stuck">
                  Stuck?
                </span>
              )}
              <div style={{ overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: isSub ? 'var(--pxfont-sm)' : 'var(--pxfont-base)',
                    fontFamily: 'var(--system-font)',
                    fontStyle: isSub ? 'italic' : undefined,
                    color: 'var(--pixel-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                    fontWeight: 'bold',
                  }}
                >
                  {activityText}
                </span>
                {!isSub && textPreviews?.[id] && (Date.now() - textPreviews[id].timestamp < 5000) && (
                  <span
                    style={{
                      fontSize: 'var(--text-base)',
                      fontFamily: 'var(--system-font)',
                      color: 'var(--pixel-text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      opacity: Math.max(0, 1 - (Date.now() - textPreviews[id].timestamp) / 5000),
                    }}
                  >
                    {textPreviews[id].text}
                  </span>
                )}
                {!isSub && displayLabel && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontFamily: 'var(--system-font)',
                        color: 'var(--pixel-text-dim)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {displayLabel}
                    </span>
                    {role && roleColor && (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--pixel-font)',
                          color: roleColor,
                          background: `${roleColor}18`,
                          border: `1px solid ${roleColor}`,
                          padding: '1px 6px',
                          borderRadius: 8,
                          textTransform: 'uppercase',
                          lineHeight: '16px',
                          flexShrink: 0,
                          letterSpacing: '0.5px',
                        }}
                      >
                        {role}
                      </span>
                    )}
                  </div>
                )}
                {isSub && ch.folderName && (
                  <span
                    style={{
                      fontSize: 'var(--text-base)',
                      fontFamily: 'var(--system-font)',
                      color: 'var(--pixel-text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'block',
                    }}
                  >
                    {ch.folderName}
                  </span>
                )}
              </div>
              {isSelected && !isSub && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseAgent(id);
                  }}
                  title="Close agent"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--pixel-close-text)',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    fontSize: 'var(--pxfont-base)',
                    fontFamily: 'var(--system-font)',
                    lineHeight: 1,
                    marginLeft: 2,
                    flexShrink: 0,
                    minHeight: 32,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--pixel-close-text)';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
