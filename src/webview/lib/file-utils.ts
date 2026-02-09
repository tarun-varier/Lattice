// ============================================================
// Lattice — File Path Utilities
// Helpers for suggesting file names/paths from box labels + project context.
// ============================================================

import type { Framework } from '@shared/types';

/**
 * Convert a label like "Hero Section" to PascalCase → "HeroSection"
 */
function toPascalCase(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a label like "Hero Section" to kebab-case → "hero-section"
 */
function toKebabCase(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .join('-');
}

/**
 * Get the file extension for a given framework + language.
 */
function getFileExtension(
  framework: Framework,
  language: 'typescript' | 'javascript'
): string {
  switch (framework) {
    case 'vue':
    case 'nuxt':
      return '.vue';
    case 'svelte':
    case 'sveltekit':
      return '.svelte';
    default:
      // react, nextjs, vanilla
      return language === 'typescript' ? '.tsx' : '.jsx';
  }
}

/**
 * Convert a box label into a file name using the project naming convention
 * and framework file extension.
 *
 * @example
 * suggestFileName("Hero Section", "react", "typescript", "PascalCase")
 * // → "HeroSection.tsx"
 *
 * suggestFileName("Hero Section", "vue", "typescript", "kebab-case")
 * // → "hero-section.vue"
 */
export function suggestFileName(
  label: string,
  framework: Framework,
  language: 'typescript' | 'javascript',
  namingConvention?: 'PascalCase' | 'kebab-case'
): string {
  const convention = namingConvention ?? 'PascalCase';
  const baseName =
    convention === 'kebab-case' ? toKebabCase(label) : toPascalCase(label);
  const ext = getFileExtension(framework, language);

  // Fallback if label is empty or produces nothing
  if (!baseName) {
    return `Component${ext}`;
  }

  return `${baseName}${ext}`;
}

/**
 * Build a suggested relative file path from box label + project context.
 *
 * @example
 * suggestFilePath("Hero Section", "src/components", "react", "typescript", "PascalCase")
 * // → "src/components/HeroSection.tsx"
 */
export function suggestFilePath(
  label: string,
  outputDirectory: string | undefined,
  framework: Framework,
  language: 'typescript' | 'javascript',
  namingConvention?: 'PascalCase' | 'kebab-case'
): string {
  const fileName = suggestFileName(label, framework, language, namingConvention);
  const dir = outputDirectory?.replace(/\/+$/, '') || 'src/components';
  return `${dir}/${fileName}`;
}
