# Agent Office Improvements - Feature Spec

## Overview
Add coordination, task management, activity tracking, console mode, and persistence improvements to the agent-office project, inspired by bit-office organizational features while maintaining our unique pixel-art visualization.

## Feature 1: Multi-Agent Coordination Layer

### Server: `server/coordination.ts`
- Track which agents share the same project (by `projectPath`)
- Track files being touched per agent (extracted from Read/Edit/Write tool statuses)
- Detect file conflicts: two agents editing the same file simultaneously
- Broadcast coordination events to clients

### New Message Types
- `coordinationUpdate`: { projectGroups: { projectPath, agentIds, conflicts[] } }
- `fileConflict`: { file, agentIds[], projectPath }

### Data Model
```typescript
interface ProjectGroup {
  projectPath: string;
  agentIds: number[];
  activeFiles: Map<number, Set<string>>; // agentId → files being touched
  conflicts: FileConflict[];
}

interface FileConflict {
  file: string;
  agentIds: number[];
  detectedAt: number;
}
```

## Feature 2: Enhanced Task Management

### Server: `server/taskTracker.ts`
- Parse JSONL for task phase signals from tool usage patterns
- Phases: `exploring` → `planning` → `coding` → `testing` → `reviewing` → `idle`
- Phase detection based on tool patterns:
  - exploring: Read, Grep, Glob heavy
  - planning: EnterPlanMode, text-heavy output
  - coding: Edit, Write heavy
  - testing: Bash with test commands
  - reviewing: Read after coding phase
  - idle: waiting state

### New Message Types
- `agentPhaseUpdate`: { id, phase, progress, filesModified, filesRead }

## Feature 3: Activity Board

### Client: `client/src/components/ActivityBoard.tsx`
- Real-time scrolling feed of agent activities
- Shows: agent name, tool, file, timestamp
- Filterable by agent, project, tool type
- Collapsible per-agent sections
- Color-coded by activity type

## Feature 4: Console Mode

### Client: `client/src/components/ConsoleMode.tsx`
- Terminal-style monospace display
- Shows all agent activity as log lines
- Format: `[HH:MM:SS] [agent-name] [phase] action details`
- Auto-scroll with pause-on-hover
- Toggle between office view and console

## Feature 5: Project Persistence

### Server: Enhanced `server/persistence.ts`
- Track active project sessions with full state
- Store file activity history per project
- Resume state on restart (last known agent positions)

### Data Model Addition
```typescript
interface ProjectHistory {
  projectPath: string;
  lastSeen: number;
  totalSessions: number;
  totalCost: number;
  recentFiles: string[];
}
```

## Implementation Order
1. Coordination layer (server) - foundation for everything else
2. Task tracker (server) - phase detection
3. Activity Board (client) - visual feed
4. Console Mode (client) - alternative view
5. Persistence improvements (server)

## Files to Create
- `server/coordination.ts`
- `server/taskTracker.ts`
- `client/src/components/ActivityBoard.tsx`
- `client/src/components/ConsoleMode.tsx`

## Files to Modify
- `server/index.ts` - integrate coordination + task tracker
- `server/parser.ts` - extract file paths for coordination
- `server/types.ts` - add new fields to AgentState
- `server/persistence.ts` - add project history
- `client/src/hooks/useExtensionMessages.ts` - handle new message types
- `client/src/App.tsx` - add Activity Board + Console Mode toggles
- `client/src/components/BottomToolbar.tsx` - add new toggle buttons
