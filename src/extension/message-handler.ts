import * as vscode from 'vscode';
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
      handleSaveProject(message.payload, panel);
      break;

    case 'loadProject':
      handleLoadProject(panel);
      break;

    case 'writeFile':
      handleWriteFile(message.payload, panel);
      break;

    case 'selectOutputPath':
      handleSelectOutputPath(message.payload, panel);
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
    console.log('[Lattice] Starting generation with model:', payload.model);
    const response = await aiService.generate(payload, (chunk) => {
      // Stream each text chunk back to the webview
      panel.postMessage({
        type: 'generateChunk',
        id: requestId,
        payload: { text: chunk },
      });
    });

    console.log('[Lattice] Generation complete, code length:', response.code.length);
    // Send the final completed response
    panel.postMessage({
      type: 'generateComplete',
      id: requestId,
      payload: response,
    });
  } catch (error) {
    console.error('[Lattice] Generation error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during generation';
    console.error('[Lattice] Error message:', errorMessage);
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

// --- File Operations ---

async function handleWriteFile(
  payload: { path: string; content: string; confirm: boolean },
  panel: LatticePanel
) {
  try {
    const fileUri = vscode.Uri.file(payload.path);

    // Check if file already exists when confirm is requested
    if (payload.confirm) {
      try {
        await vscode.workspace.fs.stat(fileUri);
        // File exists — ask user to confirm overwrite
        const overwrite = await vscode.window.showWarningMessage(
          `File already exists: ${vscode.workspace.asRelativePath(fileUri)}. Overwrite?`,
          { modal: true },
          'Overwrite'
        );
        if (overwrite !== 'Overwrite') {
          panel.postMessage({ type: 'fileWriteCancelled' });
          return;
        }
      } catch {
        // File doesn't exist — no confirmation needed, proceed
      }
    }

    // Create parent directories if they don't exist
    const parentDir = vscode.Uri.joinPath(fileUri, '..');
    try {
      await vscode.workspace.fs.stat(parentDir);
    } catch {
      await vscode.workspace.fs.createDirectory(parentDir);
    }

    // Write the file
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(payload.content));

    // Send success response
    panel.postMessage({
      type: 'fileSaved',
      payload: { path: payload.path },
    });

    // Open the file in the editor
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: true,
    });
  } catch (error) {
    console.error('[Lattice] Failed to write file:', error);
    panel.postMessage({
      type: 'error',
      payload: {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to write file',
      },
    });
  }
}

async function handleSelectOutputPath(
  payload: { suggestedName: string },
  panel: LatticePanel
) {
  try {
    // Determine the default URI based on workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultUri = workspaceFolders?.[0]
      ? vscode.Uri.joinPath(workspaceFolders[0].uri, payload.suggestedName)
      : undefined;

    const result = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        'Component Files': ['tsx', 'jsx', 'ts', 'js', 'vue', 'svelte'],
        'All Files': ['*'],
      },
      title: 'Save Component File',
    });

    panel.postMessage({
      type: 'pathSelected',
      payload: { path: result?.fsPath ?? null },
    });
  } catch (error) {
    console.error('[Lattice] Failed to open save dialog:', error);
    panel.postMessage({
      type: 'pathSelected',
      payload: { path: null },
    });
  }
}

// --- Project Persistence ---

function getLatticeDir(): vscode.Uri | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return null;
  return vscode.Uri.joinPath(workspaceFolders[0].uri, '.lattice');
}

function getProjectFileUri(): vscode.Uri | null {
  const dir = getLatticeDir();
  if (!dir) return null;
  return vscode.Uri.joinPath(dir, 'project.json');
}

async function handleSaveProject(
  project: import('../shared/types').LatticeProject,
  panel: LatticePanel
) {
  try {
    const fileUri = getProjectFileUri();
    if (!fileUri) {
      panel.postMessage({
        type: 'error',
        payload: { message: 'No workspace folder open — cannot save project' },
      });
      return;
    }

    // Ensure .lattice directory exists
    const dir = getLatticeDir()!;
    try {
      await vscode.workspace.fs.stat(dir);
    } catch {
      await vscode.workspace.fs.createDirectory(dir);
    }

    const encoder = new TextEncoder();
    const json = JSON.stringify(project, null, 2);
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(json));
  } catch (error) {
    console.error('[Lattice] Failed to save project:', error);
    panel.postMessage({
      type: 'error',
      payload: {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save project',
      },
    });
  }
}

async function handleLoadProject(panel: LatticePanel) {
  try {
    const fileUri = getProjectFileUri();
    if (!fileUri) {
      panel.postMessage({ type: 'projectLoaded', payload: null });
      return;
    }

    try {
      const data = await vscode.workspace.fs.readFile(fileUri);
      const decoder = new TextDecoder();
      const project = JSON.parse(decoder.decode(data));
      panel.postMessage({ type: 'projectLoaded', payload: project });
    } catch {
      // File doesn't exist yet — that's fine
      panel.postMessage({ type: 'projectLoaded', payload: null });
    }
  } catch (error) {
    console.error('[Lattice] Failed to load project:', error);
    panel.postMessage({ type: 'projectLoaded', payload: null });
  }
}
