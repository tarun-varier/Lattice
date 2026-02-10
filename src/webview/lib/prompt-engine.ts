// ============================================================
// Lattice — Prompt Engine
// Pure functions that assemble AI prompts from box trees + project context.
// ============================================================

import type { Box, BoxSpec, Page, ProjectContext, DesignTokens, SharedComponent } from '@shared/types';

// ---- Public API ----

/**
 * Build the system prompt — project-wide AI instructions.
 */
export function buildSystemPrompt(context: ProjectContext): string {
  const sections: string[] = [];

  sections.push('You are an expert frontend developer. Generate clean, production-ready component code based on the layout specification provided.');

  // Framework & language
  sections.push(frameworkSection(context));

  // UI library
  if (context.uiLibrary !== 'none') {
    sections.push(`UI Library: Use ${formatUILibrary(context.uiLibrary)} for styling and components.`);
  }

  // Design tokens
  sections.push(designTokensSection(context.designTokens));

  // Style tone
  if (context.styleTone) {
    sections.push(`Style Tone: The design should feel "${context.styleTone}".`);
  }

  // Constraints
  if (context.constraints.length > 0) {
    sections.push(
      'Constraints:\n' +
        context.constraints.map((c) => `- ${c}`).join('\n')
    );
  }

  // Additional notes
  if (context.additionalNotes) {
    sections.push(`Additional Notes: ${context.additionalNotes}`);
  }

  // Naming convention
  if (context.componentNamingConvention) {
    sections.push(`Component Naming: Use ${context.componentNamingConvention} for component names and file names.`);
  }

  // Output rules
  sections.push(outputRules(context));

  return sections.join('\n\n');
}

/**
 * Build the user prompt for generating an entire page.
 */
export function buildPagePrompt(
  page: Page,
  allBoxes: Record<string, Box>,
  sharedComponents?: Record<string, SharedComponent>
): string {
  const sections: string[] = [];

  sections.push(`# Page: ${page.name}${page.route ? ` (${page.route})` : ''}`);
  sections.push('Generate the component code for this page based on the following layout specification.');

  // Get top-level boxes for this page
  const topLevelBoxes = page.boxIds
    .map((id) => allBoxes[id])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (topLevelBoxes.length === 0) {
    sections.push('The page is currently empty. Generate a basic page shell/wrapper component.');
    return sections.join('\n\n');
  }

  // Collect shared components referenced by boxes on this page
  const referencedShared = collectReferencedSharedComponents(topLevelBoxes, allBoxes, sharedComponents);
  if (referencedShared.length > 0) {
    sections.push(sharedComponentsSection(referencedShared));
  }

  sections.push(`## Layout\n\nThe page contains ${topLevelBoxes.length} top-level section(s), positioned on a freeform canvas:`);

  for (const box of topLevelBoxes) {
    sections.push(describeBoxTree(box, allBoxes, 0, sharedComponents));
  }

  sections.push('## Instructions\n\n' +
    'Generate a single page component that includes all the sections described above. ' +
    'Each top-level section should be a clearly defined area of the page. ' +
    'Use the spatial positions (x, y, width, height) as hints for relative sizing and ordering, ' +
    'but render them using standard CSS layout (flexbox/grid), not absolute positioning. ' +
    'Sections positioned higher (smaller y) should appear first. ' +
    'Sections side by side (similar y, different x) should be in a row.' +
    (referencedShared.length > 0
      ? ' For shared components, reuse their existing implementation where available.'
      : ''));

  return sections.join('\n\n');
}

/**
 * Build the user prompt for generating a single box (component).
 */
export function buildBoxPrompt(
  box: Box,
  allBoxes: Record<string, Box>,
  sharedComponents?: Record<string, SharedComponent>
): string {
  const sections: string[] = [];

  const componentName = box.label || 'Untitled';
  sections.push(`# Component: ${componentName}`);
  sections.push('Generate the component code for this UI section based on the following specification.');

  // If this box is an instance of a shared component, note that
  if (box.sharedComponentId && sharedComponents?.[box.sharedComponentId]) {
    const sc = sharedComponents[box.sharedComponentId];
    sections.push(`This is an instance of the shared component "${sc.name}".`);
    if (sc.latestCode) {
      sections.push('## Existing Implementation\n\nThe shared component already has a reference implementation:\n\n```\n' + sc.latestCode + '\n```\n\nYou may use this as a starting point or regenerate from scratch based on the spec below.');
    }
  }

  sections.push(describeBoxTree(box, allBoxes, 0, sharedComponents));

  sections.push('## Instructions\n\n' +
    'Generate a single, self-contained component for this section. ' +
    'If the section has child regions, include them as part of this component ' +
    'or as clearly named sub-components within the same file.');

  return sections.join('\n\n');
}

