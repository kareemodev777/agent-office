import { useCallback, useRef, useState, useEffect } from 'react';

import { BottomToolbar } from './components/BottomToolbar.js';
import { ContextMenu } from './components/ContextMenu.js';
import { DebugView } from './components/DebugView.js';
import { InspectPanel } from './components/InspectPanel.js';
import { SpawnDialog } from './components/SpawnDialog.js';
import { TopBar } from './components/TopBar.js';
import { ZoomControls } from './components/ZoomControls.js';
import { PULSE_ANIMATION_DURATION_SEC } from './constants.js';
import { useEditorActions } from './hooks/useEditorActions.js';
import { useEditorKeyboard } from './hooks/useEditorKeyboard.js';
import { useExtensionMessages } from './hooks/useExtensionMessages.js';
import { OfficeCanvas } from './office/components/OfficeCanvas.js';
import { ToolOverlay } from './office/components/ToolOverlay.js';
import { EditorState } from './office/editor/editorState.js';
import { EditorToolbar } from './office/editor/EditorToolbar.js';
import { OfficeState } from './office/engine/officeState.js';
import { isRotatable } from './office/layout/furnitureCatalog.js';
import { EditTool } from './office/types.js';
import { transport } from './transport.js';

const officeStateRef = { current: null as OfficeState | null };
const editorState = new EditorState();

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState();
  }
  return officeStateRef.current;
}

const actionBarBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '22px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text-dim)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
};

const actionBarBtnDisabled: React.CSSProperties = {
  ...actionBarBtnStyle,
  opacity: 'var(--pixel-btn-disabled-opacity)',
  cursor: 'default',
};

