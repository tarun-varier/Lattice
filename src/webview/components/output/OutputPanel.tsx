import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Code,
  MessageSquare,
  Clock,
  Target,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Save,
  FolderOpen,
  Loader2,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { useGenerationStore } from '../../stores/generation-store';
import { useLayoutStore } from '../../stores/layout-store';
import { useContextStore } from '../../stores/context-store';
import { useShiki } from '../../hooks/use-shiki';
import { useFileSave } from '../../hooks/use-file-save';
import { suggestFilePath } from '../../lib/file-utils';

export function OutputPanel() {
  const activeTab = useUiStore((s) => s.previewTab);
  const setActiveTab = useUiStore((s) => s.setPreviewTab);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab header */}
      <div className="flex items-center gap-0 border-b border-border flex-shrink-0">
        <TabButton
          active={activeTab === 'code'}
          onClick={() => setActiveTab('code')}
          icon={<Code className="w-3.5 h-3.5" />}
          label="Code"
        />
        <TabButton
          active={activeTab === 'prompt'}
          onClick={() => setActiveTab('prompt')}
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Prompt"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'code' ? <CodeTab /> : <PromptTab />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2',
        active
          ? 'text-foreground border-primary'
          : 'text-muted-foreground border-transparent hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ---- Code Tab ----

