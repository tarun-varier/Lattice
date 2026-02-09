import type { RequestMessage } from '../shared/protocol';
import type { LatticePanel } from './webview-provider';

/**
 * Handle messages from the webview.
 * Routes each message type to the appropriate service.
 */
export function handleMessage(message: RequestMessage, panel: LatticePanel) {
  switch (message.type) {
    case 'ready':
      // Webview is ready — send initial state
      panel.postMessage({ type: 'initialized' });
      break;

    case 'detectProject':
      // TODO: Phase 4 — scan workspace for framework/config
      panel.postMessage({
        type: 'projectDetected',
        payload: {
          framework: null,
          language: null,
          uiLibrary: null,
          rootPath: null,
        },
      });
      break;

    case 'generate':
      // TODO: Phase 6 — proxy to AI provider
      panel.postMessage({
        type: 'generateError',
        id: message.id,
        payload: { message: 'AI generation not yet implemented' },
      });
      break;

    case 'saveProject':
      // TODO: Phase 8 — persist to .lattice/ directory
      break;

    case 'loadProject':
      // TODO: Phase 8 — load from .lattice/ directory
      panel.postMessage({ type: 'projectLoaded', payload: null });
      break;

    case 'writeFile':
      // TODO: Phase 8 — write file with confirmation
      break;

    case 'selectOutputPath':
      // TODO: Phase 8 — open file dialog
      panel.postMessage({
        type: 'pathSelected',
        payload: { path: null },
      });
      break;

    case 'getAIConfig':
      // TODO: Phase 6 — read from extension settings / secret storage
      panel.postMessage({
        type: 'aiConfig',
        payload: {
          provider: 'openai',
          model: 'gpt-4o',
          apiKey: null,
          temperature: 0.7,
          maxTokens: 4096,
        },
      });
      break;

    case 'setAIConfig':
      // TODO: Phase 6 — save to extension settings / secret storage
      break;

    default:
      console.warn('[Lattice] Unknown message type:', (message as any).type);
  }
}
