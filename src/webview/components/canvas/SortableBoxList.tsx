import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import { Box } from './Box';
import type { Box as BoxType } from '@shared/types';

interface SortableBoxListProps {
  boxes: BoxType[];
  parentId: string | null;
  direction: 'row' | 'column';
  depth: number;
}

export function SortableBoxList({
  boxes,
  parentId,
  direction,
  depth,
}: SortableBoxListProps) {
  const droppableId = parentId ?? 'root';

  const { setNodeRef, isOver } = useDroppable({
    id: `droppable-${droppableId}`,
    data: {
      type: 'container',
      parentId,
      accepts: 'box',
    },
  });

  const strategy =
    direction === 'row'
      ? horizontalListSortingStrategy
      : verticalListSortingStrategy;

  const boxIds = boxes.map((b) => b.id);

  return (
    <SortableContext items={boxIds} strategy={strategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'flex gap-1.5 flex-1 min-h-[36px] rounded transition-colors',
          direction === 'row' ? 'flex-row' : 'flex-col',
          isOver && 'bg-primary/10 ring-1 ring-primary/20 ring-dashed'
        )}
      >
        {boxes.map((box) => (
          <Box
            key={box.id}
            box={box}
            depth={depth}
            parentDirection={direction}
            hasSiblings={boxes.length > 1}
          />
        ))}
      </div>
    </SortableContext>
  );
}
