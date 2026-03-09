import {
  NOTIFICATION_NOTE_1_HZ,
  NOTIFICATION_NOTE_1_START_SEC,
  NOTIFICATION_NOTE_2_HZ,
  NOTIFICATION_NOTE_2_START_SEC,
  NOTIFICATION_NOTE_DURATION_SEC,
  NOTIFICATION_VOLUME,
} from './constants.js';

// Sound type keys
export type SoundType = 'done' | 'permission' | 'stuck' | 'spawn' | 'search';

const SOUND_PREFS_KEY = 'agent-office-sound-prefs';
const VOLUME_KEY = 'agent-office-volume';

// Per-sound enable state
let soundPrefs: Record<SoundType, boolean> = {
  done: true,
  permission: true,
  stuck: true,
  spawn: false,
  search: true,
};

let globalVolume = 0.8; // 0-1 range
let audioCtx: AudioContext | null = null;

// Load preferences
try {
  const saved = localStorage.getItem(SOUND_PREFS_KEY);
  if (saved) soundPrefs = { ...soundPrefs, ...JSON.parse(saved) };
  const vol = localStorage.getItem(VOLUME_KEY);
  if (vol) globalVolume = parseFloat(vol);
} catch { /* ignore */ }

export function isSoundEnabled(): boolean {
  return Object.values(soundPrefs).some(Boolean);
}

export function setSoundEnabled(enabled: boolean): void {
  for (const key of Object.keys(soundPrefs) as SoundType[]) {
    soundPrefs[key] = enabled;
  }
  saveSoundPrefs();
}

export function getSoundPrefs(): Record<SoundType, boolean> {
  return { ...soundPrefs };
}

export function setSoundPref(type: SoundType, enabled: boolean): void {
  soundPrefs[type] = enabled;
  saveSoundPrefs();
}

export function getVolume(): number {
  return globalVolume;
}

export function setVolume(vol: number): void {
  globalVolume = Math.max(0, Math.min(1, vol));
  try { localStorage.setItem(VOLUME_KEY, String(globalVolume)); } catch { /* ignore */ }
}

function saveSoundPrefs(): void {
  try { localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(soundPrefs)); } catch { /* ignore */ }
}

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  return audioCtx;
}

function playNote(ctx: AudioContext, freq: number, startOffset: number, volume?: number, duration?: number): void {
  const t = ctx.currentTime + startOffset;
  const dur = duration ?? NOTIFICATION_NOTE_DURATION_SEC;
  const vol = (volume ?? NOTIFICATION_VOLUME) * globalVolume;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Ascending chime: E5 -> E6 (completion) */
export async function playDoneSound(): Promise<void> {
  if (!soundPrefs.done) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  playNote(ctx, NOTIFICATION_NOTE_1_HZ, NOTIFICATION_NOTE_1_START_SEC);
  playNote(ctx, NOTIFICATION_NOTE_2_HZ, NOTIFICATION_NOTE_2_START_SEC);
}

/** Descending warning: A5 -> E5 (permission wait) */
export async function playAlertSound(): Promise<void> {
  if (!soundPrefs.permission) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  playNote(ctx, 880, 0, 0.12);
  playNote(ctx, 659.25, 0.12, 0.10);
}

/** Three rapid low notes (stuck alarm) */
export async function playStuckSound(): Promise<void> {
  if (!soundPrefs.stuck) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  playNote(ctx, 220, 0, 0.10, 0.1);
  playNote(ctx, 220, 0.12, 0.10, 0.1);
  playNote(ctx, 220, 0.24, 0.10, 0.1);
}

/** Single bright note C6 (spawn) */
export async function playSpawnSound(): Promise<void> {
  if (!soundPrefs.spawn) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  playNote(ctx, 1046.5, 0, 0.10, 0.15);
}

/** Soft click (search) */
export async function playSearchSound(): Promise<void> {
  if (!soundPrefs.search) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
  playNote(ctx, 2000, 0, 0.04, 0.05);
}

/** Play any sound by type */
export async function playSoundByType(type: SoundType): Promise<void> {
  switch (type) {
    case 'done': return playDoneSound();
    case 'permission': return playAlertSound();
    case 'stuck': return playStuckSound();
    case 'spawn': return playSpawnSound();
    case 'search': return playSearchSound();
  }
}

/** Call from any user-gesture handler to ensure AudioContext is unlocked */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx?.state === 'suspended') ctx.resume();
}
