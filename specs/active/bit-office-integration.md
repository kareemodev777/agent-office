# Spec: Bit-Office Feature Integration — Agent Office v6

## Status: Draft

## Objective

Elevate agent-office from a **monitoring dashboard** into a **coordination-aware visualization platform** by incorporating the best architectural patterns from bit-office, while preserving our unique pixel-art office aesthetic.

## Background

### What bit-office does well
- **Orchestrator pattern**: Clean separation of coordination logic (packages/orchestrator/) from runtime (apps/gateway/) from UI (apps/web/)
- **Team workflow phases**: Structured Create → Design → Execute → Complete pipeline with phase machine
- **Git worktree isolation**: Each dev agent gets an isolated filesystem + branch, with conflict detection before merge
- **Activity board**: Agents broadcast intent, touched files, and needs — enabling soft coordination
- **Console mode**: Full-screen terminal-style interface with typewriter streaming, CRT effects, and JetBrains Mono
- **Zod-validated protocol**: Every command and event is schema-validated at the boundary
- **Agent memory**: Review patterns, tech preferences, and project ratings persist across sessions
- **Project archival**: Completed projects archived with metadata, ratings, and event history
- **Multi-backend support**: Claude, Codex, Gemini, Aider — all detected and monitored

### What agent-office does well (preserve these)
- **Pixel-art office visualization** with canvas rendering, furniture placement, character animations
- **Real-time JSONL streaming** with tool status bubbles, connection lines, sub-agent tracking
- **Zero-config monitoring** — just run and it discovers active Claude Code sessions
- **Lightweight architecture** — Express + WebSocket + React, no monorepo complexity
- **System resource monitoring** with per-process CPU/RAM
- **Webhook notifications** to Discord/Slack
- **Session cost tracking** with Opus pricing model
- **macOS auto-start** via LaunchAgent

### Core Principle
**Do not turn agent-office into bit-office.** Instead, selectively adopt patterns that enhance our monitoring + visualization strengths. We remain a standalone dashboard, not an orchestrator.

---

## Current State

### Server (`server/`)
| File | Purpose |
|------|---------|
| `index.ts` | Express + WebSocket server, message routing |
| `agentManager.ts` | Agent state, JSONL reading, label/role derivation |
| `parser.ts` | JSONL line processing, tool tracking |
| `watcher.ts` | Chokidar file watching on `~/.claude/projects/` |
| `persistence.ts` | Session history to `~/.agent-office/data.json` |
| `timerManager.ts` | Waiting/permission delay timers |
| `systemStats.ts` | CPU/RAM monitoring |
| `webhooks.ts` | Discord/Slack notifications |
| `types.ts` | TypeScript definitions |
| `constants.ts` | Timing constants |

### Client (`client/src/`)
| Area | Key Files |
|------|-----------|
| State | `transport.ts`, `hooks/useExtensionMessages.ts` |
| Components | 14 UI components (TopBar, InspectPanel, SpawnDialog, etc.) |
| Office engine | `office/engine/` (gameLoop, renderer, characters, matrixEffect) |
| Layout | `office/layout/` (furnitureCatalog, layoutSerializer, tileMap) |
| Sprites | `office/sprites/` (spriteData, spriteCache, colorize) |
| Canvas | `office/components/` (OfficeCanvas, ToolOverlay, ConnectionLines) |

### Key Limitations
1. No inter-agent awareness (agents don't know about each other's work)
2. No task/phase tracking (just tool status)
3. No console/terminal view mode
4. No structured event protocol (ad-hoc message types)
5. No project lifecycle tracking
6. No agent memory/learning across sessions
7. Flat agent list — no team grouping or workflow phases
8. No transcript streaming in real-time (only on inspect)

---

## Proposed Changes — 5 Phases

---

## Phase 1: Protocol & State Foundation
**Goal:** Establish a typed event protocol and richer agent state model that can support all subsequent features.

### 1.1 Shared Types Package
Create `shared/` directory (not a separate npm package — just shared TypeScript files imported by both server and client via path aliases).

