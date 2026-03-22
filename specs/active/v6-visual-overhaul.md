# Agent Office v6 — Visual Overhaul: Illustrated Isometric Style

## Status: Active Build

## Objective

Transform Agent Office from pixel-art sprites to a polished **illustrated isometric** visual style. Think cozy tech studio meets command center — warm lighting, detailed furniture, expressive cartoon characters with smooth animations. The office should feel like a place you'd want to work in.

## Art Direction

### Style Reference
- **NOT pixel art** — smooth illustrated isometric (like Monument Valley meets a cozy indie game)
- **NOT low-poly 3D** — 2D illustrated with subtle depth via shading and layering
- Clean vector-like rendering using Canvas 2D paths and gradients (no pixel grids)
- Soft shadows, rounded edges, warm color palette with cool accent lighting from monitors

### Color Palette
```
Background/Floor:  #2C2C3A (dark cool gray) with subtle wood grain pattern
Walls:             #3D3D4F (slightly lighter) with baseboard detail
Desk surfaces:     #6B5B3A → #8B7B5A (warm wood gradient)
Monitor bezels:    #1A1A2E (near-black) with thin highlight edge
Monitor screens:   #0D1117 (dark) with colored content glow (#4ADE80 green, #60A5FA blue, #F59E0B amber)
Plants:            #22C55E, #16A34A, #15803D (multiple greens for depth)
Warm lighting:     #FCD34D (desk lamps cast warm pools)
Accent:            #818CF8 (purple-blue for UI elements, selected states)
Character skin:    Range of warm tones
Character clothes: Role-coded (see below)
```

### Lighting Model
- Base ambient: dim warm tone across entire office
- Desk lamps: radial gradient warm glow on each occupied desk
- Monitor glow: subtle colored light spill on desk surface and character face
- Window light: optional cool blue-white strip on one wall (time-of-day aware)

## Character Design

### Base Character (replace pixel sprites entirely)
- **Size:** 48x64 canvas units (larger than current 16x24 pixel sprites)
- **Style:** Chibi/cartoon proportions — big head (60% of height), small body
- **Drawn with:** Canvas 2D paths (bezier curves for smooth outlines), NOT pixel arrays
- **Face:** Simple but expressive — dot eyes, small mouth, colored glasses/accessories per role
- **Hair:** 4-5 distinct hairstyles, colored per agent palette

