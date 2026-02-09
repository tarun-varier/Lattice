import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Trash2,
  Copy,
  Move,
  ArrowRightLeft,
  ArrowUpDown,
  Plus,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLayoutStore } from '../../stores/layout-store';
import { useProjectStore } from '../../stores/project-store';
import { useUiStore } from '../../stores/ui-store';
import { useContextStore } from '../../stores/context-store';
import { useGenerationStore } from '../../stores/generation-store';
import { assembleBoxPrompts } from '../../lib/prompt-engine';
import { getHostBridge } from '../../lib/host-bridge';
import type { Box as BoxType } from '@shared/types';
import { SortableBoxList } from './SortableBoxList';
import { FreeformResizeHandles } from './FreeformResizeHandles';

interface FreeformBoxProps {
  box: BoxType;
  canvasRef: React.RefObject<HTMLDivElement>;
}

/**
 * A top-level box rendered with absolute positioning on the freeform canvas.
 * Supports pointer-event-based dragging (move) and edge/corner resizing.
 * Children inside are rendered via SortableBoxList (flex layout).
 */
export function FreeformBox({ box, canvasRef }: FreeformBoxProps) {
  const selectedBoxId = useUiStore((s) => s.selectedBoxId);
  const selectBox = useUiStore((s) => s.selectBox);
  const activePageId = useUiStore((s) => s.activePageId);
  const updateBox = useLayoutStore((s) => s.updateBox);
  const updateBoxPosition = useLayoutStore((s) => s.updateBoxPosition);
  const removeBox = useLayoutStore((s) => s.removeBox);
  const duplicateBox = useLayoutStore((s) => s.duplicateBox);
  const addBox = useLayoutStore((s) => s.addBox);
  const boxes = useLayoutStore((s) => s.boxes);
  const addBoxToPage = useProjectStore((s) => s.addBoxToPage);
  const removeBoxFromPage = useProjectStore((s) => s.removeBoxFromPage);

  const isSelected = selectedBoxId === box.id;
  const hasChildren = box.childIds.length > 0;
  const children = box.childIds
    .map((id) => boxes[id])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  // Inline label editing
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(box.label);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startBoxX: number;
    startBoxY: number;
  } | null>(null);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  const commitLabel = useCallback(() => {
    updateBox(box.id, { label: labelDraft });
    setIsEditingLabel(false);
  }, [box.id, labelDraft, updateBox]);

  // --- Freeform drag via pointer events on the header / drag handle ---

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      selectBox(box.id);

      dragState.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startBoxX: box.x,
        startBoxY: box.y,
      };
      setIsDragging(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!dragState.current) return;
        const dx = moveEvent.clientX - dragState.current.startMouseX;
        const dy = moveEvent.clientY - dragState.current.startMouseY;
        const newX = Math.max(0, dragState.current.startBoxX + dx);
        const newY = Math.max(0, dragState.current.startBoxY + dy);
        updateBoxPosition(box.id, newX, newY);
      };

      const handlePointerUp = () => {
        dragState.current = null;
        setIsDragging(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [box.id, box.x, box.y, selectBox, updateBoxPosition]
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectBox(box.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLabelDraft(box.label);
    setIsEditingLabel(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) selectBox(null);
    removeBoxFromPage(activePageId, box.id);
    removeBox(box.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = duplicateBox(box.id);
    addBoxToPage(activePageId, newId);
    selectBox(newId);
  };

  const handleToggleDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateBox(box.id, {
      direction: box.direction === 'row' ? 'column' : 'row',
    });
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    addBox('', box.id);
  };

  const handleGenerateBox = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      const context = useContextStore.getState().context;
      const allBoxes = useLayoutStore.getState().boxes;
      const { systemPrompt, userPrompt } = assembleBoxPrompts(box, allBoxes, context);

      useGenerationStore.getState().setLastPrompt({
        systemPrompt,
        userPrompt,
        target: 'box',
        targetId: box.id,
        targetName: box.label || 'Untitled',
        timestamp: Date.now(),
      });

      // Switch to prompt tab so user can see the result
      useUiStore.getState().setPreviewTab('prompt');

      // Mark this box as generating
      useGenerationStore.getState().startGeneration(box.id);

      // Send generation request to extension host
      const bridge = getHostBridge();
      const requestId = bridge.nextRequestId();

      // Store the mapping of requestId -> boxId so response listeners
      // can route chunks to the correct box.
      useGenerationStore.getState().mapRequestToBox(requestId, box.id);

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
    },
    [box]
  );

  return (
    <div
      data-box-id={box.id}
      className={cn(
        'group absolute rounded-md border transition-shadow',
        isSelected
          ? 'border-primary ring-2 ring-primary/30 bg-card shadow-lg'
          : 'border-border bg-card hover:border-muted-foreground/40 shadow-sm',
        isDragging && 'opacity-90 shadow-xl cursor-grabbing z-50'
      )}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
      onClick={handleClick}
    >
      {/* Box header bar — drag handle area */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs border-b cursor-grab active:cursor-grabbing select-none',
          isSelected ? 'border-primary/20 bg-primary/5' : 'border-border/50'
        )}
        onPointerDown={handleDragPointerDown}
      >
        {/* Move icon */}
        <Move className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />

        {/* Label */}
        {isEditingLabel ? (
          <input
            ref={labelInputRef}
            className="flex-1 bg-transparent text-xs text-foreground outline-none border-b border-primary px-0.5"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') setIsEditingLabel(false);
            }}
          />
        ) : (
          <span
            className={cn(
              'flex-1 truncate cursor-text',
              box.label
                ? 'text-foreground/80'
                : 'text-muted-foreground/50 italic'
            )}
            onDoubleClick={handleDoubleClick}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {box.label || 'Untitled'}
          </span>
        )}

        {/* Direction indicator */}
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {box.direction === 'row' ? 'row' : 'col'}
          </span>
        )}

        {/* Controls — visible on hover or when selected */}
        <div
          className={cn(
            'flex items-center gap-0.5 transition-opacity',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded"
            onClick={handleToggleDirection}
            title={`Switch to ${box.direction === 'row' ? 'column' : 'row'} layout`}
          >
            {box.direction === 'row' ? (
              <ArrowUpDown className="w-3 h-3" />
            ) : (
              <ArrowRightLeft className="w-3 h-3" />
            )}
          </button>
          <button
            className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded"
            onClick={handleAddChild}
            title="Add child box"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            className="p-0.5 text-primary/60 hover:text-primary rounded"
            onClick={handleGenerateBox}
            title="Generate code for this box"
          >
            <Sparkles className="w-3 h-3" />
          </button>
          <button
            className="p-0.5 text-muted-foreground/60 hover:text-foreground rounded"
            onClick={handleDuplicate}
            title="Duplicate box"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            className="p-0.5 text-muted-foreground/60 hover:text-destructive rounded"
            onClick={handleDelete}
            title="Delete box"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Children area — fills remaining space, uses flex layout */}
      <div
        className={cn(
          'flex-1 overflow-auto',
          hasChildren ? 'p-1.5' : ''
        )}
        style={{
          height: `calc(100% - 28px)`, // subtract header height
        }}
      >
        {hasChildren ? (
          <SortableBoxList
            boxes={children}
            parentId={box.id}
            direction={box.direction}
            depth={1}
          />
        ) : (
          // Empty children placeholder
          isSelected && (
            <div className="flex items-center justify-center h-full">
              <div className="text-[10px] text-muted-foreground/40 text-center py-1">
                {box.spec?.intent ? (
                  <span className="italic line-clamp-1">{box.spec.intent}</span>
                ) : (
                  'Click to add spec or drag boxes here'
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Freeform resize handles — corners and edges */}
      {isSelected && <FreeformResizeHandles box={box} />}
    </div>
  );
}
