import { useCallback } from 'react';
import { Settings, Play, Plus } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store';
import { useUiStore } from '../../stores/ui-store';
import { useLayoutStore } from '../../stores/layout-store';
import { useContextStore } from '../../stores/context-store';
import { useGenerationStore } from '../../stores/generation-store';
import { assemblePagePrompts } from '../../lib/prompt-engine';
import { getHostBridge } from '../../lib/host-bridge';
import { PageMenu } from './PageMenu';
import { SharedComponentsList } from './SharedComponentsList';

export function Toolbar() {
  const pages = useProjectStore((s) => s.pages);
  const addPage = useProjectStore((s) => s.addPage);
  const activePageId = useUiStore((s) => s.activePageId);
  const setActivePageId = useUiStore((s) => s.setActivePageId);
  const setPreviewTab = useUiStore((s) => s.setPreviewTab);
  const toggleSettings = useUiStore((s) => s.toggleSettings);
  const activePage = pages.find((p) => p.id === activePageId);

  const boxes = useLayoutStore((s) => s.boxes);
  const context = useContextStore((s) => s.context);
  const setLastPrompt = useGenerationStore((s) => s.setLastPrompt);
  const startGeneration = useGenerationStore((s) => s.startGeneration);
  const mapRequestToPage = useGenerationStore((s) => s.mapRequestToPage);

  const pageHasBoxes = (activePage?.boxIds.length ?? 0) > 0;
  const isPageGenerating = useGenerationStore(
    (s) => activePage ? !!s.generating[`page:${activePage.id}`] : false
  );

  const handleAddPage = useCallback(() => {
    const name = `Page ${pages.length + 1}`;
    const newId = addPage(name);
    setActivePageId(newId);
  }, [pages.length, addPage, setActivePageId]);

  const handleGeneratePage = useCallback(() => {
    if (!activePage) return;

    const sharedComponents = useProjectStore.getState().sharedComponents;
    const { systemPrompt, userPrompt } = assemblePagePrompts(
      activePage,
      boxes,
      context,
      sharedComponents
    );

    // Store the assembled prompt for display in Output Panel
    setLastPrompt({
      systemPrompt,
      userPrompt,
      target: 'page',
      targetId: activePage.id,
      targetName: activePage.name,
      timestamp: Date.now(),
    });

    // Switch to the Prompt tab so the user sees the result
    setPreviewTab('prompt');

    // Send generation request to extension host via HostBridge
    const bridge = getHostBridge();
    const requestId = bridge.nextRequestId();

    // Mark the page as generating and map the request to the page key
    const pageKey = `page:${activePage.id}`;
    startGeneration(pageKey);
    mapRequestToPage(requestId, activePage.id, activePage.boxIds);

    bridge.send({
      type: 'generate',
      id: requestId,
      payload: {
        prompt: userPrompt,
        systemPrompt,
        model: '', // will use config default
        stream: true,
      },
    });
  }, [activePage, boxes, context, setLastPrompt, setPreviewTab, startGeneration, mapRequestToPage]);

  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-border bg-background flex-shrink-0">
      {/* Left: Logo + Page selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Lattice
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Page selector dropdown */}
        <PageMenu />

        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleAddPage}
          title="Add new page"
        >
          <Plus className="w-3 h-3" />
          <span>Page</span>
        </button>

        <div className="h-4 w-px bg-border" />

        {/* Shared components dropdown (only visible when components exist) */}
        <SharedComponentsList />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!pageHasBoxes || isPageGenerating}
          title={
            isPageGenerating
              ? 'Generation in progress...'
              : pageHasBoxes
                ? 'Generate all components on this page'
                : 'Add boxes to this page first'
          }
          onClick={handleGeneratePage}
        >
          <Play className="w-3 h-3" />
          <span>{isPageGenerating ? 'Generating...' : 'Generate Page'}</span>
        </button>

        <button
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
          title="Settings"
          onClick={toggleSettings}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
