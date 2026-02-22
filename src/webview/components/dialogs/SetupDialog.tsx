import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useContextStore } from '../../stores/context-store';
import { useUiStore } from '../../stores/ui-store';
import { getHostBridge } from '../../lib/host-bridge';
import type {
  ProjectContext,
  DesignTokens,
  Framework,
  UILibrary,
  AIConfig,
} from '@shared/types';

const FRAMEWORKS: { value: Framework; label: string }[] = [
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'nuxt', label: 'Nuxt' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'vanilla', label: 'Vanilla' },
];

const UI_LIBRARIES: { value: UILibrary; label: string }[] = [
  { value: 'tailwind', label: 'Tailwind CSS' },
  { value: 'shadcn', label: 'shadcn/ui' },
  { value: 'mui', label: 'Material UI' },
  { value: 'css-modules', label: 'CSS Modules' },
  { value: 'styled-components', label: 'Styled Components' },
  { value: 'none', label: 'None / Plain CSS' },
];

const BORDER_RADII: { value: DesignTokens['borderRadius']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'full', label: 'Full' },
];

const SPACINGS: { value: DesignTokens['spacing']; label: string }[] = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Spacious' },
];

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
];

const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
    { value: 'gemini-2.5-flash-latest', label: 'Gemini 2.5 Flash Latest' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-pro-latest', label: 'Gemini 2.5 Pro Latest' },
    { value: 'gemini-2.5-flash-8b', label: 'Gemini 2.5 Flash-8B' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
    { value: 'gemini-exp-1206', label: 'Gemini Exp 1206' },
    { value: 'gemini-2.0-flash-thinking-exp-01-21', label: 'Gemini 2.0 Flash Thinking' },
  ],
};

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: null,
  temperature: 0.7,
  maxTokens: 4096,
};

