// ============================================================
// Lattice — Anthropic Provider (using Vercel AI SDK)
// ============================================================

import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, StreamChunkCallback } from './ai-provider';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly name = 'Anthropic';
  readonly models = [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ];
  readonly defaultModel = 'claude-sonnet-4-20250514';

  async generate(
    request: GenerateRequest,
    apiKey: string,
    onChunk?: StreamChunkCallback
  ): Promise<GenerateResponse> {
    const anthropic = createAnthropic({
      apiKey,
    });

    const model = anthropic(request.model || this.defaultModel);

    try {
      const result = await streamText({
        model,
        system: request.systemPrompt,
        prompt: request.prompt,
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      });

      let fullContent = '';

      // Stream the text chunks
      for await (const textPart of result.textStream) {
        fullContent += textPart;
        if (onChunk) {
          onChunk(textPart);
        }
      }

      // Get usage info
      const usage = await result.usage;

      return {
        code: this._stripCodeFences(fullContent),
        usage:
          usage && usage.inputTokens !== undefined && usage.outputTokens !== undefined
            ? {
                promptTokens: usage.inputTokens,
                completionTokens: usage.outputTokens,
              }
            : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Anthropic error: ${message}`);
    }
  }

  /**
   * Strip markdown code fences if the model wraps output in them.
   */
  private _stripCodeFences(code: string): string {
    const trimmed = code.trim();
    const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1];
    }
    return trimmed;
  }
}
