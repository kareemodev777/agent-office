// ── Desk workstation drawing ───────────────────────────────────
// Draws L-shaped desk, monitor, lamp, keyboard, mouse, personal items

import {
  CHAIR_BACK,
  CHAIR_DARK,
  CHAIR_SEAT,
  COFFEE_CUP_COLOR,
  COFFEE_LIQUID,
  DESK_EDGE,
  DESK_WOOD_DARK,
  DESK_WOOD_LIGHT,
  KEY_COLOR,
  KEY_LIGHT,
  LAMP_BASE,
  LAMP_GLOW_ACTIVE,
  LAMP_GLOW_IDLE,
  LAMP_SHADE,
  LAMP_WARM,
  MONITOR_BEZEL,
  MONITOR_HIGHLIGHT,
  MONITOR_SCREEN,
  MOUSE_COLOR,
  MOUSE_LIGHT,
  STATUS_AMBER,
  STATUS_GREEN,
  STATUS_RED,
  STICKY_NOTE,
  STICKY_NOTE_ALT,
  TOOL_SCREEN_COLORS,
  TOOL_SCREEN_DEFAULT,
} from './palette.js';

/** Get monitor screen accent color based on current tool */
function getToolColor(tool: string | null): string {
  if (!tool) return MONITOR_SCREEN;
  return TOOL_SCREEN_COLORS[tool] ?? TOOL_SCREEN_DEFAULT;
}

/** Draw an L-shaped desk workstation at logical coordinates (0,0)-(32,32) */
export function drawDesk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  tool: string | null = null,
  isActive = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  // ── Desk surface (fills upper ~18 rows of the 32x32 space) ──
  // Wood gradient
  const deskGrad = ctx.createLinearGradient(1, 1, 1, 18);
  deskGrad.addColorStop(0, DESK_WOOD_LIGHT);
  deskGrad.addColorStop(1, DESK_WOOD_DARK);
  ctx.fillStyle = deskGrad;

  // Main desk surface
  roundRect(ctx, 1, 1, 30, 17, 1.5);
  ctx.fill();

  // Edge/shadow
  ctx.fillStyle = DESK_EDGE;
  ctx.fillRect(1, 17, 30, 1.5);

  // Desk legs (visible below surface)
  ctx.fillStyle = DESK_EDGE;
  ctx.fillRect(2, 18.5, 1.5, 3);
  ctx.fillRect(28.5, 18.5, 1.5, 3);

  // ── Monitor ──
  drawMonitor(ctx, 10, 2, tool, isActive);

  // ── Desk lamp ──
  drawDeskLamp(ctx, 25, 3, isActive);

  // ── Keyboard ──
  drawKeyboard(ctx, 10, 12);

  // ── Mouse ──
  drawMouse(ctx, 21, 13);

  // ── Personal item (deterministic by position) ──
  const itemSeed = Math.round(x + y * 100);
  if (itemSeed % 3 === 0) {
    drawCoffeeCup(ctx, 3, 3);
  } else if (itemSeed % 3 === 1) {
    drawStickyNotes(ctx, 2, 10);
  }
  // Third variant: nothing extra (clean desk)

  ctx.restore();
}