export function SetupDialog() {
  const storeContext = useContextStore((s) => s.context);
  const updateContext = useContextStore((s) => s.updateContext);
  const updateDesignTokens = useContextStore((s) => s.updateDesignTokens);
  const setSetupComplete = useContextStore((s) => s.setSetupComplete);

  const setupDialogOpen = useUiStore((s) => s.setupDialogOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSetupDialogOpen = useUiStore((s) => s.setSetupDialogOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

  // The dialog is visible when either trigger is active
  const isOpen = setupDialogOpen || settingsOpen;

  // Local draft — synced from store when dialog opens
  const [draft, setDraft] = useState<ProjectContext>(storeContext);

  // AI config local draft
  const [aiDraft, setAiDraft] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(storeContext);
      setShowApiKey(false);

      // Request current AI config from extension host
      const bridge = getHostBridge();
      const unsub = bridge.on('aiConfig', (msg) => {
        if (msg.type === 'aiConfig') {
          setAiDraft(msg.payload);
        }
      });
      bridge.send({ type: 'getAIConfig' });

      return () => { unsub(); };
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Close handler ---

  const handleClose = useCallback(() => {
    setSetupDialogOpen(false);
    setSettingsOpen(false);
  }, [setSetupDialogOpen, setSettingsOpen]);

  // --- Save handler ---

  const handleSave = useCallback(() => {
    updateContext(draft);
    updateDesignTokens(draft.designTokens);
    setSetupComplete(true);

    // Save AI config to extension host (API key goes to SecretStorage)
    const bridge = getHostBridge();
    bridge.send({ type: 'setAIConfig', payload: aiDraft });

    handleClose();
  }, [draft, aiDraft, updateContext, updateDesignTokens, setSetupComplete, handleClose]);

  // --- Field helpers ---

  const update = useCallback(
    <K extends keyof ProjectContext>(key: K, value: ProjectContext[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateToken = useCallback(
    <K extends keyof DesignTokens>(key: K, value: DesignTokens[K]) => {
      setDraft((prev) => ({
        ...prev,
        designTokens: { ...prev.designTokens, [key]: value },
      }));
    },
    []
  );

  const addConstraint = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      constraints: [...prev.constraints, ''],
    }));
  }, []);

  const updateConstraint = useCallback((index: number, value: string) => {
    setDraft((prev) => {
      const constraints = [...prev.constraints];
      constraints[index] = value;
      return { ...prev, constraints };
    });
  }, []);

  const removeConstraint = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      constraints: prev.constraints.filter((_, i) => i !== index),
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[560px] max-h-[85vh] bg-popover border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {setupDialogOpen ? 'Project Setup' : 'Project Settings'}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configure your project context for AI code generation
            </p>
          </div>
          <button
            className="p-1 text-muted-foreground hover:text-foreground rounded"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── Section: Project Basics ── */}
          <Section title="Project Basics">
            <Field label="Project Name">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="My App"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Framework">
                <select
                  className={inputClass}
                  value={draft.framework}
                  onChange={(e) =>
                    update('framework', e.target.value as Framework)
                  }
                >
                  {FRAMEWORKS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Language">
                <select
                  className={inputClass}
                  value={draft.language}
                  onChange={(e) =>
                    update(
                      'language',
                      e.target.value as 'typescript' | 'javascript'
                    )
                  }
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="UI Library">
                <select
                  className={inputClass}
                  value={draft.uiLibrary}
                  onChange={(e) =>
                    update('uiLibrary', e.target.value as UILibrary)
                  }
                >
                  {UI_LIBRARIES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Naming Convention">
                <select
                  className={inputClass}
                  value={draft.componentNamingConvention ?? 'PascalCase'}
                  onChange={(e) =>
                    update(
                      'componentNamingConvention',
                      e.target.value as 'PascalCase' | 'kebab-case'
                    )
                  }
                >
                  <option value="PascalCase">PascalCase</option>
                  <option value="kebab-case">kebab-case</option>
                </select>
              </Field>
            </div>

            <Field label="Output Directory" hint="Where generated files are written relative to project root">
              <input
                className={inputClass}
                value={draft.outputDirectory ?? ''}
                onChange={(e) => update('outputDirectory', e.target.value)}
                placeholder="src/components"
              />
            </Field>
          </Section>

          {/* ── Section: Design Tokens ── */}
          <Section title="Design Tokens">
            <div className="grid grid-cols-3 gap-3">
              <ColorField
                label="Primary"
                value={draft.designTokens.primaryColor}
                onChange={(v) => updateToken('primaryColor', v)}
              />
              <ColorField
                label="Secondary"
                value={draft.designTokens.secondaryColor}
                onChange={(v) => updateToken('secondaryColor', v)}
              />
              <ColorField
                label="Accent"
                value={draft.designTokens.accentColor}
                onChange={(v) => updateToken('accentColor', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label="Background"
                value={draft.designTokens.backgroundColor}
                onChange={(v) => updateToken('backgroundColor', v)}
              />
              <ColorField
                label="Text"
                value={draft.designTokens.textColor}
                onChange={(v) => updateToken('textColor', v)}
              />
            </div>

            <Field label="Font Family">
              <input
                className={inputClass}
                value={draft.designTokens.fontFamily}
                onChange={(e) => updateToken('fontFamily', e.target.value)}
                placeholder="sans, Inter, Roboto..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Border Radius">
                <select
                  className={inputClass}
                  value={draft.designTokens.borderRadius}
                  onChange={(e) =>
                    updateToken(
                      'borderRadius',
                      e.target.value as DesignTokens['borderRadius']
                    )
                  }
                >
                  {BORDER_RADII.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Spacing">
                <select
                  className={inputClass}
                  value={draft.designTokens.spacing}
                  onChange={(e) =>
                    updateToken(
                      'spacing',
                      e.target.value as DesignTokens['spacing']
                    )
                  }
                >
                  {SPACINGS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Section: Style & Constraints ── */}
          <Section title="Style & Constraints">
            <Field label="Style Tone" hint="Describe the overall visual feel">
              <input
                className={inputClass}
                value={draft.styleTone}
                onChange={(e) => update('styleTone', e.target.value)}
                placeholder="e.g. minimalist, playful, corporate, brutalist..."
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Constraints
                </label>
                <button
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={addConstraint}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              {draft.constraints.length > 0 ? (
                <div className="space-y-1.5">
                  {draft.constraints.map((c, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        className={cn(inputClass, 'flex-1')}
                        value={c}
                        onChange={(e) => updateConstraint(i, e.target.value)}
                        placeholder="e.g. Must support dark mode, No external fonts..."
                      />
                      <button
                        className="p-0.5 text-muted-foreground/50 hover:text-destructive rounded flex-shrink-0"
                        onClick={() => removeConstraint(i)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/40 italic">
                  No constraints — add project-wide rules for generated code
                </p>
              )}
            </div>

            <Field label="Additional Notes" hint="Any extra context for the AI">
              <textarea
                className={cn(inputClass, 'resize-none')}
                rows={3}
                value={draft.additionalNotes ?? ''}
                onChange={(e) => update('additionalNotes', e.target.value)}
                placeholder="e.g. We use a custom icon set, all components should be server-compatible..."
              />
            </Field>
          </Section>

          {/* ── Section: AI Configuration ── */}
          <Section title="AI Configuration">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider">
                <select
                  className={inputClass}
                  value={aiDraft.provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    const models = PROVIDER_MODELS[provider] ?? [];
                    setAiDraft((prev) => ({
                      ...prev,
                      provider,
                      model: models[0]?.value ?? prev.model,
                    }));
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Model">
                <select
                  className={inputClass}
                  value={aiDraft.model}
                  onChange={(e) =>
                    setAiDraft((prev) => ({ ...prev, model: e.target.value }))
                  }
                >
                  {(PROVIDER_MODELS[aiDraft.provider] ?? []).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="API Key" hint={`Your ${PROVIDERS.find((p) => p.value === aiDraft.provider)?.label ?? ''} API key — stored securely in VSCode`}>
              <div className="flex items-center gap-1.5">
                <input
                  className={cn(inputClass, 'flex-1 font-mono')}
                  type={showApiKey ? 'text' : 'password'}
                  value={aiDraft.apiKey ?? ''}
                  onChange={(e) =>
                    setAiDraft((prev) => ({
                      ...prev,
                      apiKey: e.target.value || null,
                    }))
                  }
                  placeholder={`sk-... or key-...`}
                />
                <button
                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                  onClick={() => setShowApiKey((v) => !v)}
                  title={showApiKey ? 'Hide API key' : 'Show API key'}
                  type="button"
                >
                  {showApiKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperature" hint="0 = deterministic, 1 = creative">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={aiDraft.temperature}
                  onChange={(e) =>
                    setAiDraft((prev) => ({
                      ...prev,
                      temperature: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </Field>

              <Field label="Max Tokens">
                <input
                  className={inputClass}
                  type="number"
                  min="256"
                  max="128000"
                  step="256"
                  value={aiDraft.maxTokens}
                  onChange={(e) =>
                    setAiDraft((prev) => ({
                      ...prev,
                      maxTokens: parseInt(e.target.value) || 4096,
                    }))
                  }
                />
              </Field>
            </div>

            {!aiDraft.apiKey && (
              <p className="text-[10px] text-amber-400/80 mt-1">
                An API key is required for AI generation. You can get one from your provider's dashboard.
              </p>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border flex-shrink-0">
          <button
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={handleSave}
          >
            {setupDialogOpen ? 'Start Building' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ──

const inputClass =
  'w-full bg-input/50 text-foreground text-xs rounded-md border border-border px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50';

// ── Sub-components ──

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-0.5">
        {label}
      </label>
      {hint && (
        <p className="text-[10px] text-muted-foreground/50 mb-1">{hint}</p>
      )}
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          className="w-6 h-6 rounded border border-border cursor-pointer p-0 bg-transparent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className={cn(inputClass, 'flex-1 font-mono')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </Field>
  );
}
