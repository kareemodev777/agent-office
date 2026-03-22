// ── Character drawing system ──────────────────────────────────
// Chibi/cartoon style characters drawn with Canvas 2D paths.
// Big head (~60% of height), small body, role-based clothing.
// Cached to offscreen canvases per (role, palette, state, dir, frame, zoom).

import type { Character } from '../types.js';
import { CharacterState, Direction } from '../types.js';
import { isReadingTool } from '../engine/characters.js';
import {
  getRoleColors,
  HAIR_COLORS,
  SKIN_TONES,
  STUCK_EXCLAIM,
  type RoleColors,
} from './palette.js';

// ── Character dimensions (logical units, pre-zoom) ──
export const CHAR_W = 24;
export const CHAR_H = 36;

// ── Offscreen canvas cache ──
// Map<zoom, Map<cacheKey, HTMLCanvasElement>>
const cache = new Map<number, Map<string, HTMLCanvasElement>>();

/** Clear all cached character canvases (call on zoom change if memory is a concern) */
export function clearCharacterCache(): void {
  cache.clear();
}

/** Get a cached offscreen canvas with the character drawn. */
export function getDrawnCharacterCanvas(
  ch: Character,
  zoom: number,
  role = 'unknown',
): HTMLCanvasElement {
  const reading = ch.state === CharacterState.TYPE && isReadingTool(ch.currentTool);
  const stateKey = reading ? 'read' : ch.state;
  const key = `${role}-${ch.palette}-${stateKey}-${ch.dir}-${ch.frame}-${ch.isActive ? 1 : 0}`;

  let zoomCache = cache.get(zoom);
  if (!zoomCache) {
    zoomCache = new Map();
    cache.set(zoom, zoomCache);
  }

  let canvas = zoomCache.get(key);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  canvas.width = CHAR_W * zoom;
  canvas.height = CHAR_H * zoom;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(zoom, zoom);

  const skin = SKIN_TONES[ch.palette % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[ch.palette % HAIR_COLORS.length];
  const roleColors = getRoleColors(role);
  const hairStyle = ch.palette % 5;

  drawCharacterInternal(ctx, ch.state, ch.dir, ch.frame, reading, ch.isActive, skin, hairColor, hairStyle, roleColors, role);

  zoomCache.set(key, canvas);
  return canvas;
}

// ── Internal drawing ──

interface SkinColors {
  skin: string;
  skinDark: string;
  skinLight: string;
}

function drawCharacterInternal(
  ctx: CanvasRenderingContext2D,
  state: string,
  dir: number,
  frame: number,
  isReading: boolean,
  isActive: boolean,
  skin: SkinColors,
  hairColor: string,
  hairStyle: number,
  roleColors: RoleColors,
  role: string,
): void {
  const cx = CHAR_W / 2; // 12
  const headCy = 12;
  const headR = 9;

  // ── Shadow under character ──
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, CHAR_H - 1, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const isSitting = state === CharacterState.TYPE || state === 'meeting' || state === 'read';
  const isWalking = state === CharacterState.WALK;
  const isStuck = state === 'stuck';
  const isCelebrating = state === 'celebrating';
  const isThinking = state === 'thinking';

  // ── Body + Legs ──
  drawBody(ctx, cx, dir, state, frame, isSitting, isWalking, isCelebrating, isThinking, isReading, roleColors, skin);

  // ── Head ──
  drawHead(ctx, cx, headCy, headR, dir, skin);

  // ── Hair ──
  drawHair(ctx, cx, headCy, headR, dir, hairColor, hairStyle);

  // ── Face ──
  if (dir !== Direction.UP) {
    drawFace(ctx, cx, headCy, dir, isStuck);
  }

  // ── Role Accessory ──
  drawAccessory(ctx, cx, headCy, headR, dir, role, roleColors);

  // ── Stuck indicator ──
  if (isStuck) {
    drawStuckIndicator(ctx, cx);
  }

  // ── Thinking bubble ──
  if (isThinking) {
    drawThinkingBubble(ctx, cx);
  }

  // ── Active glow indicator (subtle) ──
  if (isActive && !isStuck) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    const glow = ctx.createRadialGradient(cx, CHAR_H / 2, 0, cx, CHAR_H / 2, CHAR_W / 2);
    glow.addColorStop(0, roleColors.accent);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CHAR_W, CHAR_H);
    ctx.restore();
  }
}

