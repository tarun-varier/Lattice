import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/project-store';
import { useLayoutStore } from '../../stores/layout-store';
import { useGenerationStore } from '../../stores/generation-store';
import { useUiStore } from '../../stores/ui-store';

export function PageMenu() {
  const pages = useProjectStore((s) => s.pages);
  const renamePage = useProjectStore((s) => s.renamePage);
  const removePage = useProjectStore((s) => s.removePage);
  const activePageId = useUiStore((s) => s.activePageId);
  const setActivePageId = useUiStore((s) => s.setActivePageId);

  const [isOpen, setIsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activePage = pages.find((p) => p.id === activePageId);

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setRenamingId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setRenamingId(null);
    setConfirmDeleteId(null);
  }, []);

  const handleSelectPage = useCallback(
    (pageId: string) => {
      setActivePageId(pageId);
      setIsOpen(false);
      setRenamingId(null);
      setConfirmDeleteId(null);
    },
    [setActivePageId]
  );

  const handleStartRename = useCallback(
    (e: React.MouseEvent, pageId: string, currentName: string) => {
      e.stopPropagation();
      setRenamingId(pageId);
      setRenameDraft(currentName);
      setConfirmDeleteId(null);
    },
    []
  );

  const handleCommitRename = useCallback(() => {
    if (renamingId && renameDraft.trim()) {
      renamePage(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameDraft, renamePage]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleRequestDelete = useCallback(
    (e: React.MouseEvent, pageId: string) => {
      e.stopPropagation();
      setConfirmDeleteId(pageId);
      setRenamingId(null);
    },
    []
  );

  const handleConfirmDelete = useCallback(
    (e: React.MouseEvent, pageId: string) => {
      e.stopPropagation();
      if (pages.length <= 1) return; // Can't delete the last page

      // Find the page to get its box IDs before deleting
      const pageToDelete = pages.find((p) => p.id === pageId);
      const boxIdsToRemove = pageToDelete?.boxIds ?? [];

      // If deleting the active page, switch to another
      if (pageId === activePageId) {
        const remaining = pages.filter((p) => p.id !== pageId);
        if (remaining.length > 0) {
          setActivePageId(remaining[0].id);
        }
      }

      // Clean up shared component instance references for all boxes being removed
      const layoutState = useLayoutStore.getState();
      const projectState = useProjectStore.getState();
      const collectIds = (id: string): string[] => {
        const b = layoutState.boxes[id];
        if (!b) return [];
        return [id, ...b.childIds.flatMap(collectIds)];
      };
      const allIdsToRemove = boxIdsToRemove.flatMap(collectIds);
      for (const id of allIdsToRemove) {
        const b = layoutState.boxes[id];
        if (b?.sharedComponentId) {
          projectState.removeInstanceFromSharedComponent(b.sharedComponentId, id);
        }
      }

      // Remove all boxes that belonged to this page (and their children)
      for (const boxId of boxIdsToRemove) {
        layoutState.removeBox(boxId);
      }

      // Clean up generation results for those boxes
      const genState = useGenerationStore.getState();
      for (const boxId of boxIdsToRemove) {
        if (genState.results[boxId]) {
          // failGeneration clears generating/streamBuffers, and we manually clear results
          genState.failGeneration(boxId);
        }
      }

      removePage(pageId);
      setConfirmDeleteId(null);
    },
    [pages, activePageId, setActivePageId, removePage]
  );

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleToggle}
      >
        <span>{activePage?.name ?? 'Home'}</span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Pages
          </div>

          {pages.map((page) => {
            const isActive = page.id === activePageId;
            const isRenaming = renamingId === page.id;
            const isConfirmingDelete = confirmDeleteId === page.id;

            return (
              <div
                key={page.id}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/50'
                )}
                onClick={() => !isRenaming && handleSelectPage(page.id)}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />

                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      ref={renameInputRef}
                      className="flex-1 bg-background text-xs text-foreground border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onBlur={handleCommitRename}
                    />
                    <button
                      className="p-0.5 text-green-500 hover:text-green-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCommitRename();
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelRename();
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : isConfirmingDelete ? (
                  <div className="flex-1 flex items-center gap-1">
                    <span className="flex-1 text-xs text-destructive">
                      Delete "{page.name}"?
                    </span>
                    <button
                      className="p-0.5 text-destructive hover:text-destructive/80"
                      onClick={(e) => handleConfirmDelete(e, page.id)}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelDelete}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate text-xs">
                      {page.name}
                    </span>
                    {page.route && (
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {page.route}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded"
                        onClick={(e) =>
                          handleStartRename(e, page.id, page.name)
                        }
                        title="Rename page"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          className="p-0.5 text-muted-foreground/60 hover:text-destructive rounded"
                          onClick={(e) => handleRequestDelete(e, page.id)}
                          title="Delete page"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
