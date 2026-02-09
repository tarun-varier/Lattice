// ============================================================
// Lattice — Message Protocol (Extension Host <-> Webview)
// ============================================================

import type {
  AIConfig,
  DetectedProject,
  GenerateRequest,
  GenerateResponse,
  LatticeProject,
} from './types';

// --- Webview → Extension Host ---

export type RequestMessage =
  | { type: 'ready' }
  | { type: 'detectProject' }
  | { type: 'generate'; id: string; payload: GenerateRequest }
  | { type: 'saveProject'; payload: LatticeProject }
  | { type: 'loadProject' }
  | {
      type: 'writeFile';
      payload: { path: string; content: string; confirm: boolean };
    }
  | { type: 'selectOutputPath'; payload: { suggestedName: string } }
  | { type: 'getAIConfig' }
  | { type: 'setAIConfig'; payload: AIConfig };

// --- Extension Host → Webview ---

export type ResponseMessage =
  | { type: 'initialized' }
  | { type: 'projectDetected'; payload: DetectedProject }
  | { type: 'projectLoaded'; payload: LatticeProject | null }
  | { type: 'generateChunk'; id: string; payload: { text: string } }
  | { type: 'generateComplete'; id: string; payload: GenerateResponse }
  | { type: 'generateError'; id: string; payload: { message: string } }
  | { type: 'fileSaved'; payload: { path: string } }
  | { type: 'fileWriteCancelled' }
  | { type: 'pathSelected'; payload: { path: string | null } }
  | { type: 'aiConfig'; payload: AIConfig }
  | { type: 'error'; payload: { message: string } };
