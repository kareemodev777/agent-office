import { useEffect, useCallback } from 'react';

interface KeyboardShortcutHandlers {
  onKillSelected?: () => void;
  onToggleInspect?: () => void;
  onOpenSpawn?: () => void;
  onClosePanel?: () => void;
  onSelectByIndex?: (index: number) => void;
  onShowHelp?: () => void;
  onToggleMinimap?: () => void;
  onToggleWidget?: () => void;
  onOpenSearch?: () => void;
  isEditMode: boolean;
}

export function useKeyboardShortcuts({
  onKillSelected,
  onToggleInspect,
  onOpenSpawn,
  onClosePanel,
  onSelectByIndex,
  onShowHelp,
  onToggleMinimap,
  onToggleWidget,
  onOpenSearch,
  isEditMode,
}: KeyboardShortcutHandlers): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Don't capture in edit mode (editor has its own shortcuts)
      if (isEditMode) return;

      // Ctrl+F or / to open search (with modifier)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // Don't capture with modifiers (except for ?)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'k':
        case 'K':
          e.preventDefault();
          onKillSelected?.();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          onToggleInspect?.();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          onOpenSpawn?.();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMinimap?.();
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          onToggleWidget?.();
          break;
        case '/':
          e.preventDefault();
          onOpenSearch?.();
          break;
        case 'Escape':
          e.preventDefault();
          onClosePanel?.();
          break;
        case '?':
          e.preventDefault();
          onShowHelp?.();
          break;
        default:
          // Number keys 1-9
          if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            onSelectByIndex?.(parseInt(e.key, 10) - 1);
          }
          break;
      }
    },
    [onKillSelected, onToggleInspect, onOpenSpawn, onClosePanel, onSelectByIndex, onShowHelp, onToggleMinimap, onToggleWidget, onOpenSearch, isEditMode],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
