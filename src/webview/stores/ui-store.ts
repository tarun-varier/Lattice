import { create } from 'zustand';
import { defaultPageId } from './project-store';

type PreviewTab = 'code' | 'prompt';

interface UiState {
  selectedBoxId: string | null;
  activePageId: string;
  previewTab: PreviewTab;
  settingsOpen: boolean;
  setupDialogOpen: boolean;

  // Actions
  selectBox: (boxId: string | null) => void;
  setActivePageId: (pageId: string) => void;
  setPreviewTab: (tab: PreviewTab) => void;
  setSettingsOpen: (open: boolean) => void;
  setSetupDialogOpen: (open: boolean) => void;
  toggleSettings: () => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedBoxId: null,
  activePageId: defaultPageId,
  previewTab: 'code',
  settingsOpen: false,
  setupDialogOpen: false,

  selectBox: (boxId: string | null) => set({ selectedBoxId: boxId }),

  setActivePageId: (pageId: string) =>
    set({ activePageId: pageId, selectedBoxId: null }),

  setPreviewTab: (tab: PreviewTab) => set({ previewTab: tab }),

  setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),

  setSetupDialogOpen: (open: boolean) => set({ setupDialogOpen: open }),

  toggleSettings: () =>
    set((s) => ({ settingsOpen: !s.settingsOpen })),

  reset: () =>
    set({
      selectedBoxId: null,
      activePageId: defaultPageId,
      previewTab: 'code',
      settingsOpen: false,
      setupDialogOpen: false,
    }),
}));
