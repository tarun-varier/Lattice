import { useEffect } from 'react';
import { HostBridgeProvider } from './hooks/use-host-bridge';
import { EditorLayout } from './components/editor/EditorLayout';
import { SetupDialog } from './components/dialogs/SetupDialog';
import { ToastContainer } from './components/ui/ToastContainer';
import { useContextStore } from './stores/context-store';
import { useUiStore } from './stores/ui-store';
import { useAIListeners } from './hooks/use-ai-listeners';
import { usePersistence } from './hooks/use-persistence';

export function App() {
  const isSetupComplete = useContextStore((s) => s.isSetupComplete);
  const persistenceReady = useContextStore((s) => s.persistenceReady);
  const setSetupDialogOpen = useUiStore((s) => s.setSetupDialogOpen);

  // Set up AI response listeners (generateChunk, generateComplete, generateError)
  useAIListeners();

  // Set up state persistence (VSCode webview state + .lattice/ directory)
  usePersistence();

  // Show setup dialog only after persistence has loaded and setup hasn't been completed
  useEffect(() => {
    if (persistenceReady && !isSetupComplete) {
      setSetupDialogOpen(true);
    }
  }, [persistenceReady, isSetupComplete, setSetupDialogOpen]);

  return (
    <HostBridgeProvider>
      <EditorLayout />
      <SetupDialog />
      <ToastContainer />
    </HostBridgeProvider>
  );
}
