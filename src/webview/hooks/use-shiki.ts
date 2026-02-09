import { useState, useEffect, useCallback, useRef } from 'react';
import type { HighlighterGeneric, BundledLanguage, BundledTheme } from 'shiki/bundle/web';

type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>;

/**
 * Mapping from Lattice framework/language to Shiki language identifiers.
 */
const FRAMEWORK_LANG_MAP: Record<string, string> = {
  react: 'tsx',
  nextjs: 'tsx',
  vue: 'vue',
  nuxt: 'vue',
  svelte: 'svelte',
  sveltekit: 'svelte',
  vanilla: 'html',
};

/**
 * Lazily loads a Shiki highlighter instance (singleton).
 * Returns a `highlight` function that converts code to HTML.
 *
 * The highlighter is loaded asynchronously on first mount,
 * so `highlight` returns null until ready.
 */
export function useShiki() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Dynamic import to keep the bundle split
        const { createHighlighter } = await import('shiki/bundle/web');
        const instance = await createHighlighter({
          themes: ['github-dark'],
          langs: ['tsx', 'jsx', 'typescript', 'javascript', 'vue', 'svelte', 'html', 'css'],
        });

        if (!cancelled) {
          setHighlighter(instance);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Lattice] Failed to initialize Shiki:', err);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Highlight code and return an HTML string.
   * Returns null if the highlighter is not yet loaded.
   */
  const highlight = useCallback(
    (code: string, lang?: string): string | null => {
      if (!highlighter) return null;

      // Resolve lang, falling back to tsx
      const resolvedLang = lang || 'tsx';

      try {
        return highlighter.codeToHtml(code, {
          lang: resolvedLang as BundledLanguage,
          theme: 'github-dark',
        });
      } catch {
        // If the language isn't loaded, fall back to plain text
        try {
          return highlighter.codeToHtml(code, {
            lang: 'text' as BundledLanguage,
            theme: 'github-dark',
          });
        } catch {
          return null;
        }
      }
    },
    [highlighter]
  );

  /**
   * Resolve the Shiki language from framework + language settings.
   */
  const resolveLanguage = useCallback(
    (framework: string, language: string): string => {
      // If TypeScript, prefer TSX/TS variant
      const frameworkLang = FRAMEWORK_LANG_MAP[framework];
      if (frameworkLang) {
        // For TS frameworks that map to tsx, keep tsx
        // For JS frameworks, downgrade to jsx
        if (frameworkLang === 'tsx' && language === 'javascript') return 'jsx';
        return frameworkLang;
      }
      return language === 'typescript' ? 'tsx' : 'jsx';
    },
    []
  );

  return { highlight, resolveLanguage, isLoading };
}
