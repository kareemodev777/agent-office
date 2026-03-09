import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SessionRecord {
  id: number;
  label: string;
  slug: string | null;
  role: string | null;
  startedAt: number;
  endedAt: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cwd: string | null;
  gitBranch: string | null;
}

export interface PersistenceData {
  sessions: SessionRecord[];
  dailyCosts: Record<string, number>;
  totalSessions: number;
  settings: {
    theme?: string;
    sound?: boolean;
    notifications?: boolean;
    webhookUrl?: string;
  };
}

const DATA_DIR = path.join(os.homedir(), '.agent-office');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SAVE_INTERVAL_MS = 30_000;

let data: PersistenceData = {
  sessions: [],
  dailyCosts: {},
  totalSessions: 0,
  settings: {},
};

let dirty = false;
let saveTimer: ReturnType<typeof setInterval> | null = null;

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPersistence(): PersistenceData {
  ensureDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistenceData>;
      data = {
        sessions: parsed.sessions ?? [],
        dailyCosts: parsed.dailyCosts ?? {},
        totalSessions: parsed.totalSessions ?? 0,
        settings: parsed.settings ?? {},
      };
    }
  } catch {
    console.log('[Agent Office] Could not load persistence data, starting fresh');
  }
  return data;
}

export function savePersistence(): void {
  ensureDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    dirty = false;
  } catch (err) {
    console.error('[Agent Office] Failed to save persistence data:', err);
  }
}

export function getData(): PersistenceData {
  return data;
}

export function addSession(session: SessionRecord): void {
  data.sessions.push(session);
  data.totalSessions++;

  // Update daily cost
  const dateKey = new Date(session.endedAt).toISOString().slice(0, 10);
  const cost =
    (session.inputTokens * 3 +
      session.outputTokens * 15 +
      session.cacheCreationTokens * 3.75 +
      (session.cacheReadTokens ?? 0) * 0.3) /
    1_000_000;
  data.dailyCosts[dateKey] = (data.dailyCosts[dateKey] ?? 0) + cost;

  // Keep only last 500 sessions to prevent unbounded growth
  if (data.sessions.length > 500) {
    data.sessions = data.sessions.slice(-500);
  }

  dirty = true;
}

export function updateSettings(settings: Partial<PersistenceData['settings']>): void {
  data.settings = { ...data.settings, ...settings };
  dirty = true;
}

export function clearHistory(): void {
  data.sessions = [];
  data.dailyCosts = {};
  data.totalSessions = 0;
  dirty = true;
  savePersistence();
}

export function startPeriodicSave(): void {
  saveTimer = setInterval(() => {
    if (dirty) {
      savePersistence();
    }
  }, SAVE_INTERVAL_MS);
}

export function stopPeriodicSave(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (dirty) {
    savePersistence();
  }
}