/**
 * Convenience: assemble a full prompt pair (system + user) for a page.
 */
export function assemblePagePrompts(
  page: Page,
  allBoxes: Record<string, Box>,
  context: ProjectContext,
  sharedComponents?: Record<string, SharedComponent>
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: buildSystemPrompt(context),
    userPrompt: buildPagePrompt(page, allBoxes, sharedComponents),
  };
}

/**
 * Convenience: assemble a full prompt pair (system + user) for a single box.
 */
export function assembleBoxPrompts(
  box: Box,
  allBoxes: Record<string, Box>,
  context: ProjectContext,
  sharedComponents?: Record<string, SharedComponent>
): { systemPrompt: string; userPrompt: string } {
  return {
    systemPrompt: buildSystemPrompt(context),
    userPrompt: buildBoxPrompt(box, allBoxes, sharedComponents),
  };
}

// ---- Internal helpers ----

function frameworkSection(context: ProjectContext): string {
  const frameworkNames: Record<string, string> = {
    react: 'React',
    vue: 'Vue 3',
    svelte: 'Svelte',
    nextjs: 'Next.js (App Router)',
    nuxt: 'Nuxt 3',
    sveltekit: 'SvelteKit',
    vanilla: 'vanilla HTML/CSS/JS',
  };
  const fw = frameworkNames[context.framework] ?? context.framework;
  const lang = context.language === 'typescript' ? 'TypeScript' : 'JavaScript';
  return `Framework: ${fw}\nLanguage: ${lang}`;
}

function formatUILibrary(lib: string): string {
  const names: Record<string, string> = {
    tailwind: 'Tailwind CSS',
    shadcn: 'shadcn/ui (with Tailwind CSS)',
    mui: 'Material UI (MUI)',
    'css-modules': 'CSS Modules',
    'styled-components': 'styled-components',
  };
  return names[lib] ?? lib;
}

function designTokensSection(tokens: DesignTokens): string {
  const lines = [
    'Design Tokens:',
    `  Primary: ${tokens.primaryColor}`,
    `  Secondary: ${tokens.secondaryColor}`,
    `  Accent: ${tokens.accentColor}`,
    `  Background: ${tokens.backgroundColor}`,
    `  Text: ${tokens.textColor}`,
    `  Font: ${tokens.fontFamily}`,
    `  Border Radius: ${tokens.borderRadius}`,
    `  Spacing: ${tokens.spacing}`,
  ];
  return lines.join('\n');
}

/**
 * Collect all shared components referenced by a list of boxes (recursively).
 */
function collectReferencedSharedComponents(
  topBoxes: Box[],
  allBoxes: Record<string, Box>,
  sharedComponents?: Record<string, SharedComponent>
): SharedComponent[] {
  if (!sharedComponents) return [];

  const seen = new Set<string>();
  const result: SharedComponent[] = [];

  function walk(box: Box) {
    if (box.sharedComponentId && !seen.has(box.sharedComponentId)) {
      seen.add(box.sharedComponentId);
      const sc = sharedComponents![box.sharedComponentId];
      if (sc) result.push(sc);
    }
    for (const childId of box.childIds) {
      const child = allBoxes[childId];
      if (child) walk(child);
    }
  }

  for (const box of topBoxes) {
    walk(box);
  }

  return result;
}

/**
 * Describe shared components as a prompt section.
 */
