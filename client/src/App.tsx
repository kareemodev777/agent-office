import { useCallback, useRef, useState, useEffect } from 'react';

import { BottomToolbar } from './components/BottomToolbar.js';
import { ContextMenu } from './components/ContextMenu.js';
import { DebugView } from './components/DebugView.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { InspectPanel } from './components/InspectPanel.js';
import { Minimap } from './components/Minimap.js';
import { SearchPanel } from './components/SearchPanel.js';
import { ShortcutsHelp } from './components/ShortcutsHelp.js';
import { SpawnDialog } from './components/SpawnDialog.js';
import { TopBar } from './components/TopBar.js';
import { WidgetMode } from './components/WidgetMode.js';
import { ZoomControls } from './components/ZoomControls.js';
import { PULSE_ANIMATION_DURATION_SEC } from './constants.js';
import { useEditorActions } from './hooks/useEditorActions.js';
import { useEditorKeyboard } from './hooks/useEditorKeyboard.js';
import { useExtensionMessages } from './hooks/useExtensionMessages.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { ConnectionLines } from './office/components/ConnectionLines.js';
import { OfficeCanvas } from './office/components/OfficeCanvas.js';
import { ToolOverlay } from './office/components/ToolOverlay.js';
import { EditorState } from './office/editor/editorState.js';
import { EditorToolbar } from './office/editor/EditorToolbar.js';
import { OfficeState } from './office/engine/officeState.js';
import { isRotatable } from './office/layout/furnitureCatalog.js';
import { EditTool } from './office/types.js';
import { transport } from './transport.js';

const WIDGET_MODE_KEY = 'agent-office-widget-mode';
const MINIMAP_KEY = 'agent-office-minimap';

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
  fontSize: 'var(--text-lg)',
  background: 'var(--btn-bg)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
};

