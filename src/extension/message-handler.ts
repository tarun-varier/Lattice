import type { RequestMessage } from '../shared/protocol';
import type { LatticePanel } from './webview-provider';
import type { AIService } from './services/ai-service';

/**
 * Handle messages from the webview.
 * Routes each message type to the appropriate service.
 */
export function handleMessage(
  message: RequestMessage,
  panel: LatticePanel,
  aiService: AIService
) {
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
      handleGenerate(message.id, message.payload, panel, aiService);
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
      handleGetAIConfig(panel, aiService);
      break;

    case 'setAIConfig':
      handleSetAIConfig(message.payload, panel, aiService);
      break;

    default:
      console.warn('[Lattice] Unknown message type:', (message as any).type);
  }
}

// --- AI Generation ---

async function handleGenerate(
  requestId: string,
  payload: import('../shared/types').GenerateRequest,
  panel: LatticePanel,
  aiService: AIService
) {
  try {
    const response = await aiService.generate(payload, (chunk) => {
      // Stream each text chunk back to the webview
      panel.postMessage({
        type: 'generateChunk',
        id: requestId,
        payload: { text: chunk },
      });
    });

    // Send the final completed response
    panel.postMessage({
      type: 'generateComplete',
      id: requestId,
      payload: response,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during generation';
    panel.postMessage({
      type: 'generateError',
      id: requestId,
      payload: { message: errorMessage },
    });
  }
}

// --- AI Config ---

async function handleGetAIConfig(panel: LatticePanel, aiService: AIService) {
  try {
    const config = await aiService.getConfig();
    panel.postMessage({
      type: 'aiConfig',
      payload: config,
    });
  } catch (error) {
    console.error('[Lattice] Failed to get AI config:', error);
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
  }
}

async function handleSetAIConfig(
  config: import('../shared/types').AIConfig,
  panel: LatticePanel,
  aiService: AIService
) {
  try {
    await aiService.setConfig(config);
    // Confirm by sending back the updated config
    const updatedConfig = await aiService.getConfig();
    panel.postMessage({
      type: 'aiConfig',
      payload: updatedConfig,
    });
  } catch (error) {
    console.error('[Lattice] Failed to set AI config:', error);
    panel.postMessage({
      type: 'error',
      payload: {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save AI configuration',
      },
    });
  }
}
