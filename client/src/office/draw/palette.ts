// ── Color palette for illustrated isometric rendering ──────────

// Floor & Walls
export const FLOOR_DARK = '#2C2C3A';
export const FLOOR_WOOD_1 = '#3D3547';
export const FLOOR_WOOD_2 = '#352F42';
export const WALL_BASE = '#3D3D4F';
export const WALL_BASEBOARD = '#2A2A3C';
export const WALL_ACCENT = '#4A4A5F';

// Desk
export const DESK_WOOD_LIGHT = '#8B7B5A';
export const DESK_WOOD_DARK = '#6B5B3A';
export const DESK_EDGE = '#5A4A2A';
export const DESK_SHADOW = '#4A3A1A';

// Monitor
export const MONITOR_BEZEL = '#1A1A2E';
export const MONITOR_SCREEN = '#0D1117';
export const MONITOR_HIGHLIGHT = '#2A2A3E';

// Monitor screen content colors by tool
export const TOOL_SCREEN_COLORS: Record<string, string> = {
  Read: '#4ADE80',
  Grep: '#4ADE80',
  Glob: '#4ADE80',
  WebFetch: '#4ADE80',
  WebSearch: '#4ADE80',
  Edit: '#60A5FA',
  Write: '#60A5FA',
  NotebookEdit: '#60A5FA',
  Bash: '#F59E0B',
  Agent: '#C084FC',
  TodoWrite: '#FB923C',
};
export const TOOL_SCREEN_DEFAULT = '#4ADE80';

// Plants
export const PLANT_GREENS = ['#22C55E', '#16A34A', '#15803D'];
export const POT_BROWN = '#8B6914';
export const POT_DARK = '#6B4E0A';
export const SOIL_COLOR = '#3D2B1F';

// Lighting
export const LAMP_WARM = '#FCD34D';
export const LAMP_GLOW_ACTIVE = 'rgba(252, 211, 77, 0.25)';
export const LAMP_GLOW_IDLE = 'rgba(252, 211, 77, 0.08)';
export const LAMP_BASE = '#4A4A5F';
export const LAMP_SHADE = '#E5E7EB';

// Accent
export const ACCENT = '#818CF8';

// ── Role colors ──────────────────────────────────────────────

export interface RoleColors {
  accent: string;
  shirt: string;
  shirtDark: string;
  shirtLight: string;
}

export const ROLE_PALETTE: Record<string, RoleColors> = {
  architect: { accent: '#818CF8', shirt: '#6366F1', shirtDark: '#4F46E5', shirtLight: '#A5B4FC' },
  builder: { accent: '#4ADE80', shirt: '#22C55E', shirtDark: '#16A34A', shirtLight: '#86EFAC' },
  reviewer: { accent: '#F87171', shirt: '#EF4444', shirtDark: '#DC2626', shirtLight: '#FCA5A5' },
  tester: { accent: '#FBBF24', shirt: '#F59E0B', shirtDark: '#D97706', shirtLight: '#FDE68A' },
  documenter: { accent: '#60A5FA', shirt: '#3B82F6', shirtDark: '#2563EB', shirtLight: '#93C5FD' },
  unknown: { accent: '#9CA3AF', shirt: '#6B7280', shirtDark: '#4B5563', shirtLight: '#D1D5DB' },
};

export function getRoleColors(role: string): RoleColors {
  return ROLE_PALETTE[role] || ROLE_PALETTE.unknown;
}

// ── Skin tone palettes (matching existing palette indices 0-5) ──

export const SKIN_TONES = [
  { skin: '#FDBCB4', skinDark: '#E8A598', skinLight: '#FED5CF' },
  { skin: '#E8B88A', skinDark: '#D4A373', skinLight: '#F0CCA5' },
  { skin: '#C68B5E', skinDark: '#B07A4E', skinLight: '#D4A070' },
  { skin: '#A0673F', skinDark: '#8B5635', skinLight: '#B47A52' },
  { skin: '#7A4B2A', skinDark: '#694020', skinLight: '#8E5E3D' },
  { skin: '#5C3A1E', skinDark: '#4B2F15', skinLight: '#704D30' },
];

// ── Hair colors (indexed by palette) ──

export const HAIR_COLORS = [
  '#2C1810', // Black-brown
  '#8B4513', // Brown
  '#DAA520', // Golden
  '#B22222', // Auburn
  '#1C1C1C', // Black
  '#696969', // Gray
];

// ── Status LED ──

export const STATUS_GREEN = '#4ADE80';
export const STATUS_AMBER = '#FBBF24';
export const STATUS_RED = '#F87171';

// ── Furniture colors ──

export const CHAIR_DARK = '#3A3A4F';
export const CHAIR_SEAT = '#4A4A5F';
export const CHAIR_BACK = '#555570';
export const COFFEE_CUP_COLOR = '#DDD6CB';
export const COFFEE_LIQUID = '#6B4226';
export const STICKY_NOTE = '#FDE68A';
export const STICKY_NOTE_ALT = '#BFDBFE';
export const WHITEBOARD_BG = '#F3F4F6';
export const WHITEBOARD_FRAME = '#6B7280';
export const WHITEBOARD_TEXT = '#374151';
export const BOOK_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
export const MEETING_TABLE_TOP = '#6B5B3A';
export const MEETING_TABLE_EDGE = '#5A4A2A';
export const MEETING_TABLE_LEG = '#4A3A1A';
export const COFFEE_MACHINE_BODY = '#374151';
export const COFFEE_MACHINE_TOP = '#4B5563';
export const COFFEE_MACHINE_ACCENT = '#EF4444';

// ── Stuck indicator ──
export const STUCK_EXCLAIM = '#F87171';

// ── Celebration ──
export const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'];

// ── Window / sky ──
export const SKY_DAY = '#87CEEB';
export const SKY_SUNSET = '#FF7E5F';
export const SKY_NIGHT = '#1A1A2E';
export const WINDOW_FRAME = '#4B5563';

// ── Keyboard / Mouse ──
export const KEY_COLOR = '#374151';
export const KEY_LIGHT = '#4B5563';
export const MOUSE_COLOR = '#4B5563';
export const MOUSE_LIGHT = '#6B7280';
