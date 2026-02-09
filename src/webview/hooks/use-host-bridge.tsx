import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { HostBridge, getHostBridge } from '../lib/host-bridge';

const HostBridgeContext = createContext<HostBridge | null>(null);

export function HostBridgeProvider({ children }: { children: ReactNode }) {
  const bridgeRef = useRef<HostBridge>(getHostBridge());

  // Notify the host that the webview is ready
  useEffect(() => {
    bridgeRef.current.send({ type: 'ready' });
  }, []);

  return (
    <HostBridgeContext.Provider value={bridgeRef.current}>
      {children}
    </HostBridgeContext.Provider>
  );
}

export function useHostBridge(): HostBridge {
  const bridge = useContext(HostBridgeContext);
  if (!bridge) {
    throw new Error('useHostBridge must be used within a HostBridgeProvider');
  }
  return bridge;
}
