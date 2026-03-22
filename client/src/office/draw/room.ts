// ── Room drawing: floor, walls, window ─────────────────────────

import { TILE_SIZE } from '../../constants.js';
import {
  FLOOR_DARK,
  FLOOR_WOOD_1,
  FLOOR_WOOD_2,
  SKY_DAY,
  SKY_NIGHT,
  SKY_SUNSET,
  WALL_ACCENT,
  WALL_BASE,
  WALL_BASEBOARD,
  WINDOW_FRAME,
} from './palette.js';

/** Draw a wood-grain floor tile at (x, y) in screen coordinates */
export function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  col: number,
  row: number,
): void {
  const s = TILE_SIZE * zoom;

  // Base color with subtle checkerboard variation
  const isLight = (col + row) % 2 === 0;
  ctx.fillStyle = isLight ? FLOOR_WOOD_1 : FLOOR_WOOD_2;
  ctx.fillRect(x, y, s, s);

  // Subtle wood grain lines
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = FLOOR_DARK;
  ctx.lineWidth = Math.max(0.5, zoom * 0.3);
  const grainCount = 3;
  for (let i = 0; i < grainCount; i++) {
    const gy = y + (s / (grainCount + 1)) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(x, gy);
    // Slight wave for natural wood grain
    const mid = x + s / 2;
    const offset = ((col * 7 + row * 13 + i * 3) % 5 - 2) * zoom * 0.5;
    ctx.quadraticCurveTo(mid, gy + offset, x + s, gy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw a wall tile at (x, y) in screen coordinates */
export function drawWallTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  _col: number,
  row: number,
): void {
  const s = TILE_SIZE * zoom;

  // Wall base
  ctx.fillStyle = WALL_BASE;
  ctx.fillRect(x, y, s, s);

  // Baseboard at bottom of wall tiles (when next tile below is floor)
  const baseboardH = Math.max(2, zoom * 2);
  ctx.fillStyle = WALL_BASEBOARD;
  ctx.fillRect(x, y + s - baseboardH, s, baseboardH);

  // Subtle wall texture
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = WALL_ACCENT;
  // Brick-like pattern
  const brickH = s / 3;
  for (let i = 0; i < 3; i++) {
    const by = y + i * brickH;
    const offset = (i + row) % 2 === 0 ? 0 : s / 2;
    ctx.fillRect(x + offset, by, s / 2, brickH - zoom * 0.5);
  }
  ctx.restore();
}

/** Draw a window on the wall showing time-of-day sky */
export function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  width: number,
  height: number,
): void {
  const w = width * zoom;
  const h = height * zoom;

  // Window frame
  ctx.fillStyle = WINDOW_FRAME;
  ctx.fillRect(x, y, w, h);

  // Glass area (inset)
  const inset = Math.max(1, zoom * 0.8);
  const glassX = x + inset;
  const glassY = y + inset;
  const glassW = w - inset * 2;
  const glassH = h - inset * 2;

  // Sky gradient based on time of day
  const hour = new Date().getHours();
  let topColor: string;
  let bottomColor: string;
  if (hour >= 6 && hour < 17) {
    topColor = SKY_DAY;
    bottomColor = '#C9E8F7';
  } else if (hour >= 17 && hour < 20) {
    topColor = SKY_SUNSET;
    bottomColor = '#FFB88C';
  } else {
    topColor = SKY_NIGHT;
    bottomColor = '#2D2D4E';
  }

  const grad = ctx.createLinearGradient(glassX, glassY, glassX, glassY + glassH);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(glassX, glassY, glassW, glassH);

  // Cross divider
  ctx.strokeStyle = WINDOW_FRAME;
  ctx.lineWidth = Math.max(1, zoom * 0.5);
  ctx.beginPath();
  ctx.moveTo(glassX + glassW / 2, glassY);
  ctx.lineTo(glassX + glassW / 2, glassY + glassH);
  ctx.moveTo(glassX, glassY + glassH / 2);
  ctx.lineTo(glassX + glassW, glassY + glassH / 2);
  ctx.stroke();
}