// ── Head ──

function drawHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dir: number,
  skin: SkinColors,
): void {
  ctx.fillStyle = skin.skin;
  if (dir === Direction.LEFT || dir === Direction.RIGHT) {
    // Slightly oval for profile
    ctx.beginPath();
    const ox = dir === Direction.LEFT ? -1 : 1;
    ctx.ellipse(cx + ox * 0.5, cy, r - 1, r, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ear
    ctx.fillStyle = skin.skinDark;
    const earX = dir === Direction.LEFT ? cx + r - 2 : cx - r + 2;
    ctx.beginPath();
    ctx.ellipse(earX, cy + 1, 1.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Front or back — round
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    if (dir === Direction.DOWN) {
      ctx.fillStyle = skin.skinDark;
      ctx.beginPath();
      ctx.ellipse(cx - r + 1, cy + 1, 1.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r - 1, cy + 1, 1.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Face (only when not facing UP) ──

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dir: number,
  isStuck: boolean,
): void {
  const eyeY = cy - 0.5;
  const eyeR = 1.2;

  if (dir === Direction.DOWN) {
    // Two eyes
    ctx.fillStyle = isStuck ? '#888' : '#1A1A2E';
    ctx.beginPath();
    ctx.arc(cx - 3, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 3, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights
    if (!isStuck) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(cx - 2.5, eyeY - 0.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 3.5, eyeY - 0.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = isStuck ? '#888' : '#4A3728';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (isStuck) {
      // Frown
      ctx.arc(cx, cy + 3.5, 1.5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    } else {
      // Smile
      ctx.arc(cx, cy + 1.5, 1.5, 0.3, Math.PI - 0.3);
    }
    ctx.stroke();

    // Blush
    if (!isStuck) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#F87171';
      ctx.beginPath();
      ctx.ellipse(cx - 4.5, cy + 1.5, 1.5, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 4.5, cy + 1.5, 1.5, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Profile (LEFT or RIGHT)
    const eyeX = dir === Direction.LEFT ? cx - 3 : cx + 3;
    ctx.fillStyle = isStuck ? '#888' : '#1A1A2E';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlight
    if (!isStuck) {
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(eyeX + (dir === Direction.LEFT ? 0.4 : -0.4), eyeY - 0.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = isStuck ? '#888' : '#4A3728';
    ctx.lineWidth = 0.6;
    const mouthX = dir === Direction.LEFT ? cx - 4 : cx + 4;
    ctx.beginPath();
    if (isStuck) {
      ctx.moveTo(mouthX - 0.8, cy + 2.5);
      ctx.lineTo(mouthX + 0.8, cy + 2.5);
    } else {
      ctx.arc(mouthX, cy + 1.5, 1, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();
  }
}

// ── Hair ──

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dir: number,
  color: string,
  style: number,
): void {
  ctx.fillStyle = color;

  switch (style) {
    case 0: // Short spiky
      drawHairSpiky(ctx, cx, cy, r, dir);
      break;
    case 1: // Medium parted
      drawHairParted(ctx, cx, cy, r, dir);
      break;
    case 2: // Long
      drawHairLong(ctx, cx, cy, r, dir);
      break;
    case 3: // Curly
      drawHairCurly(ctx, cx, cy, r, dir);
      break;
    case 4: // Buzz
    default:
      drawHairBuzz(ctx, cx, cy, r, dir);
      break;
  }
}

function drawHairSpiky(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, _dir: number): void {
  // Base hair cap
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Spikes
  const spikeCount = 5;
  for (let i = 0; i < spikeCount; i++) {
    const angle = Math.PI + (Math.PI / (spikeCount + 1)) * (i + 1);
    const bx = cx + Math.cos(angle) * (r - 1);
    const by = cy + Math.sin(angle) * (r - 1);
    const tx = cx + Math.cos(angle) * (r + 3);
    const ty = cy + Math.sin(angle) * (r + 3) - 1;
    ctx.beginPath();
    ctx.moveTo(bx - 1.5, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 1.5, by);
    ctx.fill();
  }
}

function drawHairParted(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number): void {
  // Full hair cap
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.8, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();
  // Side sweep
  if (dir === Direction.LEFT || dir === Direction.DOWN) {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r - 1, cy - 4, cx - 2, cy - r - 1);
    ctx.lineTo(cx - r + 2, cy);
    ctx.fill();
  }
  if (dir === Direction.RIGHT || dir === Direction.DOWN) {
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.quadraticCurveTo(cx + r + 1, cy - 4, cx + 2, cy - r - 1);
    ctx.lineTo(cx + r - 2, cy);
    ctx.fill();
  }
}

function drawHairLong(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number): void {
  // Hair cap
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.8, Math.PI * 0.8, Math.PI * 2.2);
  ctx.fill();
  // Long sides hanging down
  ctx.beginPath();
  ctx.moveTo(cx - r - 0.5, cy - 1);
  ctx.quadraticCurveTo(cx - r - 1, cy + r, cx - r + 1, cy + r + 4);
  ctx.lineTo(cx - r + 3, cy + 1);
  ctx.fill();
  if (dir !== Direction.LEFT) {
    ctx.beginPath();
    ctx.moveTo(cx + r + 0.5, cy - 1);
    ctx.quadraticCurveTo(cx + r + 1, cy + r, cx + r - 1, cy + r + 4);
    ctx.lineTo(cx + r - 3, cy + 1);
    ctx.fill();
  }
}

function drawHairCurly(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, _dir: number): void {
  // Bumpy outline around head
  const bumps = 8;
  for (let i = 0; i < bumps; i++) {
    const angle = Math.PI + (Math.PI / (bumps - 1)) * i;
    const bx = cx + Math.cos(angle) * (r + 0.5);
    const by = cy + Math.sin(angle) * (r + 0.5);
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fill center
  ctx.beginPath();
  ctx.arc(cx, cy - 1, r - 1, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawHairBuzz(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, _dir: number): void {
  // Thin layer on top of head
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.3, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
}

// ── Body ──

function drawBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  dir: number,
  state: string,
  frame: number,
  isSitting: boolean,
  isWalking: boolean,
  isCelebrating: boolean,
  isThinking: boolean,
  isReading: boolean,
  roleColors: RoleColors,
  skin: SkinColors,
): void {
  const bodyTop = 21;
  const bodyH = isSitting ? 8 : 9;
  const bodyW = 10;
  const legTop = bodyTop + bodyH;

  // ── Shirt/torso ──
  const shirtGrad = ctx.createLinearGradient(cx - bodyW / 2, bodyTop, cx - bodyW / 2, bodyTop + bodyH);
  shirtGrad.addColorStop(0, roleColors.shirt);
  shirtGrad.addColorStop(1, roleColors.shirtDark);
  ctx.fillStyle = shirtGrad;

  // Torso shape
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, bodyTop);
  ctx.lineTo(cx + bodyW / 2, bodyTop);
  ctx.lineTo(cx + bodyW / 2 + 1, bodyTop + bodyH);
  ctx.lineTo(cx - bodyW / 2 - 1, bodyTop + bodyH);
  ctx.closePath();
  ctx.fill();

  // ── Arms ──
  ctx.fillStyle = skin.skin;
  const armW = 2.5;

  if (isCelebrating) {
    // Arms raised!
    drawArm(ctx, cx - bodyW / 2 - armW, bodyTop - 4, armW, 8, skin.skin);
    drawArm(ctx, cx + bodyW / 2, bodyTop - 4, armW, 8, skin.skin);
    // Hands
    ctx.beginPath();
    ctx.arc(cx - bodyW / 2 - armW / 2, bodyTop - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + bodyW / 2 + armW / 2, bodyTop - 5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (isThinking) {
    // One arm on chin, other relaxed
    drawArm(ctx, cx - bodyW / 2 - armW, bodyTop + 1, armW, bodyH - 2, skin.skin);
    // Thinking arm (to chin)
    if (dir === Direction.DOWN || dir === Direction.RIGHT) {
      ctx.fillStyle = skin.skin;
      ctx.beginPath();
      ctx.moveTo(cx + bodyW / 2, bodyTop + 2);
      ctx.lineTo(cx + bodyW / 2 + armW, bodyTop + 2);
      ctx.lineTo(cx + 3, bodyTop - 6); // to chin
      ctx.lineTo(cx + 1, bodyTop - 4);
      ctx.fill();
    } else {
      drawArm(ctx, cx + bodyW / 2, bodyTop + 1, armW, bodyH - 2, skin.skin);
    }
  } else if (isSitting && !isReading) {
    // Typing — arms forward
    const armExtend = frame % 2 === 0 ? 2 : 1;
    ctx.fillStyle = skin.skin;
    // Left arm
    ctx.fillRect(cx - bodyW / 2 - 1, bodyTop + 3, armW, 3 + armExtend);
    // Right arm
    ctx.fillRect(cx + bodyW / 2 - 1, bodyTop + 3, armW, 3 + armExtend);
    // Hands
    ctx.beginPath();
    ctx.arc(cx - bodyW / 2 - 1 + armW / 2, bodyTop + 6 + armExtend, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + bodyW / 2 - 1 + armW / 2, bodyTop + 6 + armExtend, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (isReading) {
    // One hand on chin, leaned back
    drawArm(ctx, cx - bodyW / 2 - armW, bodyTop + 1, armW, bodyH - 2, skin.skin);
    ctx.fillStyle = skin.skin;
    // Hand on chin
    ctx.beginPath();
    ctx.moveTo(cx + bodyW / 2, bodyTop + 3);
    ctx.lineTo(cx + bodyW / 2 + 2, bodyTop + 1);
    ctx.lineTo(cx + 2, bodyTop - 4);
    ctx.fill();
  } else if (isWalking) {
    // Walking arms swing
    const swing = Math.sin((frame / 4) * Math.PI * 2) * 3;
    drawArm(ctx, cx - bodyW / 2 - armW, bodyTop + 1 - swing, armW, bodyH - 1, skin.skin);
    drawArm(ctx, cx + bodyW / 2, bodyTop + 1 + swing, armW, bodyH - 1, skin.skin);
  } else {
    // Idle — arms at sides
    drawArm(ctx, cx - bodyW / 2 - armW, bodyTop + 1, armW, bodyH - 1, skin.skin);
    drawArm(ctx, cx + bodyW / 2, bodyTop + 1, armW, bodyH - 1, skin.skin);
  }

  // ── Legs ──
  if (!isSitting) {
    const legW = 3;
    const legH = CHAR_H - legTop - 2;

    if (isWalking) {
      // Walking leg animation (4 frames)
      const legSwing = Math.sin((frame / 4) * Math.PI * 2) * 2;
      drawLeg(ctx, cx - 3, legTop + legSwing, legW, legH - legSwing, roleColors.shirtDark);
      drawLeg(ctx, cx + 0.5, legTop - legSwing, legW, legH + legSwing, roleColors.shirtDark);
    } else {
      // Standing
      drawLeg(ctx, cx - 3, legTop, legW, legH, roleColors.shirtDark);
      drawLeg(ctx, cx + 0.5, legTop, legW, legH, roleColors.shirtDark);
    }

    // Shoes
    ctx.fillStyle = '#2D2D3A';
    const shoeY = CHAR_H - 2;
    ctx.beginPath();
    ctx.ellipse(cx - 1.5, shoeY, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 2, shoeY, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Sitting — legs bent, visible from side
    ctx.fillStyle = roleColors.shirtDark;
    ctx.fillRect(cx - 4, legTop, 3, 3);
    ctx.fillRect(cx + 1, legTop, 3, 3);
    // Shoes peeking
    ctx.fillStyle = '#2D2D3A';
    ctx.beginPath();
    ctx.ellipse(cx - 2.5, legTop + 3.5, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 2.5, legTop + 3.5, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.quadraticCurveTo(x + w + 0.5, y + h / 2, x + w / 2, y + h);
  ctx.quadraticCurveTo(x - 0.5, y + h / 2, x + w / 2, y);
  ctx.fill();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// ── Accessories ──

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headCy: number,
  headR: number,
  dir: number,
  role: string,
  roleColors: RoleColors,
): void {
  switch (role) {
    case 'architect':
      drawGlasses(ctx, cx, headCy, dir, roleColors.accent);
      break;
    case 'builder':
      drawHeadphones(ctx, cx, headCy, headR, dir, roleColors.accent);
      break;
    case 'reviewer':
      drawPen(ctx, cx, headCy, headR, dir, roleColors.accent);
      break;
    case 'tester':
      drawMagnifyingGlass(ctx, cx, headCy, headR, dir, roleColors.accent);
      break;
    case 'documenter':
      drawNotebook(ctx, cx, dir, roleColors.accent);
      break;
  }
}

function drawGlasses(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  if (dir === Direction.DOWN) {
    // Two circles
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 0.5, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 3, cy - 0.5, 2, 0, Math.PI * 2);
    ctx.stroke();
    // Bridge
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 0.5);
    ctx.lineTo(cx + 1, cy - 0.5);
    ctx.stroke();
    // Temples
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 0.5);
    ctx.lineTo(cx - 7, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 0.5);
    ctx.lineTo(cx + 7, cy);
    ctx.stroke();
  } else if (dir === Direction.LEFT || dir === Direction.RIGHT) {
    const ex = dir === Direction.LEFT ? cx - 3 : cx + 3;
    ctx.beginPath();
    ctx.arc(ex, cy - 0.5, 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHeadphones(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;

  if (dir === Direction.DOWN || dir === Direction.UP) {
    // Band over head
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r - 1, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    // Ear cups
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx - r + 1, cy + 1, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r - 1, cy + 1, 2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Side view — one ear cup visible
    const side = dir === Direction.LEFT ? -1 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r - 1, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx + side * (r - 1), cy + 1, 2.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPen(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number, color: string): void {
  if (dir === Direction.UP) return;
  // Pen tucked behind ear
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  const earX = dir === Direction.LEFT ? cx + r - 2 : cx - r + 2;
  const startY = cy - 2;
  ctx.beginPath();
  ctx.moveTo(earX, startY);
  ctx.lineTo(earX + (dir === Direction.LEFT ? 2 : -2), startY - 5);
  ctx.stroke();
  // Pen tip
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(earX + (dir === Direction.LEFT ? 2 : -2), startY - 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagnifyingGlass(ctx: CanvasRenderingContext2D, _cx: number, _cy: number, _r: number, dir: number, color: string): void {
  if (dir === Direction.UP) return;
  // Small magnifying glass near body
  const mgX = dir === Direction.LEFT ? 3 : CHAR_W - 3;
  const mgY = 26;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(mgX, mgY, 2, 0, Math.PI * 2);
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(mgX + 1.4, mgY + 1.4);
  ctx.lineTo(mgX + 3, mgY + 3);
  ctx.stroke();
}

function drawNotebook(ctx: CanvasRenderingContext2D, cx: number, dir: number, color: string): void {
  if (dir === Direction.UP) return;
  // Notebook held at side
  const nbX = dir === Direction.LEFT ? cx + 5 : cx - 8;
  const nbY = 24;
  ctx.fillStyle = color;
  ctx.fillRect(nbX, nbY, 3, 4);
  // Pages
  ctx.fillStyle = '#FFF';
  ctx.fillRect(nbX + 0.3, nbY + 0.3, 2.4, 3.4);
  // Lines
  ctx.strokeStyle = '#CCC';
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(nbX + 0.6, nbY + 1 + i * 0.8);
    ctx.lineTo(nbX + 2.4, nbY + 1 + i * 0.8);
    ctx.stroke();
  }
}

// ── Status indicators ──

function drawStuckIndicator(ctx: CanvasRenderingContext2D, cx: number): void {
  // "!" above head
  ctx.fillStyle = STUCK_EXCLAIM;
  ctx.font = 'bold 6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', cx, 3);
}

function drawThinkingBubble(ctx: CanvasRenderingContext2D, cx: number): void {
  // Small thought dots + "..." bubble
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(cx + 6, 5, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8, 3, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Bubble
  ctx.beginPath();
  ctx.ellipse(cx + 11, 1, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dots
  ctx.fillStyle = '#666';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + 9 + i * 1.5, 1, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
