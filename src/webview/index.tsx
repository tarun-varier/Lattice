import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

// Acquire VSCode API (available in webview context)
// In standalone mode, this will be undefined
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// Store vscodeApi globally so the host bridge can access it
try {
  (window as any).__vscodeApi = acquireVsCodeApi();
} catch {
  // Running outside VSCode (standalone dev mode)
  (window as any).__vscodeApi = null;
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
