# Agent Office

A real-time dashboard that visualizes AI coding agents as pixel-art characters working in a virtual office. Watch your Claude Code sessions come alive — agents sit at desks, use tools, spawn sub-agents, and collaborate across projects.

![Agent Office](https://img.shields.io/badge/version-5.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6) ![React](https://img.shields.io/badge/React-19-61DAFB) ![Node.js](https://img.shields.io/badge/Node.js-22-339933)

## What It Does

Agent Office monitors Claude Code JSONL session files in real-time and renders each active session as an animated character in an isometric pixel-art office. You get:

- **Live activity tracking** — see which tools each agent is using right now
- **Session names** — agents show their Claude Code session slug (e.g., "vivid-herding-church")
- **Project grouping** — each agent displays which project folder they're working in
- **Role detection** — automatically identifies Architect, Builder, Reviewer, Tester roles from Task descriptions
- **Token & cost tracking** — real-time token counts and estimated costs per agent
- **Sub-agent visualization** — when a Task tool spawns sub-agents, they appear as separate characters with connection lines to their parent
- **Kill, spawn, and search** — manage agents directly from the dashboard

## Quick Start

```bash
# Clone and install
git clone https://github.com/kareemodev777/agent-office.git
cd agent-office
npm install

# Run in development mode
npm run dev
```

Open **http://localhost:5173** in your browser. Start a Claude Code session in any project and watch the agent appear.

## Features

### Dashboard
- **Top bar** — active agents, running tools, sessions today, total cost
- **Office canvas** — isometric pixel-art rooms with animated characters
- **Speech bubbles** — current tool activity and text previews above each agent
- **Minimap** — scaled-down office view (toggle with `M`)
- **Widget mode** — compact list view for minimal screen usage (toggle with `W`)

### Agent Management
- **Spawn** — launch new Claude Code sessions from the dashboard with project presets
- **Kill** — terminate agents via right-click context menu
- **Inspect** — click any agent for a live activity log with auto-scroll
- **Search** — search across all agent transcripts (`/` or `Ctrl+F`)
- **History** — view all sessions from today, including finished ones

### Tracking
- **Token counts** — input, output, and cache tokens from Claude's usage data
- **Cost estimates** — approximate cost using Opus pricing
- **Time tracking** — how long each agent has been running
- **Git branch** — which branch each agent is working on

### Notifications
- **Browser notifications** — OS-level alerts when agents finish or need attention
- **Sound alerts** — customizable chimes for different events (done, permission, stuck, spawn)
- **Stuck detection** — warns when an agent hasn't updated in 60 seconds
- **Webhook support** — POST to Discord/Slack on agent events

### Customization
- **Dark/Light theme** — toggle in Settings
- **Sound controls** — per-event toggles and volume slider
- **Office layout editor** — rearrange rooms, desks, and furniture
- **Persistent data** — session history and settings saved to `~/.agent-office/data.json`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Open spawn dialog |
| `I` | Toggle inspect panel |
| `K` | Kill selected agent |
| `M` | Toggle minimap |
| `W` | Toggle widget mode |
| `/` | Search transcripts |
| `?` | Show shortcuts help |
| `Esc` | Close any panel |
| `1-9` | Select agent by index |

## Architecture

```
agent-office/
├── server/                  # Node.js backend
│   ├── index.ts             # Express + WebSocket server
│   ├── agentManager.ts      # Agent lifecycle, snapshots, subscriptions
│   ├── parser.ts            # JSONL line parsing, tool tracking
│   ├── watcher.ts           # Chokidar file watcher for ~/.claude/projects
│   ├── persistence.ts       # Save/load session data
│   ├── webhooks.ts          # Discord/Slack webhook notifications
│   ├── timerManager.ts      # Waiting/permission timers
│   ├── types.ts             # TypeScript types
│   └── constants.ts         # Timing constants
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── App.tsx           # Main app component
│       ├── transport.ts      # WebSocket client
│       ├── notifications.ts  # Browser notification API
│       ├── components/       # UI panels and controls
│       │   ├── TopBar.tsx
│       │   ├── BottomToolbar.tsx
│       │   ├── InspectPanel.tsx
│       │   ├── SettingsModal.tsx
│       │   ├── SpawnDialog.tsx
│       │   ├── HistoryPanel.tsx
│       │   ├── SearchPanel.tsx
│       │   ├── ContextMenu.tsx
│       │   ├── WidgetMode.tsx
│       │   ├── Minimap.tsx
│       │   └── ...
│       ├── office/           # Canvas rendering engine
│       │   ├── engine/       # Game loop, state, renderer
│       │   ├── components/   # ToolOverlay, ConnectionLines
│       │   ├── sprites/      # Pixel-art character sprites
│       │   └── layout/       # Room/furniture layout system
│       └── hooks/            # React hooks
│           ├── useExtensionMessages.ts
│           └── useKeyboardShortcuts.ts
└── scripts/
    ├── install-service.sh    # Install as macOS LaunchAgent
    ├── uninstall-service.sh  # Remove LaunchAgent
    └── open-app.sh           # Open in Chrome app mode
```

## How It Works

1. **Watcher** monitors `~/.claude/projects/` for new/updated JSONL files
2. **Parser** processes each line — extracts tools, tokens, session metadata, roles
3. **AgentManager** maintains agent state, tracks sub-agents, detects stuck agents
4. **WebSocket server** broadcasts real-time updates to connected clients
5. **React client** renders the office canvas with animated pixel-art characters
6. **ToolOverlay** shows speech bubbles with current activity above each character

## Install as Service (Auto-Start)

```bash
# Install — runs on boot, restarts on crash
npm run install-service

# Open in Chrome app mode (no browser chrome)
npm run app

# Uninstall
npm run uninstall-service
```

The service runs at **http://localhost:3737** and serves the built client.

## Configuration

### Webhook (Discord/Slack)
Set in Settings modal or via environment variable:
```bash
AGENT_OFFICE_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Data Storage
Session history and settings persist at `~/.agent-office/data.json`.

## Tech Stack

- **Server**: Node.js, Express, WebSocket (ws), Chokidar
- **Client**: React 19, TypeScript, Vite, HTML5 Canvas
- **Rendering**: Custom isometric pixel-art engine with sprite animation
- **Styling**: CSS variables with dark/light theme support, frosted glass UI

## Development

```bash
# Run dev server (hot reload)
npm run dev

# Type check
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# Build for production
npm run build
```

## Version History

| Version | Features |
|---------|----------|
| v1 | Base pixel-art office, JSONL watcher, WebSocket |
| v2 | Live logs, session names, role colors, cost tracking, kill/spawn |
| v3 | Themes, keyboard shortcuts, history, bigger office, connection lines |
| v4 | Auto-start service, OS notifications, minimap, persistence, widget, search, webhooks |
| v5 | Modern UI redesign — Apple-inspired typography, frosted glass panels |

## License

MIT