#### Files to Create
| File | Purpose |
|------|---------|
| `shared/types.ts` | Core type definitions shared between server and client |
| `shared/events.ts` | Typed event discriminated unions for WebSocket protocol |
| `shared/commands.ts` | Typed command discriminated unions (client → server) |

#### Key Types
```typescript
// shared/types.ts

type AgentRole = "architect" | "builder" | "reviewer" | "tester" | "documenter" | "unknown";
type AgentPhase = "idle" | "thinking" | "tool-active" | "waiting" | "permission" | "stuck" | "done";
type TeamPhase = "create" | "design" | "execute" | "complete";

interface AgentActivity {
  agentId: string;
  intent: string;           // Current task description (first 200 chars of prompt)
  touchedFiles: string[];   // Files being read/written
  phase: AgentPhase;
  startedAt: number;
  lastActivityAt: number;
}

interface TeamState {
  teamId: string;
  name: string;
  phase: TeamPhase;
  leadAgentId: string;
  memberIds: string[];
  projectDir: string | null;
  createdAt: number;
}

interface ProjectRecord {
  projectId: string;
  name: string;
  projectDir: string;
  agents: string[];         // Agent IDs that worked on it
  startedAt: number;
  completedAt?: number;
  totalTokens: number;
  totalCost: number;
}
```

#### Key Events
```typescript
// shared/events.ts — discriminated union

type ServerEvent =
  | { type: "snapshot"; agents: AgentSnapshot[]; teams: TeamState[]; projects: ProjectRecord[] }
  | { type: "agent:created"; agent: AgentSnapshot }
  | { type: "agent:updated"; agentId: string; changes: Partial<AgentSnapshot> }
  | { type: "agent:closed"; agentId: string; record: SessionRecord }
  | { type: "agent:activity"; activity: AgentActivity }
  | { type: "agent:tool"; agentId: string; tool: ToolEvent }
  | { type: "agent:log"; agentId: string; lines: string[] }  // streaming transcript
  | { type: "team:created"; team: TeamState }
  | { type: "team:updated"; teamId: string; changes: Partial<TeamState> }
  | { type: "system:stats"; stats: SystemStats }
  // ... etc

type ClientCommand =
  | { type: "subscribe"; agentId: string }
  | { type: "unsubscribe"; agentId: string }
  | { type: "inspect"; agentId: string }
  | { type: "spawn"; projectDir: string; prompt: string }
  | { type: "kill"; agentId: string }
  | { type: "search"; query: string }
  // ... etc
```

### 1.2 Activity Tracking
Extend `agentManager.ts` to derive **intent** and **touched files** from JSONL parsing.

#### Files to Modify
| File | Changes |
|------|---------|
| `server/agentManager.ts` | Add `intent`, `touchedFiles`, `phase` fields to AgentState |
| `server/parser.ts` | Extract file paths from Read/Edit/Write tool args; extract intent from initial user message |
| `server/index.ts` | Broadcast `agent:activity` events on state changes |

**Intent extraction:** First user message text (truncated to 200 chars) = agent's current task intent.
**Touched files extraction:** Accumulate file paths from Read, Edit, Write, Grep, Glob tool_use blocks.
**Phase derivation:** Map existing flags → phase enum (hasActiveTools → "tool-active", isWaiting → "waiting", permissionSent → "permission", stuck → "stuck").

### 1.3 Team Auto-Detection
Agents working in the same `projectDir` are automatically grouped into a team.

#### Files to Create
| File | Purpose |
|------|---------|
| `server/teamManager.ts` | Auto-detect teams by shared projectDir, manage team lifecycle |

**Logic:**
- When agent is added, check if any existing agents share the same `projectPath`
- If yes, create or join a team (teamId = hash of projectDir)
- Team lead = first agent in the project (or architect-role if present)
- When last agent in team closes, archive the team
- Broadcast `team:created` / `team:updated` events

