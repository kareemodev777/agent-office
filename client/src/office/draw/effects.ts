// ── Effects: glow, shadows, particles, ambient lighting ────────

import { CONFETTI_COLORS, LAMP_GLOW_ACTIVE, LAMP_WARM } from './palette.js';

// ── Desk lamp radial glow ──

/** Draw a warm radial glow from a desk lamp onto the surrounding area */
export function drawDeskLampGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  intensity: number, // 0-1
): void {
  if (intensity <= 0) return;

  const radius = 40 * zoom;
  ctx.save();
  ctx.globalAlpha = intensity * 0.2;
  ctx.globalCompositeOperation = 'lighter';

  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, LAMP_WARM);
  glow.addColorStop(0.4, LAMP_GLOW_ACTIVE);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  ctx.restore();
}

// ── Monitor color spill ──

/** Draw colored light spill from monitor onto desk surface and nearby area */
export function drawMonitorGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  color: string,
  intensity: number,
): void {
  if (intensity <= 0) return;

  const radius = 20 * zoom;
  ctx.save();
  ctx.globalAlpha = intensity * 0.1;
  ctx.globalCompositeOperation = 'lighter';

  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  ctx.restore();
}

// ── Shadow casting ──

/** Draw a simple drop shadow under an object */
export function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha = 0.15,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Celebration confetti particles ──

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
}

/** Create a burst of confetti particles at the given position */
export function createConfettiBurst(
  worldX: number,
  worldY: number,
  count = 12,
): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 30 + Math.random() * 40;
    particles.push({
      x: worldX,
      y: worldY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40, // upward bias
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 1.5 + Math.random() * 1.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 8,
      life: 0,
      maxLife: 0.8 + Math.random() * 0.5,
    });
  }
  return particles;
}

/** Update confetti particles. Returns particles that are still alive. */
export function updateConfetti(particles: ConfettiParticle[], dt: number): ConfettiParticle[] {
  const alive: ConfettiParticle[] = [];
  for (const p of particles) {
    p.life += dt;
    if (p.life >= p.maxLife) continue;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt; // gravity
    p.rotation += p.rotationSpeed * dt;
    alive.push(p);
  }
  return alive;
}

/** Render confetti particles */
export function renderConfetti(
  ctx: CanvasRenderingContext2D,
  particles: ConfettiParticle[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const p of particles) {
    const alpha = 1 - p.life / p.maxLife;
    const sx = offsetX + p.x * zoom;
    const sy = offsetY + p.y * zoom;
    const size = p.size * zoom;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.6);
    ctx.restore();
  }
}

// ── Ambient lighting layer ──

/** Draw an ambient lighting overlay across the entire office */
export function drawAmbientLighting(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  // Subtle warm vignette
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.globalCompositeOperation = 'multiply';

  const grad = ctx.createRadialGradient(
    x + width / 2, y + height / 2, 0,
    x + width / 2, y + height / 2, Math.max(width, height) / 2,
  );
  grad.addColorStop(0, '#FDE68A'); // warm center
  grad.addColorStop(1, '#1E1B4B'); // cool edges

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

// ── Character selection glow ──

/** Draw a glow outline around a character for selection/hover */
export function drawCharacterGlow(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  alpha: number,
  color = '#FFFFFF',
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(canvas, x, y);
  ctx.restore();
}

// ── Spawn/despawn effects (replaces matrix effect for drawn characters) ──

/** Draw spawn effect: reveal from bottom with green tint */
export function drawSpawnEffect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  progress: number, // 0-1
): void {
  const revealH = canvas.height * progress;
  if (revealH <= 0) return;

  ctx.save();
  // Clip to revealed portion
  ctx.beginPath();
  ctx.rect(x, y + canvas.height - revealH, canvas.width, revealH);
  ctx.clip();
  ctx.drawImage(canvas, x, y);

  // Green tint overlay (fades as progress increases)
  ctx.globalAlpha = (1 - progress) * 0.4;
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(x, y + canvas.height - revealH, canvas.width, revealH);
  ctx.restore();
}

/** Draw despawn effect: fade out with green dissolve */
export function drawDespawnEffect(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  progress: number, // 0-1
): void {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.drawImage(canvas, x, y);

  // Green dissolve overlay
  ctx.globalAlpha = progress * 0.3;
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(x, y, canvas.width, canvas.height);
  ctx.restore();
}