### Role-Based Appearance
| Role | Color Accent | Accessory | Description |
|------|-------------|-----------|-------------|
| Architect | Purple (#818CF8) | Glasses + blueprint roll | Wears collared shirt |
| Builder | Green (#4ADE80) | Headphones | Hoodie, casual |
| Reviewer | Red (#F87171) | Red pen tucked in ear | Vest/formal-ish |
| Tester | Amber (#FBBF24) | Magnifying glass | Lab coat |
| Documenter | Blue (#60A5FA) | Notebook | Sweater |
| Unknown | Gray (#9CA3AF) | None | T-shirt |

### Animation States (all drawn as Canvas paths, frame-interpolated)
1. **Sitting/Typing** — body faces desk, arms move between keyboard positions (2-frame cycle, smooth interpolation)
2. **Sitting/Reading** — leaned back slightly, one hand on chin
3. **Walking** — 4-frame walk cycle with head bob, smooth position interpolation between tiles
4. **Standing/Idle** — weight shift side to side, occasional blink
5. **Meeting** — seated at meeting table, facing center, occasional head nod
6. **Thinking** — standing near whiteboard, hand on chin, thought bubble with "..." 
7. **Stuck** — slumped at desk, "!" above head, red tint on desk lamp
8. **Celebrating** — brief arm raise when task completes (1-second animation)

### Agent Movement Behaviors (NEW)
Currently agents only sit at desks. New behavior:
- **Spawned sub-agents:** Parent agent walks to meeting table, sub-agents spawn there, receive instructions (speech bubbles), then walk to their assigned desks
- **Planning phase:** Agent walks to whiteboard area
- **Testing phase:** Agent walks to a testing station (desk with extra monitors)
- **Stuck/waiting:** Agent stands up, paces near desk or goes to coffee machine
- **Task complete:** Brief celebration animation, then walks to meeting table if parent is waiting

## Furniture & Environment

### Desk Setup (replace flat square desk sprite)
Each desk is a detailed workstation drawn with Canvas paths:
- **L-shaped desk** surface with wood grain (gradient fills)
- **Monitor:** Visible screen with content glow (shows simplified representation of current tool activity)
  - Read/Grep: green scrolling lines
  - Edit/Write: blue code blocks
  - Bash: amber terminal
  - Idle: screensaver/dark
- **Desk lamp:** Visible warm glow (radial gradient), brighter when agent is active
- **Keyboard & mouse:** Small detail items on desk surface
- **Personal items:** Coffee cup, small plant, or sticky notes (randomized per agent)
- **Status LED:** Small colored dot on monitor bezel (green=active, amber=waiting, red=stuck)
- **Chair:** Visible office chair, rotates with agent facing direction

### Meeting Table (NEW)
- Large oval/round table in center of each room
- 4-6 chairs around it
- Used when parent agent briefs sub-agents
- Whiteboard nearby with scribbles (decorative)

### Room Features
- **Bookshelf:** Against back wall, decorative with colored book spines
- **Plants:** 2-3 potted plants per room, different sizes, subtle leaf sway animation
- **Coffee machine:** In corner, agents visit when stuck/waiting
- **Whiteboard:** On wall, shows simplified project name/status
- **Window:** Shows time-of-day sky gradient (morning blue → afternoon warm → evening dark)
- **Rug/carpet:** Under meeting table area, different color per room
- **Ceiling lights:** Subtle overhead fixtures (mostly for visual detail, desk lamps do real lighting)

### Room Theming Per Project
Each project room gets a subtle color theme:
- Different rug color
- Different wall accent strip
- Different plant types
- Project name on a small nameplate by the door

## Rendering Architecture Changes

### Current: Pixel Sprite Arrays
The current system uses `SpriteData` (2D string arrays of hex colors) rendered pixel-by-pixel to canvas. This must be replaced.

### New: Canvas Path Drawing System
Replace the entire sprite system with a procedural Canvas 2D drawing approach:

```typescript
// NEW: Each visual element is a draw function, not a pixel array
interface DrawableElement {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, state: DrawState): void;
  width: number;
  height: number;
  zOffset: number; // for isometric sorting
}

interface DrawState {
  frame: number;        // animation frame (0-1 interpolated)
  facing: Direction;
  isActive: boolean;
  role: AgentRole;
  palette: number;      // color variation index
  tool: string | null;
  phase: AgentPhase;
  glowIntensity: number; // 0-1 for lamp/monitor glow
}
```

### Key Files to Create
| File | Purpose |
|------|---------|
| `client/src/office/draw/character.ts` | Character drawing functions (all states/animations) |
| `client/src/office/draw/desk.ts` | Desk workstation drawing (desk, monitor, lamp, items) |
| `client/src/office/draw/furniture.ts` | Meeting table, bookshelf, plants, coffee machine |
| `client/src/office/draw/room.ts` | Room shell — floor, walls, baseboards, windows, lighting |
| `client/src/office/draw/effects.ts` | Glow effects, shadows, particles (celebration confetti) |
| `client/src/office/draw/palette.ts` | Color palettes, role colors, theme definitions |
| `client/src/office/draw/index.ts` | Exports |

### Key Files to Modify
| File | Changes |
|------|---------|
| `engine/renderer.ts` | Replace sprite rendering with draw-function calls |
| `engine/characters.ts` | Add new states (Meeting, Thinking, Stuck, Celebrating), movement to meeting table/whiteboard/coffee |
| `engine/officeState.ts` | Add meeting table, whiteboard, coffee machine positions |
| `engine/gameLoop.ts` | Add glow/lighting update pass |
| `sprites/spriteData.ts` | Deprecate — keep only as fallback, new system in `draw/` |
| `sprites/spriteCache.ts` | Adapt or deprecate — new system renders directly |
| `layout/furnitureCatalog.ts` | Update furniture definitions to use new draw system |
| `types.ts` | Add new CharacterStates, AgentPhase, room furniture types |

### Isometric Projection (keep existing)
The current tile-based isometric system works. Keep `TILE_SIZE`, grid math, and pathfinding. Just replace what gets drawn at each position.

### Performance Considerations
- Cache complex drawings to offscreen canvases (desk + monitor can be pre-rendered, only update screen content)
- Character sprites: pre-render each frame/direction/role combo to offscreen canvas on first use
- Glow effects: use `globalCompositeOperation = 'lighter'` for additive blending
- Limit glow blur radius — `ctx.filter = 'blur(Npx)'` is expensive, use pre-blurred radial gradients instead

## Implementation Plan

### Phase 1: Drawing Foundation
1. Create `draw/palette.ts` with all color constants and role mappings
2. Create `draw/room.ts` — floor with wood/tile pattern, walls with baseboard, window
3. Create `draw/desk.ts` — L-shaped desk, monitor (with screen states), lamp, chair, personal items
4. Create `draw/furniture.ts` — meeting table, bookshelf, plants, coffee machine, whiteboard
5. Update `layout/furnitureCatalog.ts` to register new furniture with draw functions
6. Update `engine/renderer.ts` to call draw functions instead of sprite blitting

### Phase 2: Character Overhaul
1. Create `draw/character.ts` — full character drawing for all states/directions/roles
2. Implement smooth frame interpolation (lerp between keyframes instead of discrete frames)
3. Add role-based appearance (clothing colors, accessories)
4. Add hair/skin palette variations
5. Update `engine/characters.ts` with new states and movement behaviors

### Phase 3: Lighting & Effects
1. Create `draw/effects.ts` — desk lamp glow, monitor glow, shadow casting
2. Add ambient lighting layer (drawn after furniture, before characters)
3. Add monitor content rendering (simplified tool activity visualization)
4. Add celebration particles (confetti on task complete)
5. Time-of-day window lighting

### Phase 4: Agent Behaviors
1. Meeting table interactions (parent briefs sub-agents)
2. Whiteboard visits during planning phase
3. Coffee machine visits when stuck
4. Pacing animation when waiting for permission
5. Testing station behavior

## Acceptance Criteria
- [ ] No pixel-art sprites visible — everything is smooth illustrated style
- [ ] Characters have role-based clothing and accessories
- [ ] Desks have visible monitors with activity-based screen content
- [ ] Desk lamps cast visible warm glow (radial gradient)
- [ ] Agents walk to meeting table when sub-agents spawn
- [ ] At least 3 furniture types per room (desk, plant, bookshelf minimum)
- [ ] Smooth animation interpolation (no jarring frame jumps)
- [ ] 60fps maintained with 10+ agents on screen
- [ ] All existing functionality preserved (spawn, kill, inspect, search, tool bubbles, connection lines)
- [ ] Dark mode and light mode both look polished

## What NOT to Change
- Server-side code (watcher, parser, agentManager, WebSocket protocol)
- TopBar, InspectPanel, SettingsModal, SpawnDialog (UI panels stay the same)
- Keyboard shortcuts
- ToolOverlay speech bubble system (keep, just style it prettier)
- Connection lines between parent/sub-agents (keep, style update)
- Minimap (keep, update to reflect new visuals)
- Widget mode (keep as-is)
