import { useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useLayoutStore } from '../../stores/layout-store';

interface ResizeHandleProps {
  boxId: string;
  /** Parent's flex direction — determines which edge gets the handle */
  direction: 'row' | 'column';
}

/**
 * Renders a draggable resize handle on the right (row) or bottom (column) edge
 * of a box. Dragging adjusts the box's `basis` value as a pixel string.
 *
 * Uses raw pointer events to avoid conflicting with dnd-kit's drag system.
 */
export function ResizeHandle({ boxId, direction }: ResizeHandleProps) {
  const updateBox = useLayoutStore((s) => s.updateBox);
  const boxes = useLayoutStore((s) => s.boxes);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startPos: number;
    startSize: number;
    boxElement: HTMLElement | null;
  } | null>(null);

  const isHorizontal = direction === 'row'; // handle on right edge

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const box = boxes[boxId];
      if (!box) return;

      // Find the box DOM element (parent of the handle)
      const handleEl = handleRef.current;
      if (!handleEl) return;
      const boxEl = handleEl.closest('[data-box-id]') as HTMLElement | null;
      if (!boxEl) return;

      const rect = boxEl.getBoundingClientRect();
      const startSize = isHorizontal ? rect.width : rect.height;
      const startPos = isHorizontal ? e.clientX : e.clientY;

      dragState.current = { startPos, startSize, boxElement: boxEl };

      // Capture pointer for smooth dragging
      handleEl.setPointerCapture(e.pointerId);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!dragState.current) return;
        const currentPos = isHorizontal
          ? moveEvent.clientX
          : moveEvent.clientY;
        const delta = currentPos - dragState.current.startPos;
        const newSize = Math.max(32, dragState.current.startSize + delta);

        updateBox(boxId, { basis: `${Math.round(newSize)}px`, grow: 0 });
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        dragState.current = null;
        handleEl.releasePointerCapture(upEvent.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [boxId, boxes, isHorizontal, updateBox]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Double-click resets to flex grow (auto sizing)
      updateBox(boxId, { basis: undefined, grow: 1 });
    },
    [boxId, updateBox]
  );

  return (
    <div
      ref={handleRef}
      className={cn(
        'absolute z-10 transition-colors',
        'bg-transparent hover:bg-primary/40 active:bg-primary/60',
        isHorizontal
          ? 'top-0 right-0 w-1.5 h-full cursor-col-resize'
          : 'bottom-0 left-0 h-1.5 w-full cursor-row-resize'
      )}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize, double-click to reset"
    />
  );
}
