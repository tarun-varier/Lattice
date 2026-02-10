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
  const setSetupDialogOpen = useUiStore((s) => s.setSetupDialogOpen);

  // Set up AI response listeners (generateChunk, generateComplete, generateError)
  useAIListeners();

  // Set up state persistence (VSCode webview state + .lattice/ directory)
  usePersistence();

  // Show setup dialog on first load if setup hasn't been completed
  useEffect(() => {
    if (!isSetupComplete) {
      setSetupDialogOpen(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HostBridgeProvider>
      <EditorLayout />
      <SetupDialog />
      <ToastContainer />
    </HostBridgeProvider>
  );
}
