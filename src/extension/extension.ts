import * as vscode from 'vscode';
import { LatticePanel } from './webview-provider';

export function activate(context: vscode.ExtensionContext) {
  const openCommand = vscode.commands.registerCommand('lattice.open', () => {
    LatticePanel.createOrShow(context);
  });

  context.subscriptions.push(openCommand);

  // If panel already exists when reloading, restore it
  if (vscode.window.registerWebviewPanelSerializer) {
    vscode.window.registerWebviewPanelSerializer(LatticePanel.viewType, {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        _state: unknown
      ) {
        LatticePanel.revive(webviewPanel, context);
      },
    });
  }
}

export function deactivate() {
  // Cleanup handled by LatticePanel.dispose()
}
