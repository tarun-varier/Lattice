import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { GenerationResult, GenerationVersion } from '@shared/types';

export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  target: 'page' | 'box';
  targetId: string;
  targetName: string;
  timestamp: number;
}

interface GenerationState {
  results: Record<string, GenerationResult>;
  generating: Record<string, boolean>;
  streamBuffers: Record<string, string>;

  /** Maps requestId → boxId for routing streaming responses */
  requestBoxMap: Record<string, string>;

  /** The most recently assembled prompt (for display in Output Panel) */
  lastPrompt: AssembledPrompt | null;

  // Actions
  startGeneration: (boxId: string) => void;
  appendChunk: (boxId: string, text: string) => void;
  completeGeneration: (
    boxId: string,
    code: string,
    prompt: string,
    provider: string,
    model: string
  ) => void;
  failGeneration: (boxId: string) => void;
  revertToVersion: (boxId: string, versionId: string) => void;
  setLastPrompt: (prompt: AssembledPrompt) => void;
  mapRequestToBox: (requestId: string, boxId: string) => void;
  getBoxIdForRequest: (requestId: string) => string | undefined;
  clearRequest: (requestId: string) => void;
  getResult: (boxId: string) => GenerationResult | undefined;
  isGenerating: (boxId: string) => boolean;
  reset: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  results: {},
  generating: {},
  streamBuffers: {},
  requestBoxMap: {},
  lastPrompt: null,

  startGeneration: (boxId: string) => {
    set((s) => ({
      generating: { ...s.generating, [boxId]: true },
      streamBuffers: { ...s.streamBuffers, [boxId]: '' },
    }));
  },

  appendChunk: (boxId: string, text: string) => {
    set((s) => ({
      streamBuffers: {
        ...s.streamBuffers,
        [boxId]: (s.streamBuffers[boxId] ?? '') + text,
      },
    }));
  },

  completeGeneration: (
    boxId: string,
    code: string,
    prompt: string,
    provider: string,
    model: string
  ) => {
    const version: GenerationVersion = {
      id: nanoid(),
      code,
      prompt,
      timestamp: Date.now(),
      provider,
      model,
    };

    set((s) => {
      const existing = s.results[boxId];
      const history = existing
        ? [existing.current, ...existing.history]
        : [];

      return {
        results: {
          ...s.results,
          [boxId]: {
            boxId,
            current: version,
            history,
          },
        },
        generating: { ...s.generating, [boxId]: false },
        streamBuffers: { ...s.streamBuffers, [boxId]: '' },
      };
    });
  },

  failGeneration: (boxId: string) => {
    set((s) => ({
      generating: { ...s.generating, [boxId]: false },
      streamBuffers: { ...s.streamBuffers, [boxId]: '' },
    }));
  },

  revertToVersion: (boxId: string, versionId: string) => {
    set((s) => {
      const result = s.results[boxId];
      if (!result) return s;

      const versionIndex = result.history.findIndex(
        (v) => v.id === versionId
      );
      if (versionIndex === -1) return s;

      const targetVersion = result.history[versionIndex];
      const newHistory = [
        result.current,
        ...result.history.filter((v) => v.id !== versionId),
      ];

      return {
        results: {
          ...s.results,
          [boxId]: {
            ...result,
            current: targetVersion,
            history: newHistory,
          },
        },
      };
    });
  },

  setLastPrompt: (prompt: AssembledPrompt) => {
    set({ lastPrompt: prompt });
  },

  mapRequestToBox: (requestId: string, boxId: string) => {
    set((s) => ({
      requestBoxMap: { ...s.requestBoxMap, [requestId]: boxId },
    }));
  },

  getBoxIdForRequest: (requestId: string) => get().requestBoxMap[requestId],

  clearRequest: (requestId: string) => {
    set((s) => {
      const { [requestId]: _, ...rest } = s.requestBoxMap;
      return { requestBoxMap: rest };
    });
  },

  getResult: (boxId: string) => get().results[boxId],

  isGenerating: (boxId: string) => !!get().generating[boxId],

  reset: () =>
    set({
      results: {},
      generating: {},
      streamBuffers: {},
      requestBoxMap: {},
      lastPrompt: null,
    }),
}));
