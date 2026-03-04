import { create } from 'zustand';
import type { ProjectContext, DesignTokens } from '@shared/types';

interface ContextState {
  context: ProjectContext;
  isSetupComplete: boolean;
  persistenceReady: boolean;
  workspaceFolderName: string | null;

  setContext: (context: ProjectContext) => void;
  updateContext: (patch: Partial<ProjectContext>) => void;
  updateDesignTokens: (patch: Partial<DesignTokens>) => void;
  setSetupComplete: (complete: boolean) => void;
  setPersistenceReady: (ready: boolean) => void;
  setWorkspaceFolderName: (name: string | null) => void;
  reset: () => void;
}

const defaultDesignTokens: DesignTokens = {
  primaryColor: '#2563eb',
  secondaryColor: '#64748b',
  accentColor: '#f59e0b',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  fontFamily: 'sans',
  borderRadius: 'md',
  spacing: 'normal',
};

const defaultContext: ProjectContext = {
  name: 'Untitled Project',
  framework: 'react',
  language: 'typescript',
  uiLibrary: 'tailwind',
  designTokens: defaultDesignTokens,
  styleTone: 'minimalist',
  constraints: [],
};

export const useContextStore = create<ContextState>((set) => ({
  context: defaultContext,
  isSetupComplete: false,
  persistenceReady: false,
  workspaceFolderName: null,

  setContext: (context: ProjectContext) => set({ context }),

  updateContext: (patch: Partial<ProjectContext>) =>
    set((s) => ({
      context: { ...s.context, ...patch },
    })),

  updateDesignTokens: (patch: Partial<DesignTokens>) =>
    set((s) => ({
      context: {
        ...s.context,
        designTokens: { ...s.context.designTokens, ...patch },
      },
    })),

  setSetupComplete: (complete: boolean) =>
    set({ isSetupComplete: complete }),

  setPersistenceReady: (ready: boolean) =>
    set({ persistenceReady: ready }),

  setWorkspaceFolderName: (name: string | null) =>
    set({ workspaceFolderName: name }),

  reset: () =>
    set({
      context: defaultContext,
      isSetupComplete: false,
      persistenceReady: false,
      workspaceFolderName: null,
    }),
}));
