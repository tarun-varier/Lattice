import { Settings, Play, Plus, ChevronDown } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store';
import { useUiStore } from '../../stores/ui-store';

export function Toolbar() {
  const pages = useProjectStore((s) => s.pages);
  const activePageId = useUiStore((s) => s.activePageId);
  const toggleSettings = useUiStore((s) => s.toggleSettings);
  const activePage = pages.find((p) => p.id === activePageId);

  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-border bg-background flex-shrink-0">
      {/* Left: Logo + Page selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Lattice
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Page selector (placeholder — will become a proper dropdown) */}
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <span>{activePage?.name ?? 'Home'}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="w-3 h-3" />
          <span>Page</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          disabled
          title="Generate all components on this page"
        >
          <Play className="w-3 h-3" />
          <span>Generate Page</span>
        </button>

        <button
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
          title="Settings"
          onClick={toggleSettings}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
