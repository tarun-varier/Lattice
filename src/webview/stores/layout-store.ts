import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Box, BoxSpec } from '@shared/types';

interface LayoutState {
  boxes: Record<string, Box>;

  // Actions
  addBox: (pageId: string, parentId?: string | null) => string;
  removeBox: (boxId: string) => void;
  moveBox: (boxId: string, newParentId: string | null, index: number) => void;
  updateBox: (boxId: string, patch: Partial<Box>) => void;
  updateBoxPosition: (boxId: string, x: number, y: number) => void;
  updateBoxSize: (boxId: string, width: number, height: number) => void;
  updateBoxSpec: (boxId: string, spec: BoxSpec | null) => void;
  duplicateBox: (boxId: string) => string;
  getBoxesForPage: (pageBoxIds: string[]) => Box[];
  getChildren: (boxId: string) => Box[];
  reset: () => void;
}

// Default dimensions for new top-level boxes
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 200;
const STAGGER_OFFSET = 40;

function createEmptyBox(
  parentId: string | null,
  order: number,
  x: number = 80,
  y: number = 80
): Box {
  return {
    id: nanoid(),
    label: '',
    order,
    grow: 1,

    // Freeform positioning (meaningful for top-level boxes)
    x,
    y,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,

    direction: 'column',
    gap: 2,
    padding: 2,
    parentId,
    childIds: [],
    spec: null,
  };
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  boxes: {},

  addBox: (pageId: string, parentId: string | null = null) => {
    const state = get();
    // Determine order: append after existing siblings
    const siblings = parentId
      ? (state.boxes[parentId]?.childIds ?? [])
      : Object.values(state.boxes).filter((b) => b.parentId === null);
    const order = siblings.length;

    // For top-level boxes, stagger position based on existing count
    const x = 80 + order * STAGGER_OFFSET;
    const y = 80 + order * STAGGER_OFFSET;

    const box = createEmptyBox(parentId, order, x, y);

    set((s) => {
      const newBoxes = { ...s.boxes, [box.id]: box };

      // If it has a parent, add to parent's childIds
      if (parentId && newBoxes[parentId]) {
        newBoxes[parentId] = {
          ...newBoxes[parentId],
          childIds: [...newBoxes[parentId].childIds, box.id],
        };
      }

      return { boxes: newBoxes };
    });

    return box.id;
  },

  removeBox: (boxId: string) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;

      const newBoxes = { ...s.boxes };

      // Recursively collect all descendant IDs
      const toRemove = new Set<string>();
      const collectDescendants = (id: string) => {
        toRemove.add(id);
        const b = newBoxes[id];
        if (b) {
          b.childIds.forEach(collectDescendants);
        }
      };
      collectDescendants(boxId);

      // Remove all collected boxes
      for (const id of toRemove) {
        delete newBoxes[id];
      }

      // Remove from parent's childIds
      if (box.parentId && newBoxes[box.parentId]) {
        newBoxes[box.parentId] = {
          ...newBoxes[box.parentId],
          childIds: newBoxes[box.parentId].childIds.filter(
            (id) => id !== boxId
          ),
        };
      }

      return { boxes: newBoxes };
    });
  },

  moveBox: (boxId: string, newParentId: string | null, index: number) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;

      const newBoxes = { ...s.boxes };

      // Remove from old parent's childIds
      if (box.parentId && newBoxes[box.parentId]) {
        newBoxes[box.parentId] = {
          ...newBoxes[box.parentId],
          childIds: newBoxes[box.parentId].childIds.filter(
            (id) => id !== boxId
          ),
        };
      }

      // Add to new parent's childIds
      if (newParentId && newBoxes[newParentId]) {
        const childIds = [...newBoxes[newParentId].childIds];
        childIds.splice(index, 0, boxId);
        newBoxes[newParentId] = {
          ...newBoxes[newParentId],
          childIds,
        };
      }

      // Update the box's parentId and order
      newBoxes[boxId] = {
        ...newBoxes[boxId],
        parentId: newParentId,
        order: index,
      };

      return { boxes: newBoxes };
    });
  },

  updateBox: (boxId: string, patch: Partial<Box>) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;
      return {
        boxes: {
          ...s.boxes,
          [boxId]: { ...box, ...patch, id: boxId }, // Never overwrite id
        },
      };
    });
  },

  updateBoxPosition: (boxId: string, x: number, y: number) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;
      return {
        boxes: {
          ...s.boxes,
          [boxId]: { ...box, x, y },
        },
      };
    });
  },

  updateBoxSize: (boxId: string, width: number, height: number) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;
      return {
        boxes: {
          ...s.boxes,
          [boxId]: {
            ...box,
            width: Math.max(120, width),
            height: Math.max(60, height),
          },
        },
      };
    });
  },

  updateBoxSpec: (boxId: string, spec: BoxSpec | null) => {
    set((s) => {
      const box = s.boxes[boxId];
      if (!box) return s;
      return {
        boxes: {
          ...s.boxes,
          [boxId]: { ...box, spec },
        },
      };
    });
  },

  duplicateBox: (boxId: string) => {
    const state = get();
    const original = state.boxes[boxId];
    if (!original) return boxId;

    const newId = nanoid();
    const siblings = original.parentId
      ? (state.boxes[original.parentId]?.childIds ?? [])
      : Object.values(state.boxes).filter((b) => b.parentId === null);

    const duplicate: Box = {
      ...original,
      id: newId,
      label: original.label ? `${original.label} (copy)` : '',
      order: siblings.length,
      // Offset position for top-level duplicates
      x: original.parentId === null ? original.x + STAGGER_OFFSET : original.x,
      y: original.parentId === null ? original.y + STAGGER_OFFSET : original.y,
      childIds: [], // Don't deep-copy children for now
      spec: original.spec ? { ...original.spec } : null,
    };

    set((s) => {
      const newBoxes = { ...s.boxes, [newId]: duplicate };

      // Add to parent's childIds
      if (duplicate.parentId && newBoxes[duplicate.parentId]) {
        newBoxes[duplicate.parentId] = {
          ...newBoxes[duplicate.parentId],
          childIds: [...newBoxes[duplicate.parentId].childIds, newId],
        };
      }

      return { boxes: newBoxes };
    });

    return newId;
  },

  getBoxesForPage: (pageBoxIds: string[]) => {
    const state = get();
    return pageBoxIds
      .map((id) => state.boxes[id])
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  },

  getChildren: (boxId: string) => {
    const state = get();
    const box = state.boxes[boxId];
    if (!box) return [];
    return box.childIds
      .map((id) => state.boxes[id])
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  },

  reset: () => set({ boxes: {} }),
}));