function EditActionBar({
  editor,
  editorState: es,
}: {
  editor: ReturnType<typeof useEditorActions>;
  editorState: EditorState;
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const undoDisabled = es.undoStack.length === 0;
  const redoDisabled = es.redoStack.length === 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--pixel-controls-z)',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border)',
        borderRadius: 0,
        padding: '4px 8px',
        boxShadow: 'var(--pixel-shadow)',
      }}
    >
      <button
        style={undoDisabled ? actionBarBtnDisabled : actionBarBtnStyle}
        onClick={undoDisabled ? undefined : editor.handleUndo}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        style={redoDisabled ? actionBarBtnDisabled : actionBarBtnStyle}
        onClick={redoDisabled ? undefined : editor.handleRedo}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>
      <button style={actionBarBtnStyle} onClick={editor.handleSave} title="Save layout">
        Save
      </button>
      {!showResetConfirm ? (
        <button
          style={actionBarBtnStyle}
          onClick={() => setShowResetConfirm(true)}
          title="Reset to last saved layout"
        >
          Reset
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: '22px', color: 'var(--pixel-reset-text)' }}>Reset?</span>
          <button
            style={{ ...actionBarBtnStyle, background: 'var(--pixel-danger-bg)', color: '#fff' }}
            onClick={() => {
              setShowResetConfirm(false);
              editor.handleReset();
            }}
          >
            Yes
          </button>
          <button style={actionBarBtnStyle} onClick={() => setShowResetConfirm(false)}>
            No
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const editor = useEditorActions(getOfficeState, editorState);
  const [connected, setConnected] = useState(transport.connected);

  useEffect(() => {
    transport.onConnectionChange(setConnected);
  }, []);

  const isEditDirty = useCallback(
    () => editor.isEditMode && editor.isDirty,
    [editor.isEditMode, editor.isDirty],
  );

  const {
    agents,
    agentInfos,
    selectedAgent,
    agentTools,
    agentStatuses,
    subagentTools,
    subagentCharacters,
    layoutReady,
    loadedAssets,
    workspaceFolders,
    stats,
    stuckAgents,
  } = useExtensionMessages(getOfficeState, editor.setLastSavedLayout, isEditDirty);

  const [isDebugMode, setIsDebugMode] = useState(false);
  const handleToggleDebugMode = useCallback(() => setIsDebugMode((prev) => !prev), []);
  const [inspectAgentId, setInspectAgentId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agentId: number } | null>(null);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);

  const handleSelectAgent = useCallback((_id: number) => {
    // No-op in standalone (no terminal to focus)
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const [editorTickForKeyboard, setEditorTickForKeyboard] = useState(0);
  useEditorKeyboard(
    editor.isEditMode,
    editorState,
    editor.handleDeleteSelected,
    editor.handleRotateSelected,
    editor.handleToggleState,
    editor.handleUndo,
    editor.handleRedo,
    useCallback(() => setEditorTickForKeyboard((n) => n + 1), []),
    editor.handleToggleEditMode,
  );

  const handleCloseAgent = useCallback((id: number) => {
    transport.postMessage({ type: 'closeAgent', id });
  }, []);

  const handleClick = useCallback((agentId: number) => {
    const os = getOfficeState();
    const meta = os.subagentMeta.get(agentId);
    const focusId = meta ? meta.parentAgentId : agentId;
    os.selectedAgentId = focusId;
    setInspectAgentId(focusId);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const os = getOfficeState();
    // Find character at click position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    const layout = os.getLayout();
    const canvasW = Math.round(rect.width * dpr);
    const canvasH = Math.round(rect.height * dpr);
    const zoom = editor.zoom;
    const mapW = layout.cols * 16 * zoom;
    const mapH = layout.rows * 16 * zoom;
    const offsetX = Math.floor((canvasW - mapW) / 2) + Math.round(editor.panRef.current.x);
    const offsetY = Math.floor((canvasH - mapH) / 2) + Math.round(editor.panRef.current.y);
    const worldX = ((e.clientX - rect.left) * dpr - offsetX) / zoom;
    const worldY = ((e.clientY - rect.top) * dpr - offsetY) / zoom;
    const charId = os.getCharacterAt(worldX, worldY);
    if (charId !== null && charId >= 0) {
      setContextMenu({ x: e.clientX, y: e.clientY, agentId: charId });
    }
  }, [editor.zoom, editor.panRef]);

  const handleKillAgent = useCallback((id: number) => {
    transport.postMessage({ type: 'killAgent', id });
  }, []);

  const handleCopyTranscript = useCallback((id: number) => {
    transport.postMessage({ type: 'getTranscript', id });
    const unsub = transport.onMessage((msg: Record<string, unknown>) => {
      if (msg.type === 'transcript' && msg.id === id) {
        navigator.clipboard.writeText(msg.content as string).catch(() => {});
        unsub();
      }
    });
    setTimeout(unsub, 5000);
  }, []);

  const handleSpawnAgent = useCallback((cwd: string, prompt: string) => {
    transport.postMessage({ type: 'spawnAgent', cwd, prompt });
  }, []);

  const officeState = getOfficeState();
  void editorTickForKeyboard;

  const showRotateHint =
    editor.isEditMode &&
    (() => {
      if (editorState.selectedFurnitureUid) {
        const item = officeState
          .getLayout()
          .furniture.find((f) => f.uid === editorState.selectedFurnitureUid);
        if (item && isRotatable(item.type)) return true;
      }
      if (
        editorState.activeTool === EditTool.FURNITURE_PLACE &&
        isRotatable(editorState.selectedFurnitureType)
      ) {
        return true;
      }
      return false;
    })();

  const inspectInfo = inspectAgentId !== null ? agentInfos[inspectAgentId] : undefined;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      onContextMenu={handleContextMenu}
    >
      <style>{`
        @keyframes pixel-agents-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .pixel-agents-pulse { animation: pixel-agents-pulse ${PULSE_ANIMATION_DURATION_SEC}s ease-in-out infinite; }
      `}</style>

      <OfficeCanvas
        officeState={officeState}
        onClick={handleClick}
        isEditMode={editor.isEditMode}
        editorState={editorState}
        onEditorTileAction={editor.handleEditorTileAction}
        onEditorEraseAction={editor.handleEditorEraseAction}
        onEditorSelectionChange={editor.handleEditorSelectionChange}
        onDeleteSelected={editor.handleDeleteSelected}
        onRotateSelected={editor.handleRotateSelected}
        onDragMove={editor.handleDragMove}
        editorTick={editor.editorTick}
        zoom={editor.zoom}
        onZoomChange={editor.handleZoomChange}
        panRef={editor.panRef}
      />

      <ZoomControls zoom={editor.zoom} onZoomChange={editor.handleZoomChange} />

      {/* Vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--pixel-vignette)',
          pointerEvents: 'none',
          zIndex: 40,
        }}
      />

      {/* Top stats bar */}
      {!editor.isEditMode && (
        <TopBar
          activeAgents={stats.activeAgents}
          toolsRunning={stats.toolsRunning}
          sessionsToday={stats.sessionsToday}
        />
      )}

      {/* Connection status indicator */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 'var(--pixel-controls-z)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          padding: '4px 8px',
          boxShadow: 'var(--pixel-shadow)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#5ac88c' : '#666',
            boxShadow: connected ? '0 0 6px #5ac88c' : 'none',
          }}
        />
        <span style={{ fontSize: '18px', color: 'var(--pixel-text-dim)' }}>
          {connected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>

      <BottomToolbar
        isEditMode={editor.isEditMode}
        onOpenClaude={editor.handleOpenClaude}
        onToggleEditMode={editor.handleToggleEditMode}
        isDebugMode={isDebugMode}
        onToggleDebugMode={handleToggleDebugMode}
        workspaceFolders={workspaceFolders}
        onSpawnAgent={() => setShowSpawnDialog(true)}
      />

      {/* Status bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          zIndex: 'var(--pixel-controls-z)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border)',
          padding: '4px 10px',
          boxShadow: 'var(--pixel-shadow)',
          fontSize: '20px',
          color: 'var(--pixel-text-dim)',
        }}
      >
        <span>{agents.length} active</span>
        <span style={{ color: 'var(--pixel-border-light)' }}>|</span>
        <span>{stats.sessionsToday} today</span>
      </div>

      {editor.isEditMode && editor.isDirty && (
        <EditActionBar editor={editor} editorState={editorState} />
      )}

      {showRotateHint && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: editor.isDirty ? 'translateX(calc(-50% + 100px))' : 'translateX(-50%)',
            zIndex: 49,
            background: 'var(--pixel-hint-bg)',
            color: '#fff',
            fontSize: '20px',
            padding: '3px 8px',
            borderRadius: 0,
            border: '2px solid var(--pixel-accent)',
            boxShadow: 'var(--pixel-shadow)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Press <b>R</b> to rotate
        </div>
      )}

      {editor.isEditMode &&
        (() => {
          const selUid = editorState.selectedFurnitureUid;
          const selColor = selUid
            ? (officeState.getLayout().furniture.find((f) => f.uid === selUid)?.color ?? null)
            : null;
          return (
            <EditorToolbar
              activeTool={editorState.activeTool}
              selectedTileType={editorState.selectedTileType}
              selectedFurnitureType={editorState.selectedFurnitureType}
              selectedFurnitureUid={selUid}
              selectedFurnitureColor={selColor}
              floorColor={editorState.floorColor}
              wallColor={editorState.wallColor}
              onToolChange={editor.handleToolChange}
              onTileTypeChange={editor.handleTileTypeChange}
              onFloorColorChange={editor.handleFloorColorChange}
              onWallColorChange={editor.handleWallColorChange}
              onSelectedFurnitureColorChange={editor.handleSelectedFurnitureColorChange}
              onFurnitureTypeChange={editor.handleFurnitureTypeChange}
              loadedAssets={loadedAssets}
            />
          );
        })()}

      <ToolOverlay
        officeState={officeState}
        agents={agents}
        agentTools={agentTools}
        agentInfos={agentInfos}
        subagentCharacters={subagentCharacters}
        containerRef={containerRef}
        zoom={editor.zoom}
        panRef={editor.panRef}
        onCloseAgent={handleCloseAgent}
        stuckAgents={stuckAgents}
      />

      {isDebugMode && (
        <DebugView
          agents={agents}
          selectedAgent={selectedAgent}
          agentTools={agentTools}
          agentStatuses={agentStatuses}
          subagentTools={subagentTools}
          onSelectAgent={handleSelectAgent}
        />
      )}

      {inspectAgentId !== null && (
        <InspectPanel
          agentId={inspectAgentId}
          agentLabel={inspectInfo?.label}
          agentRole={inspectInfo?.role}
          onClose={() => {
            setInspectAgentId(null);
            transport.postMessage({ type: 'unsubscribeAgent', id: inspectAgentId });
          }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Inspect',
              action: () => setInspectAgentId(contextMenu.agentId),
            },
            {
              label: 'Copy Transcript',
              action: () => handleCopyTranscript(contextMenu.agentId),
            },
            {
              label: 'Kill Agent',
              action: () => handleKillAgent(contextMenu.agentId),
              danger: true,
            },
          ]}
        />
      )}

      {/* Spawn dialog */}
      {showSpawnDialog && (
        <SpawnDialog
          onSpawn={handleSpawnAgent}
          onClose={() => setShowSpawnDialog(false)}
        />
      )}
    </div>
  );
}

export default App;
