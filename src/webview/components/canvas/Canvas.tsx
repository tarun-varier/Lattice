import { useCallback, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useLayoutStore } from '../../stores/layout-store';
import { useProjectStore } from '../../stores/project-store';
import { useUiStore } from '../../stores/ui-store';
import { FreeformBox } from './FreeformBox';
import { SpecPopover } from '../spec/SpecPopover';
import type { Box } from '@shared/types';

// Minimum canvas size so there's always room to place boxes
const CANVAS_MIN_WIDTH = 3000;
const CANVAS_MIN_HEIGHT = 2000;

export function Canvas() {
  const boxes = useLayoutStore((s) => s.boxes);
  const addBox = useLayoutStore((s) => s.addBox);
  const moveBox = useLayoutStore((s) => s.moveBox);
  const activePageId = useUiStore((s) => s.activePageId);
  const selectBox = useUiStore((s) => s.selectBox);
  const pages = useProjectStore((s) => s.pages);
  const addBoxToPage = useProjectStore((s) => s.addBoxToPage);

  const activePage = pages.find((p) => p.id === activePageId);
  const pageBoxIds = activePage?.boxIds ?? [];

  // Get top-level boxes that belong to the active page
  const topLevelBoxes = pageBoxIds
    .map((id) => boxes[id])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  const hasBoxes = topLevelBoxes.length > 0;
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // dnd-kit sensors — only used for nested sortable boxes, not top-level freeform
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // --- Nested drag handlers (dnd-kit sortable, for children inside boxes) ---

  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      // Could set an active drag overlay for nested boxes if needed
    },
    []
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback handled by SortableBoxList's useDroppable isOver state
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;
      const overData = over.data.current;

      if (overData?.type === 'container') {
        const targetParentId = overData.parentId as string | null;
        const targetChildren = targetParentId
          ? boxes[targetParentId]?.childIds ?? []
          : pageBoxIds;
        moveBox(activeId, targetParentId, targetChildren.length);
      } else {
        const overBox = boxes[overId];
        if (!overBox) return;

        const targetParentId = overBox.parentId;
        const siblingIds = targetParentId
          ? boxes[targetParentId]?.childIds ?? []
          : pageBoxIds;
        const overIndex = siblingIds.indexOf(overId);
        const insertIndex = overIndex >= 0 ? overIndex : siblingIds.length;

        moveBox(activeId, targetParentId, insertIndex);
      }
    },
    [boxes, pageBoxIds, moveBox]
  );

  // --- Add box handler ---

  const handleAddBox = useCallback(() => {
    // Place new box in the visible area of the canvas
    const scrollEl = scrollRef.current;
    let x = 80;
    let y = 80;

    if (scrollEl) {
      x = scrollEl.scrollLeft + 80;
      y = scrollEl.scrollTop + 80;
    }

    // Stagger based on existing box count to avoid overlap
    const offset = topLevelBoxes.length * 40;
    x += offset;
    y += offset;

    const boxId = addBox(activePageId, null);
    // Set the calculated position
    useLayoutStore.getState().updateBoxPosition(boxId, x, y);
    addBoxToPage(activePageId, boxId);
    selectBox(boxId);
  }, [addBox, addBoxToPage, activePageId, selectBox, topLevelBoxes.length]);

  // --- Click canvas background to deselect ---

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking directly on the canvas surface (not a box)
      if (e.target === e.currentTarget) {
        selectBox(null);
      }
    },
    [selectBox]
  );

  // --- Escape key to deselect ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.closest('[data-spec-popover]')) {
          return;
        }
        selectBox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectBox]);

  return (
    <div className="flex flex-col h-full bg-background">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Scrollable viewport */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
        >
          {/* Canvas surface — large area for absolute positioning */}
          <div
            ref={canvasRef}
            className="relative"
            style={{
              minWidth: CANVAS_MIN_WIDTH,
              minHeight: CANVAS_MIN_HEIGHT,
            }}
            onClick={handleCanvasClick}
          >
            {!hasBoxes ? (
              // Empty state centered in the viewport
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                      No boxes yet
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Click the button below to add your first box
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Render top-level boxes with absolute positioning
              topLevelBoxes.map((box) => (
                <FreeformBox
                  key={box.id}
                  box={box}
                  canvasRef={canvasRef as React.RefObject<HTMLDivElement>}
                />
              ))
            )}

            {/* Dot grid pattern for visual orientation */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
          </div>
        </div>

        {/* No DragOverlay needed for freeform — top-level uses pointer events */}
        <DragOverlay dropAnimation={null}>
          {null}
        </DragOverlay>
      </DndContext>

      {/* Spec popover — fixed position, anchored to selected box */}
      <SpecPopover canvasRef={canvasRef as React.RefObject<HTMLDivElement>} />

      {/* Add box button — fixed at bottom */}
      <div className="flex-shrink-0 p-3 border-t border-border">
        <button
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-md transition-colors"
          onClick={handleAddBox}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Box</span>
        </button>
      </div>
    </div>
  );
}
