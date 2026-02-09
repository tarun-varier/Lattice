import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Page, SharedComponent } from '@shared/types';

interface ProjectState {
  pages: Page[];
  sharedComponents: Record<string, SharedComponent>;

  // Page actions
  addPage: (name: string) => string;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  addBoxToPage: (pageId: string, boxId: string) => void;
  removeBoxFromPage: (pageId: string, boxId: string) => void;

  // Shared component actions
  addSharedComponent: (component: SharedComponent) => void;
  removeSharedComponent: (componentId: string) => void;
  updateSharedComponent: (
    componentId: string,
    patch: Partial<SharedComponent>
  ) => void;

  reset: () => void;
}

const defaultPageId = 'page_home';

function createDefaultPages(): Page[] {
  return [
    {
      id: defaultPageId,
      name: 'Home',
      route: '/',
      rootDirection: 'column',
      boxIds: [],
    },
  ];
}

export const useProjectStore = create<ProjectState>((set) => ({
  pages: createDefaultPages(),
  sharedComponents: {},

  addPage: (name: string) => {
    const id = `page_${nanoid(8)}`;
    set((s) => ({
      pages: [
        ...s.pages,
        {
          id,
          name,
          rootDirection: 'column' as const,
          boxIds: [],
        },
      ],
    }));
    return id;
  },

  removePage: (pageId: string) => {
    set((s) => ({
      pages: s.pages.filter((p) => p.id !== pageId),
    }));
  },

  renamePage: (pageId: string, name: string) => {
    set((s) => ({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, name } : p)),
    }));
  },

  addBoxToPage: (pageId: string, boxId: string) => {
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, boxIds: [...p.boxIds, boxId] } : p
      ),
    }));
  },

  removeBoxFromPage: (pageId: string, boxId: string) => {
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === pageId
          ? { ...p, boxIds: p.boxIds.filter((id) => id !== boxId) }
          : p
      ),
    }));
  },

  addSharedComponent: (component: SharedComponent) => {
    set((s) => ({
      sharedComponents: {
        ...s.sharedComponents,
        [component.id]: component,
      },
    }));
  },

  removeSharedComponent: (componentId: string) => {
    set((s) => {
      const { [componentId]: _, ...rest } = s.sharedComponents;
      return { sharedComponents: rest };
    });
  },

  updateSharedComponent: (
    componentId: string,
    patch: Partial<SharedComponent>
  ) => {
    set((s) => {
      const existing = s.sharedComponents[componentId];
      if (!existing) return s;
      return {
        sharedComponents: {
          ...s.sharedComponents,
          [componentId]: { ...existing, ...patch, id: componentId },
        },
      };
    });
  },

  reset: () =>
    set({
      pages: createDefaultPages(),
      sharedComponents: {},
    }),
}));

export { defaultPageId };
