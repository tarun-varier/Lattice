// ============================================================
// Lattice — Core Data Models
// ============================================================

// --- Box (the fundamental building block) ---

export interface InteractionStates {
  hover?: string;
  loading?: string;
  error?: string;
  empty?: string;
  success?: string;
}

export interface BoxSpec {
  intent: string;
  interactions: InteractionStates;
  dataShape?: string;
  behavior?: string;
  refinements: string[];
}

export interface Box {
  id: string;
  label: string;

  // Layout within parent (flexbox model)
  order: number;
  grow: number;
  basis?: string;

  // Freeform positioning (used when parentId === null, i.e. top-level)
  x: number;
  y: number;
  width: number;
  height: number;

  // Container behavior (when box has children)
  direction: 'row' | 'column';
  gap: number;
  padding: number;

  // Tree
  parentId: string | null;
  childIds: string[];

  // Spec (inline)
  spec: BoxSpec | null;

  // Reusability
  sharedComponentId?: string;
}

// --- Shared Components ---

export interface SharedComponent {
  id: string;
  name: string;
  spec: BoxSpec;
  latestCode?: string;
  instanceIds: string[];
}

// --- Pages ---

export interface Page {
  id: string;
  name: string;
  route?: string;
  rootDirection: 'column' | 'row';
  boxIds: string[];
}

// --- Project Context ---

export interface DesignTokens {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  spacing: 'tight' | 'normal' | 'spacious';
}

export type Framework =
  | 'react'
  | 'vue'
  | 'svelte'
  | 'nextjs'
  | 'nuxt'
  | 'sveltekit'
  | 'vanilla';

export type UILibrary =
  | 'tailwind'
  | 'shadcn'
  | 'mui'
  | 'css-modules'
  | 'styled-components'
  | 'none';

export interface ProjectContext {
  name: string;
  framework: Framework;
  language: 'typescript' | 'javascript';
  uiLibrary: UILibrary;
  designTokens: DesignTokens;
  styleTone: string;
  constraints: string[];
  additionalNotes?: string;
  outputDirectory?: string;
  componentNamingConvention?: 'PascalCase' | 'kebab-case';
}

// --- Generation ---

export interface GenerationVersion {
  id: string;
  code: string;
  prompt: string;
  timestamp: number;
  provider: string;
  model: string;
}

export interface GenerationResult {
  boxId: string;
  current: GenerationVersion;
  history: GenerationVersion[];
}

// --- AI Config ---

export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string | null;
  temperature: number;
  maxTokens: number;
}

// --- Project Detection ---

export interface DetectedProject {
  framework: Framework | null;
  language: 'typescript' | 'javascript' | null;
  uiLibrary: UILibrary | null;
  rootPath: string | null;
}

// --- AI Requests ---

export interface GenerateRequest {
  prompt: string;
  systemPrompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GenerateResponse {
  code: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// --- Full Project State ---

export interface LatticeProject {
  id: string;
  context: ProjectContext;
  pages: Page[];
  boxes: Record<string, Box>;
  sharedComponents: Record<string, SharedComponent>;
  generations: Record<string, GenerationResult>;
}
