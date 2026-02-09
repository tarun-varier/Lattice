import { useState } from 'react';
import { Code, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';

type OutputTab = 'code' | 'prompt';

export function OutputPanel() {
  const [activeTab, setActiveTab] = useState<OutputTab>('code');

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
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'code' ? <CodePlaceholder /> : <PromptPlaceholder />}
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

function CodePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Code className="w-8 h-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No code generated yet</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Select a box and click Generate to see code here
      </p>
    </div>
  );
}

function PromptPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No prompt yet</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        The prompt sent to the AI will appear here after generation
      </p>
    </div>
  );
}
