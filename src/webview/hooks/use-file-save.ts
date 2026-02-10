import { useState, useEffect, useCallback, useRef } from 'react';
import { getHostBridge } from '../lib/host-bridge';
import { notify } from '../stores/notification-store';
import type { ResponseMessage } from '@shared/protocol';

export type FileSaveStatus = 'idle' | 'saving' | 'saved' | 'cancelled' | 'error';

interface UseFileSaveReturn {
  status: FileSaveStatus;
  savedPath: string | null;
  errorMessage: string | null;
  /** Send a writeFile request to the extension host */
  saveFile: (path: string, content: string, confirm?: boolean) => void;
  /** Open the VSCode save dialog and return the selected path via callback */
  selectPath: (suggestedName: string) => void;
  /** The path returned from the last selectPath call (or null) */
  selectedPath: string | null;
  /** Reset status back to idle */
  resetStatus: () => void;
}

/**
 * Hook that manages file save operations with the extension host.
 * Listens for fileSaved, fileWriteCancelled, pathSelected, and error messages.
 */
export function useFileSave(): UseFileSaveReturn {
  const [status, setStatus] = useState<FileSaveStatus>('idle');
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Track whether we're awaiting a path selection
  const awaitingPath = useRef(false);

  useEffect(() => {
    const bridge = getHostBridge();

    const unsubSaved = bridge.on('fileSaved', (msg: ResponseMessage) => {
      if (msg.type !== 'fileSaved') return;
      setStatus('saved');
      setSavedPath(msg.payload.path);
      notify.success(`File saved: ${msg.payload.path}`);
      // Auto-reset after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    });

    const unsubCancelled = bridge.on('fileWriteCancelled', (msg: ResponseMessage) => {
      if (msg.type !== 'fileWriteCancelled') return;
      setStatus('cancelled');
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    });

    const unsubPath = bridge.on('pathSelected', (msg: ResponseMessage) => {
      if (msg.type !== 'pathSelected') return;
      if (awaitingPath.current) {
        setSelectedPath(msg.payload.path);
        awaitingPath.current = false;
      }
    });

    const unsubError = bridge.on('error', (msg: ResponseMessage) => {
      if (msg.type !== 'error') return;
      // Only handle file-related errors when we're in saving state
      if (status === 'saving') {
        setStatus('error');
        setErrorMessage(msg.payload.message);
        notify.error(`File save failed: ${msg.payload.message}`);
        setTimeout(() => {
          setStatus('idle');
          setErrorMessage(null);
        }, 4000);
      }
    });

    return () => {
      unsubSaved();
      unsubCancelled();
      unsubPath();
      unsubError();
    };
  }, [status]);

  const saveFile = useCallback((path: string, content: string, confirm = true) => {
    const bridge = getHostBridge();
    setStatus('saving');
    setSavedPath(null);
    setErrorMessage(null);
    bridge.send({
      type: 'writeFile',
      payload: { path, content, confirm },
    });
  }, []);

  const selectPath = useCallback((suggestedName: string) => {
    const bridge = getHostBridge();
    awaitingPath.current = true;
    setSelectedPath(null);
    bridge.send({
      type: 'selectOutputPath',
      payload: { suggestedName },
    });
  }, []);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setSavedPath(null);
    setErrorMessage(null);
  }, []);

  return {
    status,
    savedPath,
    errorMessage,
    saveFile,
    selectPath,
    selectedPath,
    resetStatus,
  };
}