/** Draw monitor with bezel and screen content */
function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tool: string | null,
  isActive: boolean,
): void {
  // Monitor bezel
  ctx.fillStyle = MONITOR_BEZEL;
  roundRect(ctx, x, y, 12, 8, 1);
  ctx.fill();

  // Highlight edge on top
  ctx.fillStyle = MONITOR_HIGHLIGHT;
  ctx.fillRect(x + 0.5, y, 11, 0.5);

  // Screen
  const screenX = x + 1;
  const screenY = y + 1;
  const screenW = 10;
  const screenH = 5.5;
  ctx.fillStyle = MONITOR_SCREEN;
  ctx.fillRect(screenX, screenY, screenW, screenH);

  if (isActive && tool) {
    // Active screen content
    const toolColor = getToolColor(tool);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = toolColor;
    // Simulated code/text lines
    const lineH = 0.8;
    const gap = 0.5;
    for (let i = 0; i < 4; i++) {
      const ly = screenY + 0.5 + i * (lineH + gap);
      const lw = 3 + ((i * 7 + 3) % 5); // pseudo-random width
      ctx.fillRect(screenX + 0.5, ly, lw, lineH);
    }
    ctx.restore();

    // Screen glow on desk
    ctx.save();
    ctx.globalAlpha = 0.12;
    const glow = ctx.createRadialGradient(
      x + 6, y + 10, 0,
      x + 6, y + 10, 8,
    );
    glow.addColorStop(0, toolColor);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 2, y + 6, 16, 10);
    ctx.restore();
  } else if (isActive) {
    // Active but no specific tool — screensaver-like
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(screenX + 3, screenY + 2, 4, 2);
    ctx.restore();
  }

  // Monitor stand
  ctx.fillStyle = MONITOR_BEZEL;
  ctx.fillRect(x + 5, y + 8, 2, 1.5);
  ctx.fillRect(x + 3.5, y + 9.2, 5, 0.8);

  // Status LED
  if (isActive) {
    ctx.fillStyle = tool ? STATUS_GREEN : STATUS_AMBER;
  } else {
    ctx.fillStyle = STATUS_RED;
  }
  ctx.beginPath();
  ctx.arc(x + 6, y + 7, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw desk lamp with warm glow */
function drawDeskLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isActive: boolean,
): void {
  // Glow (behind lamp)
  if (isActive) {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, 7);
    glow.addColorStop(0, LAMP_GLOW_ACTIVE);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 7, y - 6, 14, 14);
    ctx.restore();
  } else {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, 4);
    glow.addColorStop(0, LAMP_GLOW_IDLE);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 4, y - 3, 8, 8);
    ctx.restore();
  }

  // Lamp base
  ctx.fillStyle = LAMP_BASE;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 2, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lamp arm
  ctx.strokeStyle = LAMP_BASE;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x - 0.5, y);
  ctx.stroke();

  // Lamp shade
  ctx.fillStyle = LAMP_SHADE;
  ctx.beginPath();
  ctx.moveTo(x - 2, y);
  ctx.lineTo(x + 2, y);
  ctx.lineTo(x + 1.2, y - 1.5);
  ctx.lineTo(x - 1.2, y - 1.5);
  ctx.closePath();
  ctx.fill();

  // Bulb glow
  if (isActive) {
    ctx.fillStyle = LAMP_WARM;
    ctx.beginPath();
    ctx.arc(x, y - 0.3, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw keyboard */
function drawKeyboard(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Keyboard body
  ctx.fillStyle = KEY_COLOR;
  roundRect(ctx, x, y, 8, 3, 0.5);
  ctx.fill();

  // Key rows
  ctx.fillStyle = KEY_LIGHT;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.fillRect(x + 0.5 + col * 1.25, y + 0.4 + row * 0.9, 0.9, 0.6);
    }
  }
}

/** Draw mouse */
function drawMouse(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = MOUSE_COLOR;
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 1.2, 1, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Scroll wheel
  ctx.fillStyle = MOUSE_LIGHT;
  ctx.fillRect(x + 0.7, y + 0.5, 0.6, 0.4);
}

/** Draw coffee cup */
function drawCoffeeCup(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Cup body
  ctx.fillStyle = COFFEE_CUP_COLOR;
  ctx.fillRect(x, y + 0.5, 2.5, 3);
  roundRect(ctx, x, y + 0.3, 2.5, 0.5, 0.2);
  ctx.fill();

  // Coffee liquid top
  ctx.fillStyle = COFFEE_LIQUID;
  ctx.beginPath();
  ctx.ellipse(x + 1.25, y + 0.5, 1.1, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Handle
  ctx.strokeStyle = COFFEE_CUP_COLOR;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x + 2.8, y + 2, 0.8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

/** Draw sticky notes */
function drawStickyNotes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Back note (offset)
  ctx.fillStyle = STICKY_NOTE_ALT;
  ctx.save();
  ctx.translate(x + 0.5, y);
  ctx.rotate(0.1);
  ctx.fillRect(0, 0, 3, 3);
  ctx.restore();

  // Front note
  ctx.fillStyle = STICKY_NOTE;
  ctx.fillRect(x, y + 0.3, 3, 3);

  // Scribble lines
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 0.3;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 0.4, y + 1);
  ctx.lineTo(x + 2.2, y + 1);
  ctx.moveTo(x + 0.4, y + 1.8);
  ctx.lineTo(x + 1.8, y + 1.8);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Draw an office chair */
export function drawChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  facingDir: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);

  const cw = 16;
  const ch = 16;

  // Chair base (star shape simplified as circle)
  ctx.fillStyle = CHAIR_DARK;
  ctx.beginPath();
  ctx.ellipse(cw / 2, ch * 0.7, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Seat cushion
  ctx.fillStyle = CHAIR_SEAT;
  ctx.beginPath();
  ctx.ellipse(cw / 2, ch * 0.55, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chair back (based on facing direction)
  ctx.fillStyle = CHAIR_BACK;
  const backH = 6;
  switch (facingDir) {
    case 0: // DOWN — back at top
      roundRect(ctx, cw / 2 - 5, 1, 10, backH, 2);
      ctx.fill();
      break;
    case 1: // LEFT — back on right
      roundRect(ctx, cw - 5, ch * 0.3, 4, 7, 2);
      ctx.fill();
      break;
    case 2: // RIGHT — back on left
      roundRect(ctx, 1, ch * 0.3, 4, 7, 2);
      ctx.fill();
      break;
    case 3: // UP — back at bottom
      roundRect(ctx, cw / 2 - 5, ch - backH - 1, 10, backH, 2);
      ctx.fill();
      break;
  }

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
