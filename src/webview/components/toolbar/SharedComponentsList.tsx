import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Component,
  ChevronDown,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Link,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/project-store';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import type { SharedComponent } from '@shared/types';

/**
 * Dropdown panel listing all shared components.
 * Allows inserting a new instance (box) of a shared component onto the active page,
 * renaming, and deleting shared components.
 */
export function SharedComponentsList() {
  const sharedComponents = useProjectStore((s) => s.sharedComponents);
  const removeSharedComponent = useProjectStore((s) => s.removeSharedComponent);
  const updateSharedComponent = useProjectStore((s) => s.updateSharedComponent);
  const addInstanceToSharedComponent = useProjectStore((s) => s.addInstanceToSharedComponent);
  const addBoxToPage = useProjectStore((s) => s.addBoxToPage);
  const addBox = useLayoutStore((s) => s.addBox);
  const updateBox = useLayoutStore((s) => s.updateBox);
  const updateBoxSpec = useLayoutStore((s) => s.updateBoxSpec);
  const activePageId = useUiStore((s) => s.activePageId);
  const selectBox = useUiStore((s) => s.selectBox);

  const [isOpen, setIsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const componentList = Object.values(sharedComponents);

  // Close on outside click
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

  const handleInsertInstance = useCallback(
    (component: SharedComponent) => {
      // Create a new box on the active page linked to this shared component
      const boxId = addBox(activePageId, null);
      addBoxToPage(activePageId, boxId);

      // Set the box's label, spec, and sharedComponentId
      updateBox(boxId, {
        label: component.name,
        sharedComponentId: component.id,
      });
      updateBoxSpec(boxId, { ...component.spec });

      // Register this box as an instance of the shared component
      addInstanceToSharedComponent(component.id, boxId);

      selectBox(boxId);
      setIsOpen(false);
    },
    [activePageId, addBox, addBoxToPage, updateBox, updateBoxSpec, addInstanceToSharedComponent, selectBox]
  );

  const handleStartRename = useCallback(
    (e: React.MouseEvent, id: string, currentName: string) => {
      e.stopPropagation();
      setRenamingId(id);
      setRenameDraft(currentName);
      setConfirmDeleteId(null);
    },
    []
  );

  const handleCommitRename = useCallback(() => {
    if (renamingId && renameDraft.trim()) {
      updateSharedComponent(renamingId, { name: renameDraft.trim() });
    }
    setRenamingId(null);
  }, [renamingId, renameDraft, updateSharedComponent]);

  const handleRequestDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setConfirmDeleteId(id);
      setRenamingId(null);
    },
    []
  );

  const handleConfirmDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      // Unlink all instance boxes
      const component = sharedComponents[id];
      if (component) {
        for (const boxId of component.instanceIds) {
          useLayoutStore.getState().updateBox(boxId, { sharedComponentId: undefined });
        }
      }

      removeSharedComponent(id);
      setConfirmDeleteId(null);
    },
    [sharedComponents, removeSharedComponent]
  );

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }, []);

  // Don't render the button if there are no shared components
  if (componentList.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setRenamingId(null);
          setConfirmDeleteId(null);
        }}
        title="Shared components"
      >
        <Component className="w-3 h-3" />
        <span>{componentList.length}</span>
        <ChevronDown
          className={cn(
            'w-2.5 h-2.5 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Shared Components
          </div>

          {componentList.map((component) => {
            const isRenaming = renamingId === component.id;
            const isConfirmingDelete = confirmDeleteId === component.id;

            return (
              <div
                key={component.id}
                className="group flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors"
              >
                <Link className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />

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
                        if (e.key === 'Escape') setRenamingId(null);
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
                        setRenamingId(null);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : isConfirmingDelete ? (
                  <div className="flex-1 flex items-center gap-1">
                    <span className="flex-1 text-xs text-destructive truncate">
                      Delete "{component.name}"?
                    </span>
                    <button
                      className="p-0.5 text-destructive hover:text-destructive/80"
                      onClick={(e) => handleConfirmDelete(e, component.id)}
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
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-foreground truncate block">
                        {component.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {component.instanceIds.length} instance{component.instanceIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-0.5 text-muted-foreground/60 hover:text-primary rounded"
                        onClick={() => handleInsertInstance(component)}
                        title="Insert instance on this page"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded"
                        onClick={(e) => handleStartRename(e, component.id, component.name)}
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-0.5 text-muted-foreground/60 hover:text-destructive rounded"
                        onClick={(e) => handleRequestDelete(e, component.id)}
                        title="Delete shared component"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
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
