import type { RequestMessage, ResponseMessage } from '@shared/protocol';

type MessageHandler = (message: ResponseMessage) => void;
type MessageUnsubscribe = () => void;

/**
 * Abstraction over the communication channel between the webview UI
 * and the host environment (VSCode extension, Electron, etc.)
 *
 * In VSCode: uses postMessage / onDidReceiveMessage
 * In standalone: could use direct function calls or IPC
 */
export class HostBridge {
  private _vscodeApi: any;
  private _listeners: Map<string, Set<MessageHandler>> = new Map();
  private _globalListeners: Set<MessageHandler> = new Set();
  private _pendingRequests: Map<
    string,
    { resolve: (value: any) => void; reject: (error: any) => void }
  > = new Map();
  private _requestCounter = 0;

  constructor() {
    this._vscodeApi = (window as any).__vscodeApi;

    // Listen for messages from the host
    window.addEventListener('message', (event) => {
      const message = event.data as ResponseMessage;
      this._dispatch(message);
    });
  }

  /**
   * Send a fire-and-forget message to the host
   */
  send(message: RequestMessage): void {
    if (this._vscodeApi) {
      this._vscodeApi.postMessage(message);
    } else {
      console.warn('[HostBridge] No VSCode API available, message dropped:', message);
    }
  }

  /**
   * Listen for a specific message type from the host
   */
  on(type: ResponseMessage['type'], handler: MessageHandler): MessageUnsubscribe {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(handler);

    return () => {
      this._listeners.get(type)?.delete(handler);
    };
  }

  /**
   * Listen for ALL messages from the host
   */
  onAny(handler: MessageHandler): MessageUnsubscribe {
    this._globalListeners.add(handler);
    return () => {
      this._globalListeners.delete(handler);
    };
  }

  /**
   * Save webview state (survives webview hide/show)
   */
  saveState(state: unknown): void {
    if (this._vscodeApi) {
      this._vscodeApi.setState(state);
    }
  }

  /**
   * Restore webview state
   */
  getState<T>(): T | undefined {
    if (this._vscodeApi) {
      return this._vscodeApi.getState() as T | undefined;
    }
    return undefined;
  }

  /**
   * Whether we're running inside VSCode
   */
  get isVSCode(): boolean {
    return this._vscodeApi != null;
  }

  /**
   * Generate a unique request ID
   */
  nextRequestId(): string {
    return `req_${++this._requestCounter}_${Date.now()}`;
  }

  private _dispatch(message: ResponseMessage): void {
    // Notify type-specific listeners
    const typeListeners = this._listeners.get(message.type);
    if (typeListeners) {
      for (const handler of typeListeners) {
        handler(message);
      }
    }

    // Notify global listeners
    for (const handler of this._globalListeners) {
      handler(message);
    }
  }
}

// Singleton instance
let _instance: HostBridge | null = null;

export function getHostBridge(): HostBridge {
  if (!_instance) {
    _instance = new HostBridge();
  }
  return _instance;
}
