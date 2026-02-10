import { useEffect } from 'react';
import { getHostBridge } from '../lib/host-bridge';
import { useGenerationStore } from '../stores/generation-store';
import { useLayoutStore } from '../stores/layout-store';
import { useProjectStore } from '../stores/project-store';
import { useUiStore } from '../stores/ui-store';
import { notify } from '../stores/notification-store';
import type { ResponseMessage } from '@shared/protocol';

/**
 * Hook that sets up listeners for AI generation responses from the extension host.
 * Routes generateChunk, generateComplete, and generateError messages
 * to the generation store based on the requestId → boxId mapping.
 *
 * Should be called once at the app root level.
 */
export function useAIListeners() {
  useEffect(() => {
    const bridge = getHostBridge();
    const store = useGenerationStore;
    const uiStore = useUiStore;

    // Handle streaming text chunks
    const unsubChunk = bridge.on('generateChunk', (msg: ResponseMessage) => {
      if (msg.type !== 'generateChunk') return;
      const boxId = store.getState().getBoxIdForRequest(msg.id);
      if (boxId) {
        store.getState().appendChunk(boxId, msg.payload.text);
      }
    });

    // Handle generation completion
    const unsubComplete = bridge.on('generateComplete', (msg: ResponseMessage) => {
      if (msg.type !== 'generateComplete') return;
      const state = store.getState();
      const boxId = state.getBoxIdForRequest(msg.id);
      if (boxId) {
        const code = msg.payload.code;
        const lastPrompt = state.lastPrompt;
        const prompt = lastPrompt?.userPrompt ?? '';

        // Complete the generation with the final code
        state.completeGeneration(
          boxId,
          code,
          prompt,
          'ai', // provider name — we can refine this later from config
          ''    // model — same
        );

        // Clean up the request mapping
        state.clearRequest(msg.id);

        // Switch to Code tab to show the result
        uiStore.getState().setPreviewTab('code');

        // If this box is an instance of a shared component,
        // store the latest generated code on the shared component
        const box = useLayoutStore.getState().boxes[boxId];
        if (box?.sharedComponentId) {
          useProjectStore.getState().updateSharedComponent(
            box.sharedComponentId,
            { latestCode: code }
          );
        }

        notify.success('Code generation complete');
      }
    });

    // Handle generation errors
    const unsubError = bridge.on('generateError', (msg: ResponseMessage) => {
      if (msg.type !== 'generateError') return;
      const state = store.getState();
      const boxId = state.getBoxIdForRequest(msg.id);
      if (boxId) {
        state.failGeneration(boxId);
        state.clearRequest(msg.id);
      }

      notify.error(`Generation failed: ${msg.payload.message}`);
    });

    return () => {
      unsubChunk();
      unsubComplete();
      unsubError();
    };
  }, []);
}