const actionBarBtnDisabled: React.CSSProperties = {
  ...actionBarBtnStyle,
  opacity: 'var(--btn-disabled-opacity)',
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
        zIndex: 'var(--z-controls)',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '4px 8px',
        boxShadow: 'var(--shadow-md)',
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
          <span style={{ fontSize: 'var(--text-lg)', color: 'var(--red)' }}>Reset?</span>
          <button
            style={{ ...actionBarBtnStyle, background: 'var(--red)', color: '#fff' }}
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
    totalCost,
    closedSessions,
    textPreviews,
    systemStats,
  } = useExtensionMessages(getOfficeState, editor.setLastSavedLayout, isEditDirty);

  const [isDebugMode, setIsDebugMode] = useState(false);
  const handleToggleDebugMode = useCallback(() => setIsDebugMode((prev) => !prev), []);
  const [inspectAgentId, setInspectAgentId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agentId: number } | null>(null);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMinimap, setShowMinimap] = useState(() => {
    try { return localStorage.getItem(MINIMAP_KEY) !== 'false'; } catch { return true; }
  });
  const [isWidgetMode, setIsWidgetMode] = useState(() => {
    try { return localStorage.getItem(WIDGET_MODE_KEY) === 'true'; } catch { return false; }
  });
  const [showSearch, setShowSearch] = useState(false);

  const handleSelectAgent = useCallback((_id: number) => {
    // No-op in standalone (no terminal to focus)
  }, []);

  const handleToggleMinimap = useCallback(() => {
    setShowMinimap((prev) => {
      const next = !prev;
      try { localStorage.setItem(MINIMAP_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleToggleWidget = useCallback(() => {
    setIsWidgetMode((prev) => {
      const next = !prev;
      try { localStorage.setItem(WIDGET_MODE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    isEditMode: editor.isEditMode,
    onKillSelected: useCallback(() => {
      const os = getOfficeState();
      const id = os.selectedAgentId;
      if (id !== null && id >= 0 && confirm('Kill this agent?')) {
        transport.postMessage({ type: 'killAgent', id });
      }
    }, []),
    onToggleInspect: useCallback(() => {
      const os = getOfficeState();
      const id = os.selectedAgentId;
      if (id !== null) {
        setInspectAgentId((prev) => (prev === id ? null : id));
      }
    }, []),
    onOpenSpawn: useCallback(() => setShowSpawnDialog(true), []),
    onClosePanel: useCallback(() => {
      if (showSearch) { setShowSearch(false); return; }
      if (showShortcuts) { setShowShortcuts(false); return; }
      if (showSpawnDialog) { setShowSpawnDialog(false); return; }
      if (inspectAgentId !== null) { setInspectAgentId(null); return; }
      if (contextMenu) { setContextMenu(null); return; }
      const os = getOfficeState();
      os.selectedAgentId = null;
    }, [showSearch, showShortcuts, showSpawnDialog, inspectAgentId, contextMenu]),
    onSelectByIndex: useCallback((index: number) => {
      if (index < agents.length) {
        const id = agents[index];
        const os = getOfficeState();
        os.selectedAgentId = id;
      }
    }, [agents]),
    onShowHelp: useCallback(() => setShowShortcuts((v) => !v), []),
    onToggleMinimap: handleToggleMinimap,
    onToggleWidget: handleToggleWidget,
    onOpenSearch: useCallback(() => setShowSearch((v) => !v), []),
  });

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

  const handleCenterAgent = useCallback((agentId: number) => {
    const os = getOfficeState();
    os.selectedAgentId = agentId;
    // Don't auto-pan camera — user can zoom/scroll manually
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

  // Widget mode
  if (isWidgetMode) {
    return (
      <WidgetMode
        agents={agents}
        agentInfos={agentInfos}
        agentTools={agentTools}
        totalCost={totalCost}
        onInspect={(id) => {
          setInspectAgentId(id);
          setIsWidgetMode(false);
          try { localStorage.setItem(WIDGET_MODE_KEY, 'false'); } catch { /* ignore */ }
        }}
        onExit={() => {
          setIsWidgetMode(false);
          try { localStorage.setItem(WIDGET_MODE_KEY, 'false'); } catch { /* ignore */ }
        }}
      />
    );
  }

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
        @keyframes empty-state-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .empty-state-pulse { animation: empty-state-bob 3s ease-in-out infinite; }
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

      {/* Top stats bar */}
      {!editor.isEditMode && (
        <TopBar
          activeAgents={stats.activeAgents}
          toolsRunning={stats.toolsRunning}
          sessionsToday={stats.sessionsToday}
          totalCost={totalCost}
          agentInfos={agentInfos}
          systemStats={systemStats}
        />
      )}

      {/* Search panel */}
      {showSearch && (
        <SearchPanel
          onClose={() => setShowSearch(false)}
          onInspect={(id) => {
            setInspectAgentId(id);
            setShowSearch(false);
            const os = getOfficeState();
            os.selectedAgentId = id;
            os.cameraFollowId = id;
          }}
        />
      )}

      {/* Connection status indicator */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 'var(--z-controls)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#30D158' : '#666',
            boxShadow: connected ? '0 0 6px #30D158' : 'none',
          }}
        />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
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
        onShowHistory={() => setShowHistory(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onToggleWidget={handleToggleWidget}
      />

      {/* Aggregate cost bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          zIndex: 'var(--z-controls)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 10px',
          boxShadow: 'var(--shadow-sm)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ color: '#BF5AF2' }}>Total: ~${totalCost.toFixed(2)} today</span>
      </div>

      {/* Minimap */}
      {showMinimap && !editor.isEditMode && agents.length > 0 && (
        <Minimap
          officeState={officeState}
          agents={agents}
          agentInfos={agentInfos}
          zoom={editor.zoom}
          panRef={editor.panRef}
          containerRef={containerRef}
          onCenterAgent={handleCenterAgent}
        />
      )}

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
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 'var(--text-base)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
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

      <ConnectionLines
        officeState={officeState}
        containerRef={containerRef}
        zoom={editor.zoom}
        panRef={editor.panRef}
        agentInfos={agentInfos}
      />

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
        textPreviews={textPreviews}
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

      {/* Empty state message */}
      {agents.length === 0 && !editor.isEditMode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 45,
          }}
        >
          <div
            className="empty-state-pulse"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              padding: '16px 24px',
              textAlign: 'center',
              maxWidth: 380,
            }}
          >
            <div style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 8 }}>
              No agents running
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Click <b>Spawn</b> or start Claude Code in a project
            </div>
          </div>
        </div>
      )}

      {/* Spawn dialog */}
      {showSpawnDialog && (
        <SpawnDialog
          onSpawn={handleSpawnAgent}
          onClose={() => setShowSpawnDialog(false)}
        />
      )}
      {/* History panel */}
      {showHistory && (
        <HistoryPanel
          agents={agents}
          agentInfos={agentInfos}
          closedSessions={closedSessions}
          onClose={() => setShowHistory(false)}
          onInspect={(id) => {
            setInspectAgentId(id);
            const os = getOfficeState();
            os.selectedAgentId = id;
          }}
        />
      )}

      {/* Shortcuts help */}
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

export default App;
