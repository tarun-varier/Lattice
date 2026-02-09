import { useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useLayoutStore } from '../../stores/layout-store';
import type { Box } from '@shared/types';

type HandlePosition =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

interface FreeformResizeHandlesProps {
  box: Box;
}

const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;

/**
 * Renders 8 resize handles (4 edges + 4 corners) around a freeform box.
 * Uses raw pointer events to update the box's width, height, x, y.
 */
export function FreeformResizeHandles({ box }: FreeformResizeHandlesProps) {
  const updateBox = useLayoutStore((s) => s.updateBox);

  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    handle: HandlePosition;
  } | null>(null);

  const handlePointerDown = useCallback(
    (handle: HandlePosition) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: box.x,
        startY: box.y,
        startW: box.width,
        startH: box.height,
        handle,
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!dragState.current) return;
        const ds = dragState.current;
        const dx = moveEvent.clientX - ds.startMouseX;
        const dy = moveEvent.clientY - ds.startMouseY;

        let newX = ds.startX;
        let newY = ds.startY;
        let newW = ds.startW;
        let newH = ds.startH;

        // Horizontal resizing
        if (ds.handle.includes('e')) {
          newW = Math.max(MIN_WIDTH, ds.startW + dx);
        }
        if (ds.handle.includes('w')) {
          const proposedW = ds.startW - dx;
          if (proposedW >= MIN_WIDTH) {
            newW = proposedW;
            newX = ds.startX + dx;
          } else {
            newW = MIN_WIDTH;
            newX = ds.startX + ds.startW - MIN_WIDTH;
          }
        }

        // Vertical resizing
        if (ds.handle.includes('s')) {
          newH = Math.max(MIN_HEIGHT, ds.startH + dy);
        }
        if (ds.handle === 'n' || ds.handle === 'ne' || ds.handle === 'nw') {
          const proposedH = ds.startH - dy;
          if (proposedH >= MIN_HEIGHT) {
            newH = proposedH;
            newY = ds.startY + dy;
          } else {
            newH = MIN_HEIGHT;
            newY = ds.startY + ds.startH - MIN_HEIGHT;
          }
        }

        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        updateBox(box.id, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      };

      const handlePointerUp = () => {
        dragState.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [box.id, box.x, box.y, box.width, box.height, updateBox]
  );

  return (
    <>
      {/* Edge handles */}
      <ResizeEdge position="n" onPointerDown={handlePointerDown('n')} />
      <ResizeEdge position="s" onPointerDown={handlePointerDown('s')} />
      <ResizeEdge position="e" onPointerDown={handlePointerDown('e')} />
      <ResizeEdge position="w" onPointerDown={handlePointerDown('w')} />

      {/* Corner handles */}
      <ResizeCorner position="nw" onPointerDown={handlePointerDown('nw')} />
      <ResizeCorner position="ne" onPointerDown={handlePointerDown('ne')} />
      <ResizeCorner position="sw" onPointerDown={handlePointerDown('sw')} />
      <ResizeCorner position="se" onPointerDown={handlePointerDown('se')} />
    </>
  );
}

// --- Edge handle sub-component ---

function ResizeEdge({
  position,
  onPointerDown,
}: {
  position: 'n' | 's' | 'e' | 'w';
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const isHorizontal = position === 'n' || position === 's';
  const cursor = isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize';

  const positionClasses: Record<string, string> = {
    n: 'top-0 left-2 right-2 h-1.5 -translate-y-1/2',
    s: 'bottom-0 left-2 right-2 h-1.5 translate-y-1/2',
    e: 'right-0 top-2 bottom-2 w-1.5 translate-x-1/2',
    w: 'left-0 top-2 bottom-2 w-1.5 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'absolute z-20',
        cursor,
        positionClasses[position],
        'hover:bg-primary/40 active:bg-primary/60 transition-colors rounded-full'
      )}
      onPointerDown={onPointerDown}
    />
  );
}

// --- Corner handle sub-component ---

function ResizeCorner({
  position,
  onPointerDown,
}: {
  position: 'nw' | 'ne' | 'sw' | 'se';
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const cursorMap: Record<string, string> = {
    nw: 'cursor-nwse-resize',
    se: 'cursor-nwse-resize',
    ne: 'cursor-nesw-resize',
    sw: 'cursor-nesw-resize',
  };

  const positionClasses: Record<string, string> = {
    nw: '-top-1 -left-1',
    ne: '-top-1 -right-1',
    sw: '-bottom-1 -left-1',
    se: '-bottom-1 -right-1',
  };

  return (
    <div
      className={cn(
        'absolute z-30 w-2.5 h-2.5 rounded-sm',
        'bg-primary border border-primary-foreground/50 shadow-sm',
        cursorMap[position],
        positionClasses[position]
      )}
      onPointerDown={onPointerDown}
    />
  );
}