function CodeTab() {
  const selectedBoxId = useUiStore((s) => s.selectedBoxId);
  const results = useGenerationStore((s) => s.results);
  const generating = useGenerationStore((s) => s.generating);
  const streamBuffers = useGenerationStore((s) => s.streamBuffers);
  const revertToVersion = useGenerationStore((s) => s.revertToVersion);
  const boxes = useLayoutStore((s) => s.boxes);
  const framework = useContextStore((s) => s.context.framework);
  const language = useContextStore((s) => s.context.language);
  const outputDirectory = useContextStore((s) => s.context.outputDirectory);
  const namingConvention = useContextStore((s) => s.context.componentNamingConvention);

  const { highlight, resolveLanguage, isLoading: shikiLoading } = useShiki();
  const fileSave = useFileSave();

  // Version navigation state
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);

  // File save bar state
  const [showSaveBar, setShowSaveBar] = useState(false);
  const [filePath, setFilePath] = useState('');

  const result = selectedBoxId ? results[selectedBoxId] : null;
  const isGenerating = selectedBoxId ? generating[selectedBoxId] : false;
  const streamBuffer = selectedBoxId ? streamBuffers[selectedBoxId] : null;
  const selectedBox = selectedBoxId ? boxes[selectedBoxId] : null;

  // Reset history view and save bar when switching boxes
  const [lastBoxId, setLastBoxId] = useState<string | null>(null);
  if (selectedBoxId !== lastBoxId) {
    setLastBoxId(selectedBoxId);
    setViewingHistoryIndex(null);
    setShowSaveBar(false);
    fileSave.resetStatus();
  }

  // Determine which version to display
  const allVersions = useMemo(() => {
    if (!result) return [];
    return [result.current, ...result.history];
  }, [result]);

  const currentVersionIndex = viewingHistoryIndex ?? 0;
  const displayVersion = allVersions[currentVersionIndex] ?? null;
  const totalVersions = allVersions.length;

  // Resolve the Shiki language for this project
  const lang = resolveLanguage(framework, language);

  // Highlighted HTML for the current code
  const highlightedHtml = useMemo(() => {
    if (!displayVersion?.code) return null;
    return highlight(displayVersion.code, lang);
  }, [displayVersion?.code, lang, highlight]);

  // Highlighted HTML for the streaming buffer
  const streamHighlightedHtml = useMemo(() => {
    if (!streamBuffer) return null;
    return highlight(streamBuffer, lang);
  }, [streamBuffer, lang, highlight]);

  const handlePrev = useCallback(() => {
    setViewingHistoryIndex((prev) => {
      const idx = prev ?? 0;
      return Math.min(idx + 1, totalVersions - 1);
    });
  }, [totalVersions]);

  const handleNext = useCallback(() => {
    setViewingHistoryIndex((prev) => {
      const idx = prev ?? 0;
      if (idx <= 0) return null; // back to current
      return idx - 1;
    });
  }, []);

  const handleRevert = useCallback(() => {
    if (!selectedBoxId || !displayVersion || viewingHistoryIndex === null || viewingHistoryIndex === 0) return;
    revertToVersion(selectedBoxId, displayVersion.id);
    setViewingHistoryIndex(null);
  }, [selectedBoxId, displayVersion, viewingHistoryIndex, revertToVersion]);

  // Open the save bar with a suggested file path
  const handleOpenSaveBar = useCallback(() => {
    if (!selectedBox) return;
    const suggested = suggestFilePath(
      selectedBox.label,
      outputDirectory,
      framework,
      language,
      namingConvention
    );
    setFilePath(suggested);
    setShowSaveBar(true);
    fileSave.resetStatus();
  }, [selectedBox, outputDirectory, framework, language, namingConvention, fileSave]);

  // Handle save button click
  const handleSave = useCallback(() => {
    if (!displayVersion || !filePath.trim()) return;
    fileSave.saveFile(filePath.trim(), displayVersion.code, true);
  }, [displayVersion, filePath, fileSave]);

  // Handle browse button — ask extension for file picker
  const handleBrowse = useCallback(() => {
    if (!selectedBox) return;
    const suggested = suggestFilePath(
      selectedBox.label,
      outputDirectory,
      framework,
      language,
      namingConvention
    );
    fileSave.selectPath(suggested);
  }, [selectedBox, outputDirectory, framework, language, namingConvention, fileSave]);

  // When a path is selected from the save dialog, update the file path input
  useEffect(() => {
    if (fileSave.selectedPath) {
      setFilePath(fileSave.selectedPath);
    }
  }, [fileSave.selectedPath]);

  // Streaming state
  if (isGenerating && streamBuffer) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Generating {selectedBox?.label || 'component'}...
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {streamHighlightedHtml ? (
            <div
              className="shiki-container text-xs leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:m-0 [&_code]:!text-xs"
              dangerouslySetInnerHTML={{ __html: streamHighlightedHtml }}
            />
          ) : (
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words p-4">
              {streamBuffer}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Completed generation result
  if (result && displayVersion) {
    const isViewingOlder = viewingHistoryIndex !== null && viewingHistoryIndex > 0;

    return (
      <div className="flex flex-col h-full">
        {/* Version header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {selectedBox?.label || 'Component'}
            </span>
            {totalVersions > 1 && (
              <div className="flex items-center gap-1">
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                  onClick={handlePrev}
                  disabled={currentVersionIndex >= totalVersions - 1}
                  title="Older version"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-muted-foreground font-mono min-w-[3ch] text-center">
                  {totalVersions - currentVersionIndex}/{totalVersions}
                </span>
                <button
                  className="p-0.5 text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                  onClick={handleNext}
                  disabled={currentVersionIndex <= 0}
                  title="Newer version"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {isViewingOlder && (
              <button
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium"
                onClick={handleRevert}
                title="Make this the current version"
              >
                <History className="w-3 h-3" />
                Restore
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={cn(
                'p-1 rounded transition-colors',
                showSaveBar
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => showSaveBar ? setShowSaveBar(false) : handleOpenSaveBar()}
              title={showSaveBar ? 'Close save bar' : 'Save to file'}
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <CopyButton text={displayVersion.code} />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {new Date(displayVersion.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Save to file bar */}
        {showSaveBar && (
          <SaveBar
            filePath={filePath}
            onFilePathChange={setFilePath}
            onSave={handleSave}
            onBrowse={handleBrowse}
            onClose={() => setShowSaveBar(false)}
            status={fileSave.status}
            savedPath={fileSave.savedPath}
            errorMessage={fileSave.errorMessage}
          />
        )}

        {/* Code content */}
        <div className="flex-1 overflow-auto">
          {highlightedHtml ? (
            <div
              className="shiki-container text-xs leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:m-0 [&_code]:!text-xs"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap break-words leading-relaxed p-4">
              {displayVersion.code}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <Code className="w-8 h-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No code generated yet</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        {selectedBoxId
          ? 'Click "Generate Page" or use the generate button on a box'
          : 'Select a box to see its generated code'}
      </p>
      {shikiLoading && (
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          Loading syntax highlighter...
        </p>
      )}
    </div>
  );
}

// ---- Save Bar ----

function SaveBar({
  filePath,
  onFilePathChange,
  onSave,
  onBrowse,
  onClose,
  status,
  savedPath,
  errorMessage,
}: {
  filePath: string;
  onFilePathChange: (path: string) => void;
  onSave: () => void;
  onBrowse: () => void;
  onClose: () => void;
  status: 'idle' | 'saving' | 'saved' | 'cancelled' | 'error';
  savedPath: string | null;
  errorMessage: string | null;
}) {
  return (
    <div className="border-b border-border bg-muted/30 flex-shrink-0">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* File path input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={filePath}
            onChange={(e) => onFilePathChange(e.target.value)}
            placeholder="src/components/MyComponent.tsx"
            className="w-full text-xs font-mono bg-background border border-border rounded px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onClose();
            }}
            disabled={status === 'saving'}
          />
        </div>

        {/* Browse button */}
        <button
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted/50 transition-colors disabled:opacity-50"
          onClick={onBrowse}
          disabled={status === 'saving'}
          title="Browse..."
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* Save button */}
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50',
            status === 'saved'
              ? 'bg-green-600/20 text-green-400 border border-green-600/30'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
          onClick={onSave}
          disabled={status === 'saving' || status === 'saved' || !filePath.trim()}
          title="Save file"
        >
          {status === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {status === 'saved' && <CheckCircle className="w-3.5 h-3.5" />}
          {status !== 'saving' && status !== 'saved' && <Save className="w-3.5 h-3.5" />}
          {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Saved' : 'Save'}
        </button>

        {/* Close button */}
        <button
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          onClick={onClose}
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status messages */}
      {status === 'saved' && savedPath && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px] text-green-400">
          <CheckCircle className="w-3 h-3" />
          Saved to {savedPath}
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px] text-muted-foreground">
          Write cancelled
        </div>
      )}
      {status === 'error' && errorMessage && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px] text-red-400">
          <XCircle className="w-3 h-3" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}

// ---- Copy Button ----

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not work in all webview contexts
      // Fall back to execCommand
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error('[Lattice] Failed to copy to clipboard');
      }
    }
  }, [text]);

  return (
    <button
      className={cn(
        'p-1 rounded transition-colors',
        copied
          ? 'text-green-400'
          : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy code'}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ---- Prompt Tab ----

function PromptTab() {
  const lastPrompt = useGenerationStore((s) => s.lastPrompt);

  if (!lastPrompt) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No prompt yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Click "Generate Page" to preview the prompt that will be sent to the AI
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Prompt header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {lastPrompt.target === 'page' ? 'Page' : 'Box'}: {lastPrompt.targetName}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {new Date(lastPrompt.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Prompt content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* System prompt section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              System Prompt
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words leading-relaxed bg-muted/30 rounded-md p-3 border border-border/50">
            {lastPrompt.systemPrompt}
          </pre>
        </div>

        {/* User prompt section */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              User Prompt
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words leading-relaxed bg-muted/30 rounded-md p-3 border border-border/50">
            {lastPrompt.userPrompt}
          </pre>
        </div>
      </div>
    </div>
  );
}