### Implementation Steps
- [ ] Create `shared/` directory with types, events, commands
- [ ] Configure TypeScript path aliases for `shared/` in both server and client tsconfigs
- [ ] Migrate existing WebSocket messages to typed event protocol (gradual — keep backward compat during migration)
- [ ] Add intent, touchedFiles, phase to AgentState
- [ ] Implement touched-file extraction in parser.ts
- [ ] Implement intent extraction from first user message
- [ ] Create teamManager.ts with auto-detection logic
- [ ] Update index.ts to use new broadcast protocol
- [ ] Update client useExtensionMessages.ts to handle new event types

---

## Phase 2: Activity Board & Agent Awareness
**Goal:** Give users (and eventually agents) visibility into what every agent is doing, what files they're touching, and potential conflicts.

### 2.1 Activity Board Component
A sidebar panel showing all agents' current activities at a glance.

#### Files to Create
| File | Purpose |
|------|---------|
| `client/src/components/ActivityBoard.tsx` | Real-time activity feed panel |

**Design:**
- Collapsible sidebar (right side, toggled with `A` key)
- Per-agent cards showing:
  - Agent name + role badge
  - Current intent (task description)
  - Active tool with status
  - List of recently touched files
  - Duration since last activity
  - Team membership badge
- **Conflict indicators:** When 2+ agents touch the same file, highlight in amber
- **Timeline view:** Optional vertical timeline of recent activities across all agents

### 2.2 File Conflict Detection
Server-side detection when multiple agents read/write the same files.

#### Files to Create
| File | Purpose |
|------|---------|
| `server/conflictDetector.ts` | Track file access across agents, emit warnings |

