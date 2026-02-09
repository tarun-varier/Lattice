import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Trash2,
  Copy,
  GripVertical,
  ArrowRightLeft,
  ArrowUpDown,
  Plus,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import type { Box as BoxType } from '@shared/types';
import { SortableBoxList } from './SortableBoxList';
import { ResizeHandle } from './ResizeHandle';

interface BoxProps {
  box: BoxType;
  depth: number;
  /** Parent's flex direction — needed for resize handle placement */
  parentDirection?: 'row' | 'column';
  /** Whether this box has siblings (resize only makes sense with siblings) */
  hasSiblings?: boolean;
}

/**
 * A nested (child) box rendered inside a flex container with dnd-kit sortable.
 * Used for boxes that have a parentId (not top-level).
 * Top-level boxes use FreeformBox instead.
 */
export function Box({ box, depth, parentDirection = 'column', hasSiblings = false }: BoxProps) {
  const selectedBoxId = useUiStore((s) => s.selectedBoxId);
  const selectBox = useUiStore((s) => s.selectBox);
  const updateBox = useLayoutStore((s) => s.updateBox);
  const removeBox = useLayoutStore((s) => s.removeBox);
  const duplicateBox = useLayoutStore((s) => s.duplicateBox);
  const addBox = useLayoutStore((s) => s.addBox);
  const boxes = useLayoutStore((s) => s.boxes);

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

  // dnd-kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: box.id,
    data: {
      type: 'box',
      box,
      depth,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flex: box.basis ? `0 0 ${box.basis}` : `${box.grow} 1 0%`,
  };

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
    removeBox(box.id);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = duplicateBox(box.id);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-box-id={box.id}
      className={cn(
        'group relative rounded-md border transition-all min-h-[48px]',
        isSelected
          ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
          : 'border-border bg-card hover:border-muted-foreground/40',
        isDragging && 'opacity-40 shadow-lg',
        depth > 0 && 'min-h-[40px]'
      )}
      onClick={handleClick}
    >
      {/* Box header bar */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs border-b',
          isSelected ? 'border-primary/20' : 'border-transparent'
        )}
      >
        {/* Drag handle */}
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-0.5 -ml-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>

        {/* Label */}
        {isEditingLabel ? (
          <input
            ref={labelInputRef}
            className="flex-1 bg-transparent text-xs text-foreground outline-none border-b border-primary px-0.5"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') setIsEditingLabel(false);
            }}
          />
        ) : (
          <span
            className={cn(
              'flex-1 truncate cursor-text select-none',
              box.label
                ? 'text-foreground/80'
                : 'text-muted-foreground/50 italic'
            )}
            onDoubleClick={handleDoubleClick}
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

      {/* Children area */}
      {hasChildren && (
        <div
          className={cn(
            'p-1.5 flex gap-1.5 min-h-[36px]',
            box.direction === 'row' ? 'flex-row' : 'flex-col'
          )}
        >
          <SortableBoxList
            boxes={children}
            parentId={box.id}
            direction={box.direction}
            depth={depth + 1}
          />
        </div>
      )}

      {/* Empty children placeholder (when selected and no children) */}
      {!hasChildren && isSelected && (
        <div className="px-2 pb-1.5">
          <div className="text-[10px] text-muted-foreground/40 text-center py-1">
            {box.spec?.intent ? (
              <span className="italic line-clamp-1">{box.spec.intent}</span>
            ) : (
              'Click to add spec or drag boxes here'
            )}
          </div>
        </div>
      )}

      {/* Resize handle — shown when box has siblings */}
      {hasSiblings && (
        <ResizeHandle boxId={box.id} direction={parentDirection} />
      )}
    </div>
  );
}
