// ── Furniture drawing: meeting table, bookshelf, plants, coffee machine, whiteboard ──

import {
  BOOK_COLORS,
  COFFEE_MACHINE_ACCENT,
  COFFEE_MACHINE_BODY,
  COFFEE_MACHINE_TOP,
  MEETING_TABLE_EDGE,
  MEETING_TABLE_LEG,
  MEETING_TABLE_TOP,
  PLANT_GREENS,
  POT_BROWN,
  POT_DARK,
  SOIL_COLOR,
  WHITEBOARD_BG,
  WHITEBOARD_FRAME,
  WHITEBOARD_TEXT,
} from './palette.js';

// ── Meeting Table (2x2 tiles, 32x32 logical) ──

export function drawMeetingTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  // Table shadow
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(16, 18, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Table legs
  ctx.fillStyle = MEETING_TABLE_LEG;
  ctx.fillRect(6, 14, 1.5, 5);
  ctx.fillRect(24.5, 14, 1.5, 5);
  ctx.fillRect(6, 22, 1.5, 5);
  ctx.fillRect(24.5, 22, 1.5, 5);

  // Table surface (oval)
  const grad = ctx.createLinearGradient(2, 4, 2, 20);
  grad.addColorStop(0, MEETING_TABLE_TOP);
  grad.addColorStop(1, MEETING_TABLE_EDGE);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(16, 14, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Surface edge
  ctx.strokeStyle = MEETING_TABLE_EDGE;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(16, 14, 13, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle wood grain
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = MEETING_TABLE_LEG;
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 4; i++) {
    const gy = 10 + i * 2.5;
    ctx.beginPath();
    ctx.moveTo(6, gy);
    ctx.quadraticCurveTo(16, gy + (i % 2 ? 1 : -1), 26, gy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

// ── Bookshelf (1x2 tiles, 16x32 logical) ──

export function drawBookshelf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  const w = 16;
  const h = 32;

  // Shelf frame
  ctx.fillStyle = '#5C4830';
  ctx.fillRect(0, 0, w, h);

  // Inner back
  ctx.fillStyle = '#4A3825';
  ctx.fillRect(1, 1, w - 2, h - 2);

  // Shelves (4 levels)
  const shelfH = (h - 2) / 4;
  for (let shelf = 0; shelf < 4; shelf++) {
    const sy = 1 + shelf * shelfH;

    // Books on this shelf
    let bx = 2;
    const bookCount = 4 + (shelf % 2);
    for (let b = 0; b < bookCount && bx < w - 2; b++) {
      const bw = 1.5 + ((shelf * 3 + b * 7) % 3) * 0.3;
      const bh = shelfH - 1.5 - ((shelf + b) % 3) * 0.5;
      const colorIdx = (shelf * bookCount + b) % BOOK_COLORS.length;

      ctx.fillStyle = BOOK_COLORS[colorIdx];
      ctx.fillRect(bx, sy + shelfH - bh - 0.5, bw, bh);

      // Spine highlight
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#FFF';
      ctx.fillRect(bx + 0.2, sy + shelfH - bh, 0.3, bh - 1);
      ctx.restore();

      bx += bw + 0.3;
    }

    // Shelf board
    ctx.fillStyle = '#6B5840';
    ctx.fillRect(1, sy + shelfH - 0.5, w - 2, 1);
  }

  ctx.restore();
}

// ── Potted Plant (1x1 tile, 16x16 logical) ──

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  variant = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  const cx = 8;

  // Pot
  ctx.fillStyle = POT_BROWN;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, 10);
  ctx.lineTo(cx - 2.5, 15);
  ctx.lineTo(cx + 2.5, 15);
  ctx.lineTo(cx + 3.5, 10);
  ctx.closePath();
  ctx.fill();

  // Pot rim
  ctx.fillStyle = POT_DARK;
  ctx.fillRect(cx - 4, 9.5, 8, 1.2);

  // Soil
  ctx.fillStyle = SOIL_COLOR;
  ctx.beginPath();
  ctx.ellipse(cx, 10, 3, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Plant foliage (different per variant)
  if (variant === 0) {
    // Bushy plant
    drawBushyLeaves(ctx, cx, 6);
  } else if (variant === 1) {
    // Tall spiky plant
    drawSpikeyLeaves(ctx, cx, 4);
  } else {
    // Round succulent
    drawSucculent(ctx, cx, 7);
  }

  ctx.restore();
}

function drawBushyLeaves(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const colors = PLANT_GREENS;
  // Back leaves
  ctx.fillStyle = colors[2];
  drawLeafCluster(ctx, cx, cy - 1, 4.5);
  // Mid leaves
  ctx.fillStyle = colors[1];
  drawLeafCluster(ctx, cx - 1, cy, 3.5);
  drawLeafCluster(ctx, cx + 1, cy, 3.5);
  // Front leaves
  ctx.fillStyle = colors[0];
  drawLeafCluster(ctx, cx, cy + 0.5, 3);
}

function drawLeafCluster(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpikeyLeaves(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = PLANT_GREENS[1];
  // Center spike
  drawLeaf(ctx, cx, cy + 4, cx, cy - 2, 1.2);
  // Side spikes
  ctx.fillStyle = PLANT_GREENS[0];
  drawLeaf(ctx, cx, cy + 4, cx - 3, cy, 1);
  drawLeaf(ctx, cx, cy + 4, cx + 3, cy, 1);
  ctx.fillStyle = PLANT_GREENS[2];
  drawLeaf(ctx, cx, cy + 3, cx - 2, cy + 1, 0.8);
  drawLeaf(ctx, cx, cy + 3, cx + 2, cy + 1, 0.8);
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  tipX: number,
  tipY: number,
  width: number,
): void {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const nx = -dy;
  const ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  const px = (nx / len) * width;
  const py = (ny / len) * width;

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + dx * 0.5 + px, baseY + dy * 0.5 + py, tipX, tipY);
  ctx.quadraticCurveTo(baseX + dx * 0.5 - px, baseY + dy * 0.5 - py, baseX, baseY);
  ctx.fill();
}

function drawSucculent(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Rosette pattern
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(angle) * 2.5;
    const py = cy + Math.sin(angle) * 2;
    ctx.fillStyle = i % 2 === 0 ? PLANT_GREENS[0] : PLANT_GREENS[1];
    ctx.beginPath();
    ctx.ellipse(px, py, 2, 1.5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center
  ctx.fillStyle = PLANT_GREENS[0];
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// ── Coffee Machine (1x1 tile, 16x16 logical) ──

export function drawCoffeeMachine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  // Machine body
  ctx.fillStyle = COFFEE_MACHINE_BODY;
  roundRect(ctx, 3, 3, 10, 12, 1.5);
  ctx.fill();

  // Top section
  ctx.fillStyle = COFFEE_MACHINE_TOP;
  roundRect(ctx, 3, 3, 10, 4, 1.5);
  ctx.fill();

  // Water tank (side)
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#60A5FA';
  ctx.fillRect(4, 4, 3, 3);
  ctx.restore();

  // Drip area
  ctx.fillStyle = '#1F2937';
  ctx.fillRect(5, 9, 6, 4);

  // Cup
  ctx.fillStyle = '#D1D5DB';
  ctx.fillRect(6, 10, 4, 3);

  // Coffee drip
  ctx.fillStyle = COFFEE_MACHINE_ACCENT;
  ctx.fillRect(7.5, 8, 1, 1.5);

  // Button
  ctx.fillStyle = COFFEE_MACHINE_ACCENT;
  ctx.beginPath();
  ctx.arc(11, 6, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Whiteboard (2x1 tiles, 32x16 logical) ──

export function drawWhiteboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  projectName?: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  // Frame
  ctx.fillStyle = WHITEBOARD_FRAME;
  roundRect(ctx, 1, 1, 30, 14, 1);
  ctx.fill();

  // Board surface
  ctx.fillStyle = WHITEBOARD_BG;
  ctx.fillRect(2, 2, 28, 12);

  // Content: project name or scribbles
  ctx.fillStyle = WHITEBOARD_TEXT;
  ctx.font = '3px sans-serif';
  if (projectName) {
    ctx.fillText(projectName.substring(0, 12), 4, 7);
  }

  // Decorative diagram/scribbles
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 0.5;
  // Box diagram
  ctx.strokeRect(4, 9, 5, 3);
  ctx.strokeRect(13, 9, 5, 3);
  // Arrow
  ctx.beginPath();
  ctx.moveTo(9, 10.5);
  ctx.lineTo(13, 10.5);
  ctx.stroke();
  // Bullet points
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(21, 4, 1, 1);
  ctx.fillRect(21, 6, 1, 1);
  ctx.fillRect(21, 8, 1, 1);
  ctx.restore();

  // Tray at bottom
  ctx.fillStyle = WHITEBOARD_FRAME;
  ctx.fillRect(4, 14, 24, 1.5);

  // Markers in tray
  const markerColors = ['#EF4444', '#3B82F6', '#22C55E'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = markerColors[i];
    ctx.fillRect(6 + i * 3, 14.2, 2, 0.8);
  }

  ctx.restore();
}

// ── Cooler / Water dispenser (1x1 tile, 16x16 logical) ──

export function drawCooler(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  // Base
  ctx.fillStyle = '#D1D5DB';
  roundRect(ctx, 4, 8, 8, 7, 1);
  ctx.fill();

  // Water bottle on top
  ctx.fillStyle = '#93C5FD';
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(6, 8);
  ctx.lineTo(6, 2);
  ctx.quadraticCurveTo(6, 0.5, 8, 0.5);
  ctx.quadraticCurveTo(10, 0.5, 10, 2);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Spigots
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(5, 10, 1.5, 1);
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(9.5, 10, 1.5, 1);

  ctx.restore();
}

// ── Utility ──

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
