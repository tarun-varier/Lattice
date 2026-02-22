// ============================================================
// Lattice — OpenAI Provider (using Vercel AI SDK)
// ============================================================

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, StreamChunkCallback } from './ai-provider';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly name = 'OpenAI';
  readonly models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  readonly defaultModel = 'gpt-4o';

  async generate(
    request: GenerateRequest,
    apiKey: string,
    onChunk?: StreamChunkCallback
  ): Promise<GenerateResponse> {
    const openai = createOpenAI({
      apiKey,
    });

    const model = openai(request.model || this.defaultModel);

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
      throw new Error(`OpenAI error: ${message}`);
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
