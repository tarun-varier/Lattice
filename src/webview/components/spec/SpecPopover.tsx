import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLayoutStore } from '../../stores/layout-store';
import { useUiStore } from '../../stores/ui-store';
import type { BoxSpec, InteractionStates } from '@shared/types';

const INTERACTION_KEYS: (keyof InteractionStates)[] = [
  'hover',
  'loading',
  'error',
  'empty',
  'success',
];

const INTERACTION_LABELS: Record<keyof InteractionStates, string> = {
  hover: 'Hover',
  loading: 'Loading',
  error: 'Error',
  empty: 'Empty',
  success: 'Success',
};

function createEmptySpec(): BoxSpec {
  return {
    intent: '',
    interactions: {},
    dataShape: '',
    behavior: '',
    refinements: [],
  };
}

interface SpecPopoverProps {
  /** The scrollable canvas container, used for positioning */
  canvasRef: React.RefObject<HTMLDivElement>;
}

export function SpecPopover({ canvasRef }: SpecPopoverProps) {
  const selectedBoxId = useUiStore((s) => s.selectedBoxId);
  const boxes = useLayoutStore((s) => s.boxes);
  const updateBoxSpec = useLayoutStore((s) => s.updateBoxSpec);

  const selectedBox = selectedBoxId ? boxes[selectedBoxId] : null;
  const popoverRef = useRef<HTMLDivElement>(null);

  // Local draft state — synced from store when selection changes
  const [spec, setSpec] = useState<BoxSpec>(createEmptySpec);
  const [interactionsOpen, setInteractionsOpen] = useState(false);

  // Position state
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Sync spec from store when selected box changes
  useEffect(() => {
    if (selectedBox) {
      setSpec(selectedBox.spec ?? createEmptySpec());
      setInteractionsOpen(false);
    }
  }, [selectedBoxId]); // intentionally only on id change, not box object

  // --- Positioning ---
  // Use fixed (viewport) coordinates so the popover never gets clipped by
  // the scroll container. Prefer right side of box, fall back to left, and
  // ultimately overlap the box if neither side has space.

  const POPOVER_WIDTH = 300;
  const POPOVER_MAX_HEIGHT = 440; // header + 400px body
  const GAP = 8;
  const EDGE_MARGIN = 4;

  const updatePosition = useCallback(() => {
    if (!selectedBoxId || !canvasRef.current) {
      setPosition(null);
      return;
    }

    const boxEl = canvasRef.current.querySelector(
      `[data-box-id="${selectedBoxId}"]`
    ) as HTMLElement | null;

    if (!boxEl) {
      setPosition(null);
      return;
    }

    const boxRect = boxEl.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Try right side of box
    let left = boxRect.right + GAP;

    // If overflows viewport right, try left side of box
    if (left + POPOVER_WIDTH > viewW - EDGE_MARGIN) {
      left = boxRect.left - POPOVER_WIDTH - GAP;
    }

    // If still overflows viewport left, pin to right edge of viewport
    if (left < EDGE_MARGIN) {
      left = Math.min(
        viewW - POPOVER_WIDTH - EDGE_MARGIN,
        boxRect.right + GAP
      );
      // Last resort: just pin to left edge
      if (left < EDGE_MARGIN) {
        left = EDGE_MARGIN;
      }
    }

    // Vertical: align to box top, clamp to viewport
    let top = boxRect.top;
    if (top + POPOVER_MAX_HEIGHT > viewH - EDGE_MARGIN) {
      top = viewH - POPOVER_MAX_HEIGHT - EDGE_MARGIN;
    }
    if (top < EDGE_MARGIN) {
      top = EDGE_MARGIN;
    }

    setPosition({ top, left });
  }, [selectedBoxId, canvasRef]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, selectedBoxId]);

  // Re-position on canvas scroll and window resize
  useEffect(() => {
    if (!selectedBoxId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleUpdate = () => updatePosition();

    canvas.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    // Also watch for layout changes via ResizeObserver on the canvas
    const observer = new ResizeObserver(handleUpdate);
    observer.observe(canvas);

    return () => {
      canvas.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      observer.disconnect();
    };
  }, [selectedBoxId, updatePosition, canvasRef]);

  // --- Auto-save to store on spec change (debounced) ---

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const saveSpec = useCallback(
    (newSpec: BoxSpec) => {
      if (!selectedBoxId) return;
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        // Only save if there's actual content
        const hasContent =
          newSpec.intent.trim() ||
          newSpec.dataShape?.trim() ||
          newSpec.behavior?.trim() ||
          newSpec.refinements.some((r) => r.trim()) ||
          INTERACTION_KEYS.some((k) => newSpec.interactions[k]?.trim());

        updateBoxSpec(selectedBoxId, hasContent ? newSpec : null);
      }, 300);
    },
    [selectedBoxId, updateBoxSpec]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  // --- Field updaters ---

  const updateField = useCallback(
    <K extends keyof BoxSpec>(field: K, value: BoxSpec[K]) => {
      setSpec((prev) => {
        const next = { ...prev, [field]: value };
        saveSpec(next);
        return next;
      });
    },
    [saveSpec]
  );

  const updateInteraction = useCallback(
    (key: keyof InteractionStates, value: string) => {
      setSpec((prev) => {
        const next = {
          ...prev,
          interactions: { ...prev.interactions, [key]: value || undefined },
        };
        saveSpec(next);
        return next;
      });
    },
    [saveSpec]
  );

  const addRefinement = useCallback(() => {
    setSpec((prev) => {
      const next = { ...prev, refinements: [...prev.refinements, ''] };
      saveSpec(next);
      return next;
    });
  }, [saveSpec]);

  const updateRefinement = useCallback(
    (index: number, value: string) => {
      setSpec((prev) => {
        const refinements = [...prev.refinements];
        refinements[index] = value;
        const next = { ...prev, refinements };
        saveSpec(next);
        return next;
      });
    },
    [saveSpec]
  );

  const removeRefinement = useCallback(
    (index: number) => {
      setSpec((prev) => {
        const refinements = prev.refinements.filter((_, i) => i !== index);
        const next = { ...prev, refinements };
        saveSpec(next);
        return next;
      });
    },
    [saveSpec]
  );

  // --- Don't render if nothing selected or can't position ---

  if (!selectedBoxId || !selectedBox || !position) return null;

  return (
    <div
      ref={popoverRef}
      data-spec-popover
      className="fixed z-50 w-[300px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-foreground truncate">
          {selectedBox.label || 'Untitled'} — Spec
        </span>
        <button
          className="p-0.5 text-muted-foreground hover:text-foreground rounded"
          onClick={() => useUiStore.getState().selectBox(null)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="max-h-[400px] overflow-y-auto p-3 space-y-3">
        {/* Intent */}
        <FieldGroup label="Intent" hint="What should this box be / do?">
          <textarea
            className="w-full bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            rows={3}
            placeholder='e.g. "A responsive hero section with a headline, subtext, and CTA button"'
            value={spec.intent}
            onChange={(e) => updateField('intent', e.target.value)}
          />
        </FieldGroup>

        {/* Data Shape */}
        <FieldGroup label="Data Shape" hint="What data flows in?">
          <textarea
            className="w-full bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            rows={2}
            placeholder='e.g. "{ title: string, subtitle: string, ctaUrl: string }"'
            value={spec.dataShape ?? ''}
            onChange={(e) => updateField('dataShape', e.target.value)}
          />
        </FieldGroup>

        {/* Behavior */}
        <FieldGroup label="Behavior" hint="How does it behave?">
          <textarea
            className="w-full bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            rows={2}
            placeholder='e.g. "Fetches hero content on mount, CTA opens in new tab"'
            value={spec.behavior ?? ''}
            onChange={(e) => updateField('behavior', e.target.value)}
          />
        </FieldGroup>

        {/* Interactions (collapsible) */}
        <div>
          <button
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1"
            onClick={() => setInteractionsOpen((o) => !o)}
          >
            {interactionsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Interaction States
            {INTERACTION_KEYS.some((k) => spec.interactions[k]?.trim()) && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            )}
          </button>
          {interactionsOpen && (
            <div className="space-y-2 pl-4 border-l border-border/50 ml-1">
              {INTERACTION_KEYS.map((key) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                    {INTERACTION_LABELS[key]}
                  </label>
                  <input
                    className="w-full bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 mt-0.5"
                    placeholder={`Describe ${key} state...`}
                    value={spec.interactions[key] ?? ''}
                    onChange={(e) => updateInteraction(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refinements */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Refinements
            </span>
            <button
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={addRefinement}
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          {spec.refinements.length > 0 ? (
            <div className="space-y-1.5">
              {spec.refinements.map((r, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    className="flex-1 bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    placeholder="e.g. Must be accessible, Use skeleton loaders..."
                    value={r}
                    onChange={(e) => updateRefinement(i, e.target.value)}
                  />
                  <button
                    className="p-0.5 text-muted-foreground/50 hover:text-destructive rounded flex-shrink-0"
                    onClick={() => removeRefinement(i)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/40 italic">
              No refinements yet — add extra constraints or notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper sub-component ---

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-0.5">
        {label}
      </label>
      <p className="text-[10px] text-muted-foreground/50 mb-1">{hint}</p>
      {children}
    </div>
  );
}