**Logic:**
- Maintain `Map<filePath, Set<agentId>>` of currently-touched files
- When a file appears in 2+ agents' touchedFiles → emit `conflict:detected` event
- Client shows amber highlight on both agents' bubbles
- No blocking — just awareness (we don't orchestrate)

### 2.3 Enhanced Tool Overlay
Upgrade speech bubbles to show richer context.

#### Files to Modify
| File | Changes |
|------|---------|
| `client/src/office/components/ToolOverlay.tsx` | Add intent tooltip, file conflict indicators, team badge |

**New bubble content:**
- Hover to see full intent text
- File conflict icon (amber triangle) when overlapping with other agents
- Team color ring around avatar

### Implementation Steps
- [ ] Create ActivityBoard component with agent cards
- [ ] Add keyboard shortcut (`A`) and TopBar button for toggle
- [ ] Implement conflictDetector.ts on server
- [ ] Add conflict:detected event to protocol
- [ ] Enhance ToolOverlay with intent tooltips and conflict indicators
- [ ] Add team color coding to agent avatars/bubbles
- [ ] Wire activity data flow: server → WebSocket → Zustand-like state → components

---

## Phase 3: Console Mode
**Goal:** Add a full-screen terminal-style interface for focused agent interaction and transcript viewing.

### 3.1 Console View Component
Terminal-aesthetic chat display replacing the pixel office canvas.

#### Files to Create
| File | Purpose |
|------|---------|
| `client/src/components/ConsoleMode.tsx` | Full-screen terminal view |
| `client/src/components/ConsoleAgentTabs.tsx` | Agent selector tabs for console |
| `client/src/components/TypewriterText.tsx` | Streaming text with typewriter animation |

**Design (inspired by bit-office but our own take):**
- **Font:** JetBrains Mono (load from Google Fonts or bundle)
- **Theme:** Dark terminal — but using our existing CSS var system, not hardcoded green
  - Dark mode: green-on-black CRT aesthetic (`#18ff62` text, `#0a1f0a` bg)
  - Light mode: dark-on-white paper terminal (monospace, clean)
- **Layout:**
  - Left sidebar: Vertical agent tabs (icon + name + status dot)
  - Center: Scrollable transcript with tool blocks rendered as collapsible sections
  - Bottom: Status bar (tokens, cost, duration, phase)
- **Streaming:** Subscribe to `agent:log` events for real-time transcript
- **Tool rendering:** Tool uses displayed as collapsible blocks with syntax highlighting
  - `Read file.ts` → show file path, expandable to show content
  - `Bash: npm test` → show command, expandable to show output
  - `Edit file.ts` → show diff view
- **Toggle:** `C` key or button in TopBar switches between office and console
- **Unmount office:** When in console mode, stop the game loop and unmount canvas (save resources)

### 3.2 Real-Time Transcript Streaming
Currently, transcripts are only loaded on-demand via inspect. Add continuous streaming.

#### Files to Modify
| File | Changes |
|------|---------|
| `server/index.ts` | Add `agent:log` broadcast for subscribed agents |
| `server/agentManager.ts` | Stream parsed lines to subscribers (not just raw JSONL) |

**Protocol:**
- Client sends `{ type: "subscribe", agentId }` to start streaming
- Server sends `{ type: "agent:log", agentId, lines }` with parsed, formatted lines
- Batched: accumulate lines for 200ms, then flush (avoid per-line overhead)
- Client sends `{ type: "unsubscribe", agentId }` to stop

### 3.3 Team Chat Panel
When viewing a team's agents, show inter-agent delegation messages.

#### Files to Create
| File | Purpose |
|------|---------|
| `client/src/components/TeamChat.tsx` | Team-wide message feed |

**Content sources:**
- Agent activity events (started/completed phases)
- Tool delegations (Task tool spawns)
- File conflict warnings
- Agent status changes (waiting, stuck)

**Format:**
```
[14:32:01] [builder-1] Started: Implementing auth middleware
[14:32:15] [builder-1] Reading: src/middleware/auth.ts
[14:33:42] [builder-2] Started: Writing unit tests for auth
[14:33:50] ⚠ CONFLICT: auth.ts touched by builder-1 and builder-2
[14:35:10] [builder-1] Completed: Auth middleware (2m 9s, 12.4k tokens)
```

### Implementation Steps
- [ ] Create ConsoleMode component with terminal aesthetic
- [ ] Create ConsoleAgentTabs with agent selection
- [ ] Create TypewriterText for streaming display
- [ ] Implement real-time transcript streaming protocol
- [ ] Add parsed line formatting (tool blocks, text, metadata)
- [ ] Create TeamChat component for team-wide feed
- [ ] Add `C` keyboard shortcut and TopBar toggle
- [ ] Implement canvas unmount/remount on mode switch
- [ ] Load JetBrains Mono font

---

## Phase 4: Project Lifecycle & Persistence
**Goal:** Track projects across sessions with history, metadata, and aggregate metrics.

### 4.1 Project Manager
Server-side project tracking that persists across restarts.

#### Files to Create
| File | Purpose |
|------|---------|
| `server/projectManager.ts` | Project lifecycle, persistence, archival |

**Data model:**
```typescript
interface Project {
  projectId: string;        // hash of projectDir
  name: string;             // derived from path
  projectDir: string;
  sessions: SessionSummary[];  // all sessions that worked on this project
  totalTokens: number;
  totalCost: number;
  firstSeen: number;
  lastActive: number;
  status: "active" | "archived";
}

interface SessionSummary {
  agentId: string;
  role: AgentRole;
  startedAt: number;
  endedAt?: number;
  tokens: number;
  cost: number;
}
```

**Persistence:** `~/.agent-office/projects.json`
- Auto-save on session close
- Load on server start
- Keep last 100 projects (prune oldest archived)

### 4.2 Enhanced History Panel
Upgrade the existing HistoryPanel to be project-centric.

#### Files to Modify
| File | Changes |
|------|---------|
| `client/src/components/HistoryPanel.tsx` | Group sessions by project, show project-level metrics |

**New features:**
- Group by project (expandable to see individual sessions)
- Project-level totals (cost, tokens, duration, session count)
- Search/filter by project name
- Date range filter (existing)
- Export project report (JSON)

### 4.3 Agent Memory (Lightweight)
Simple key-value memory that persists useful patterns.

#### Files to Create
| File | Purpose |
|------|---------|
| `server/memory.ts` | Agent memory: frequent projects, role patterns, cost patterns |

**What to remember (automatically derived — not LLM-generated):**
- Frequent projects and their typical agent configurations
- Average session duration and cost per project
- Role distribution per project
- Common tool patterns (which tools used most per project)
- Peak activity hours

**Not in scope:** We do NOT inject memory into agent prompts (we're a dashboard, not an orchestrator). Memory is for UI insights only.

### Implementation Steps
- [ ] Create projectManager.ts with project lifecycle tracking
- [ ] Add project persistence to `~/.agent-office/projects.json`
- [ ] Update persistence.ts to include project data in auto-save
- [ ] Upgrade HistoryPanel to project-centric view
- [ ] Create memory.ts with automatic pattern extraction
- [ ] Add project stats to TopBar (active projects count)
- [ ] Add project filter to ActivityBoard

---

## Phase 5: UI Architecture Cleanup
**Goal:** Refactor client state management and component structure for maintainability.

### 5.1 State Management Refactor
Replace the monolithic `useExtensionMessages` hook with a proper store.

#### Files to Create
| File | Purpose |
|------|---------|
| `client/src/store/office-store.ts` | Zustand store for all office state |
| `client/src/store/selectors.ts` | Memoized selectors for derived state |

**Store slices:**
- `agents` — Map of agent states (replaces scattered useState in useExtensionMessages)
- `teams` — Map of team states
- `projects` — Map of project records
- `ui` — Panel visibility, selected agent, view mode (office/console), edit mode
- `system` — System stats, connection status

**Benefits:**
- Components subscribe to specific slices (no unnecessary re-renders)
- DevTools support via Zustand middleware
- Clean separation of server-sync state vs local UI state

### 5.2 Component Restructuring
Reorganize components by domain.

#### Directory Restructure
```
client/src/
├── store/
│   ├── office-store.ts       # Zustand store
│   └── selectors.ts          # Derived state
├── components/
│   ├── layout/               # App shell
│   │   ├── TopBar.tsx
│   │   ├── BottomToolbar.tsx
│   │   └── Sidebar.tsx
│   ├── panels/               # Slide-out panels
│   │   ├── InspectPanel.tsx
│   │   ├── ActivityBoard.tsx
│   │   ├── HistoryPanel.tsx
│   │   └── SearchPanel.tsx
│   ├── console/              # Console mode
│   │   ├── ConsoleMode.tsx
│   │   ├── ConsoleAgentTabs.tsx
│   │   ├── TeamChat.tsx
│   │   └── TypewriterText.tsx
│   ├── modals/               # Modal dialogs
│   │   ├── SpawnDialog.tsx
│   │   ├── SettingsModal.tsx
│   │   └── ShortcutsHelp.tsx
│   └── office/               # Pixel art engine (unchanged)
│       ├── engine/
│       ├── components/
│       ├── sprites/
│       └── layout/
├── hooks/
│   ├── useWebSocket.ts       # WebSocket connection (extracted from transport.ts)
│   └── useKeyboardShortcuts.ts
└── lib/
    └── cost.ts               # Cost calculation utilities
```

### 5.3 Keyboard Shortcut System
Consolidate keyboard handling.

#### Files to Create
| File | Purpose |
|------|---------|
| `client/src/hooks/useKeyboardShortcuts.ts` | Centralized keyboard shortcut registry |

**Current shortcuts to preserve:** S (spawn), I (inspect), K (kill), M (minimap), W (widget), E (edit), H (help), Esc (close panels)
**New shortcuts:** A (activity board), C (console mode), T (team chat), P (project history)

### Implementation Steps
- [ ] Install Zustand (`npm install zustand`)
- [ ] Create office-store.ts with agent, team, project, UI, system slices
- [ ] Create selectors.ts for derived state (cost calculations, team grouping, etc.)
- [ ] Migrate useExtensionMessages state into Zustand store (can be gradual)
- [ ] Restructure component directories
- [ ] Create useKeyboardShortcuts hook
- [ ] Extract WebSocket logic from transport.ts into useWebSocket hook
- [ ] Update App.tsx to use store-based rendering
- [ ] Add Zustand DevTools middleware for development

---

## Phase Summary & Dependencies

```
Phase 1: Protocol & State Foundation
  └── Phase 2: Activity Board & Agent Awareness
       └── Phase 3: Console Mode
  └── Phase 4: Project Lifecycle & Persistence
Phase 5: UI Architecture Cleanup (independent, can start anytime)
```

**Recommended order:** Phase 1 → Phase 5 → Phase 2 → Phase 4 → Phase 3

Phase 5 (UI cleanup) should happen early because it makes all subsequent phases easier to implement. Phase 3 (console mode) is last because it depends on the streaming infrastructure from Phase 2 and project data from Phase 4.

---

## Testing Strategy

### Per-Phase Validation
- [ ] **Phase 1:** Server starts, typed events parse correctly, client receives typed snapshots
- [ ] **Phase 2:** Activity board renders, conflict detection fires on shared files, no false positives
- [ ] **Phase 3:** Console mode renders transcripts, typewriter works, mode switch preserves state
- [ ] **Phase 4:** Projects persist across server restarts, history panel groups correctly
- [ ] **Phase 5:** No regressions — all existing features work after refactor

### Manual Verification
- [ ] Start 2+ Claude Code sessions in same project → verify team auto-detection
- [ ] Open console mode → verify real-time transcript streaming
- [ ] Open activity board → verify file conflict highlighting
- [ ] Kill server, restart → verify project history preserved
- [ ] Switch between office/console/widget modes rapidly → no crashes

### Performance
- [ ] Canvas still 60fps with 10+ agents after state refactor
- [ ] Console mode reduces CPU usage (canvas unmounted)
- [ ] WebSocket message throughput handles 20+ agents without lag

---

## Risks & Considerations

- **Scope creep → orchestrator territory:** We must NOT add agent-to-agent communication, task delegation, or prompt injection. We are a dashboard that provides awareness, not control. If a feature requires modifying how Claude Code agents behave, it's out of scope.

- **Migration risk during Phase 5:** Refactoring state management while adding features is risky. Mitigate by doing Phase 5 first, before any new features.

- **Console mode performance:** Streaming full JSONL transcripts can be expensive. Use virtual scrolling (only render visible lines) and throttle at 200ms batches.

- **localStorage limits:** We currently store layout + seats + preferences in localStorage. Adding project history to localStorage would exceed limits. Use server-side persistence (`~/.agent-office/`) for all data > 1KB.

- **TypeScript path aliases:** `shared/` imports need tsconfig path aliases in both server and client. Vite needs `resolve.alias` config. Test this early.

---

## Acceptance Criteria

- [ ] Typed event protocol used for all WebSocket communication
- [ ] Agent activity (intent, touched files, phase) visible in UI
- [ ] File conflict detection works when 2+ agents touch same file
- [ ] Console mode provides full-screen terminal transcript view
- [ ] Projects tracked across sessions with aggregate metrics
- [ ] Teams auto-detected by shared project directory
- [ ] All existing features (pixel office, tool bubbles, spawn, inspect, search, settings, webhooks) still work
- [ ] No new npm dependencies except Zustand
- [ ] Server startup time < 2s
- [ ] Client bundle size increase < 50KB gzipped

---

## What We're NOT Doing (Explicit Non-Goals)

1. **No orchestrator/delegation engine** — We watch, we don't command
2. **No git worktree management** — That's Claude Code's job (via `--worktree` flag)
3. **No prompt injection into agents** — We don't modify agent behavior
4. **No multi-backend support** — Claude Code only (Codex/Gemini out of scope)
5. **No Tauri/desktop app** — Stays as web app with optional macOS LaunchAgent
6. **No Ably/Telegram channels** — WebSocket only
7. **No rating system** — We don't judge agent output quality
8. **No PixiJS migration** — Stay with Canvas 2D (our rendering is simple enough)
9. **No monorepo restructure** — Keep flat server/ + client/ layout
10. **No authentication/RBAC** — Local tool, single user
