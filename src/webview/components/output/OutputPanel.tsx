import { Code, MessageSquare, Clock, Target } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { useGenerationStore } from '../../stores/generation-store';
import { useLayoutStore } from '../../stores/layout-store';

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
  const boxes = useLayoutStore((s) => s.boxes);

  // Show code for the selected box if it has a generation result
  const result = selectedBoxId ? results[selectedBoxId] : null;
  const isGenerating = selectedBoxId ? generating[selectedBoxId] : false;
  const streamBuffer = selectedBoxId ? streamBuffers[selectedBoxId] : null;
  const selectedBox = selectedBoxId ? boxes[selectedBoxId] : null;

  // If streaming, show the buffer
  if (isGenerating && streamBuffer) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Generating {selectedBox?.label || 'component'}...
          </span>
        </div>
        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words">
          {streamBuffer}
        </pre>
      </div>
    );
  }

  // If we have a result, show the code
  if (result) {
    const version = result.current;
    const historyCount = result.history.length;

    return (
      <div className="flex flex-col h-full">
        {/* Version header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {selectedBox?.label || 'Component'}
            </span>
            {historyCount > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {historyCount + 1} version{historyCount > 0 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {new Date(version.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Code content */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
            {version.code}
          </pre>
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
    </div>
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
