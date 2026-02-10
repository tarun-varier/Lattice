import { useEffect, useRef, useCallback } from 'react';
import { getHostBridge } from '../lib/host-bridge';
import { useLayoutStore } from '../stores/layout-store';
import { useProjectStore } from '../stores/project-store';
import { useContextStore } from '../stores/context-store';
import { useGenerationStore } from '../stores/generation-store';
import { useUiStore } from '../stores/ui-store';
import { notify } from '../stores/notification-store';
import type { LatticeProject } from '@shared/types';
import type { ResponseMessage } from '@shared/protocol';

/**
 * Serializable snapshot of all webview state for persistence.
 */
interface WebviewState {
  boxes: ReturnType<typeof useLayoutStore.getState>['boxes'];
  pages: ReturnType<typeof useProjectStore.getState>['pages'];
  sharedComponents: ReturnType<typeof useProjectStore.getState>['sharedComponents'];
  context: ReturnType<typeof useContextStore.getState>['context'];
  isSetupComplete: boolean;
  results: ReturnType<typeof useGenerationStore.getState>['results'];
  activePageId: string;
  selectedBoxId: string | null;
}

function gatherState(): WebviewState {
  return {
    boxes: useLayoutStore.getState().boxes,
    pages: useProjectStore.getState().pages,
    sharedComponents: useProjectStore.getState().sharedComponents,
    context: useContextStore.getState().context,
    isSetupComplete: useContextStore.getState().isSetupComplete,
    results: useGenerationStore.getState().results,
    activePageId: useUiStore.getState().activePageId,
    selectedBoxId: useUiStore.getState().selectedBoxId,
  };
}

function restoreState(state: WebviewState) {
  if (state.boxes) {
    useLayoutStore.setState({ boxes: state.boxes });
  }
  if (state.pages) {
    useProjectStore.setState({ pages: state.pages });
  }
  if (state.sharedComponents) {
    useProjectStore.setState({ sharedComponents: state.sharedComponents });
  }
  if (state.context) {
    useContextStore.setState({ context: state.context });
  }
  if (state.isSetupComplete !== undefined) {
    useContextStore.setState({ isSetupComplete: state.isSetupComplete });
  }
  if (state.results) {
    useGenerationStore.setState({ results: state.results });
  }
  if (state.activePageId) {
    useUiStore.setState({ activePageId: state.activePageId });
  }
  if (state.selectedBoxId !== undefined) {
    useUiStore.setState({ selectedBoxId: state.selectedBoxId });
  }
}

function toLatticeProject(): LatticeProject {
  const context = useContextStore.getState().context;
  const pages = useProjectStore.getState().pages;
  const boxes = useLayoutStore.getState().boxes;
  const sharedComponents = useProjectStore.getState().sharedComponents;
  const generations = useGenerationStore.getState().results;

  return {
    id: context.name.toLowerCase().replace(/\s+/g, '-') || 'untitled',
    context,
    pages,
    boxes,
    sharedComponents,
    generations,
  };
}

function fromLatticeProject(project: LatticeProject) {
  useContextStore.setState({
    context: project.context,
    isSetupComplete: true,
  });
  useProjectStore.setState({
    pages: project.pages,
    sharedComponents: project.sharedComponents,
  });
  useLayoutStore.setState({ boxes: project.boxes });
  useGenerationStore.setState({ results: project.generations });

  // Set the active page to the first page
  if (project.pages.length > 0) {
    useUiStore.setState({ activePageId: project.pages[0].id });
  }
}

const AUTO_SAVE_DEBOUNCE_MS = 2000;

/**
 * Hook that manages state persistence:
 * 1. Restores from VSCode webview state on mount (fast, survives hide/show)
 * 2. Loads from .lattice/project.json via extension host on mount
 * 3. Auto-saves to VSCode webview state on store changes (debounced)
 * 4. Saves to .lattice/project.json periodically and on key events
 *
 * Should be called once at the app root level.
 */
export function usePersistence() {
  const hasRestoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save to VSCode webview state
  const saveWebviewState = useCallback(() => {
    const bridge = getHostBridge();
    bridge.saveState(gatherState());
  }, []);

  // Save to .lattice/project.json via extension host
  const saveProjectFile = useCallback(() => {
    const bridge = getHostBridge();
    bridge.send({
      type: 'saveProject',
      payload: toLatticeProject(),
    });
  }, []);

  // Debounced auto-save
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveWebviewState();
      saveProjectFile();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [saveWebviewState, saveProjectFile]);

  // Restore state on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const bridge = getHostBridge();

    // 1. Try VSCode webview state first (instant)
    const cached = bridge.getState<WebviewState>();
    if (cached && cached.boxes && Object.keys(cached.boxes).length > 0) {
      restoreState(cached);
    }

    // 2. Request project from .lattice/ directory (may override)
    const unsub = bridge.on('projectLoaded', (msg: ResponseMessage) => {
      if (msg.type !== 'projectLoaded') return;
      if (msg.payload) {
        fromLatticeProject(msg.payload);
        notify.info('Project loaded');
      }
    });

    bridge.send({ type: 'loadProject' });

    return () => {
      unsub();
    };
  }, []);

  // Subscribe to store changes and auto-save
  useEffect(() => {
    const unsubs = [
      useLayoutStore.subscribe(debouncedSave),
      useProjectStore.subscribe(debouncedSave),
      useContextStore.subscribe(debouncedSave),
      useGenerationStore.subscribe(debouncedSave),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [debouncedSave]);
}