function sharedComponentsSection(components: SharedComponent[]): string {
  const lines = ['## Shared Components\n\nThe following shared components are referenced on this page:'];

  for (const sc of components) {
    lines.push(`### ${sc.name}`);
    if (sc.spec.intent) {
      lines.push(`Intent: ${sc.spec.intent}`);
    }
    if (sc.latestCode) {
      lines.push(`Existing implementation:\n\`\`\`\n${sc.latestCode}\n\`\`\``);
    }
    lines.push(`Used ${sc.instanceIds.length} time(s) on this page.`);
  }

  return lines.join('\n\n');
}

function outputRules(context: ProjectContext): string {
  const rules = [
    'Output Rules:',
    '- Return ONLY the component code. No explanations, no markdown fences, no extra commentary.',
    '- Include all necessary imports at the top of the file.',
    '- Use clear, descriptive variable and function names.',
    '- Add brief JSDoc or comments only where the logic is non-obvious.',
    '- Make the component responsive by default.',
    '- Handle edge cases (empty states, loading, errors) where specified.',
  ];

  if (context.framework === 'react' || context.framework === 'nextjs') {
    rules.push('- Export the component as a named export.');
    rules.push('- Use functional components with hooks.');
    if (context.language === 'typescript') {
      rules.push('- Define prop types using TypeScript interfaces.');
    }
  }

  if (context.framework === 'vue' || context.framework === 'nuxt') {
    rules.push('- Use <script setup> syntax with Composition API.');
    if (context.language === 'typescript') {
      rules.push('- Use defineProps with TypeScript generics for prop typing.');
    }
  }

  if (context.framework === 'svelte' || context.framework === 'sveltekit') {
    rules.push('- Use Svelte 5 runes syntax ($state, $derived, $effect) if applicable.');
    if (context.language === 'typescript') {
      rules.push('- Use <script lang="ts"> for type safety.');
    }
  }

  return rules.join('\n');
}

/**
 * Recursively describe a box and its children as a text tree.
 */
function describeBoxTree(
  box: Box,
  allBoxes: Record<string, Box>,
  depth: number,
  sharedComponents?: Record<string, SharedComponent>
): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  // Header
  const name = box.label || 'Unnamed Section';
  const isTopLevel = box.parentId === null;

  if (isTopLevel) {
    lines.push(`${indent}### ${name}`);
    lines.push(`${indent}Position: x=${box.x}, y=${box.y}, size=${box.width}x${box.height}`);
  } else {
    lines.push(`${indent}#### ${name}`);
  }

  // Shared component reference
  if (box.sharedComponentId && sharedComponents?.[box.sharedComponentId]) {
    const sc = sharedComponents[box.sharedComponentId];
    lines.push(`${indent}[Shared Component: "${sc.name}"]`);
  }

  // Spec details
  if (box.spec) {
    lines.push(describeSpec(box.spec, indent));
  }

  // Children
  const children = box.childIds
    .map((id) => allBoxes[id])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (children.length > 0) {
    const dirLabel = box.direction === 'row' ? 'horizontal row' : 'vertical column';
    lines.push(`${indent}Layout: Contains ${children.length} child region(s) in a ${dirLabel}.`);

    for (const child of children) {
      lines.push('');
      lines.push(describeBoxTree(child, allBoxes, depth + 1, sharedComponents));
    }
  }

  return lines.join('\n');
}

/**
 * Describe a box's spec as readable text.
 */
function describeSpec(spec: BoxSpec, indent: string): string {
  const lines: string[] = [];

  if (spec.intent) {
    lines.push(`${indent}Intent: ${spec.intent}`);
  }

  if (spec.dataShape) {
    lines.push(`${indent}Data Shape: ${spec.dataShape}`);
  }

  if (spec.behavior) {
    lines.push(`${indent}Behavior: ${spec.behavior}`);
  }

  // Interaction states
  const interactions = spec.interactions;
  const activeInteractions = Object.entries(interactions).filter(
    ([, value]) => value?.trim()
  );
  if (activeInteractions.length > 0) {
    lines.push(`${indent}Interaction States:`);
    for (const [key, value] of activeInteractions) {
      lines.push(`${indent}  ${key}: ${value}`);
    }
  }

  // Refinements
  const refinements = spec.refinements.filter((r) => r.trim());
  if (refinements.length > 0) {
    lines.push(`${indent}Refinements:`);
    for (const r of refinements) {
      lines.push(`${indent}  - ${r}`);
    }
  }

  return lines.join('\n');
}
