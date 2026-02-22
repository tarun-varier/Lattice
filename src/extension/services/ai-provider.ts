// ============================================================
// Lattice — AI Provider Interface
// ============================================================

import type { GenerateRequest, GenerateResponse } from '../../shared/types';

/**
 * Callback invoked for each chunk of streamed text.
 */
export type StreamChunkCallback = (text: string) => void;

/**
 * Abstract interface that all AI providers must implement.
 * Each provider wraps a specific API (OpenAI, Anthropic, etc.)
 * using raw HTTP fetch — no SDK dependencies.
 */
export interface AIProvider {
  /** Unique identifier, e.g. 'openai', 'anthropic' */
  readonly id: string;

  /** Human-readable name, e.g. 'OpenAI', 'Anthropic' */
  readonly name: string;

  /** List of models this provider supports */
  readonly models: string[];

  /** Default model for new users */
  readonly defaultModel: string;

  /**
   * Send a generation request.
   * If `onChunk` is provided and the request has `stream: true`,
   * the provider streams text chunks via the callback and resolves
   * with the final assembled code.
   */
  generate(
    request: GenerateRequest,
    apiKey: string,
    onChunk?: StreamChunkCallback
  ): Promise<GenerateResponse>;
}

/**
 * Supported provider IDs — used as discriminant in config.
 */
export type ProviderId = 'openai' | 'anthropic' | 'gemini';

/**
 * Map of provider ID → display info, used for UI dropdowns.
 */
export const PROVIDER_INFO: Record<ProviderId, { name: string; models: string[] }> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
    ],
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      'gemini-2.0-flash-exp',
      'gemini-exp-1206',
      'gemini-2.0-flash-thinking-exp-01-21',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
    ],
  },
};
