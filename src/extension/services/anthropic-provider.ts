// ============================================================
// Lattice — Anthropic Provider (raw fetch, streaming SSE)
// ============================================================

import type { GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, StreamChunkCallback } from './ai-provider';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

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
    const shouldStream = request.stream !== false && !!onChunk;

    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.prompt }],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      stream: shouldStream,
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage =
          parsed.error?.message || `Anthropic API error: ${response.status}`;
      } catch {
        errorMessage = `Anthropic API error: ${response.status} — ${errorBody.slice(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    if (shouldStream) {
      return this._handleStream(response, onChunk!);
    } else {
      return this._handleNonStream(response);
    }
  }

  private async _handleNonStream(response: Response): Promise<GenerateResponse> {
    const data = (await response.json()) as any;
    // Anthropic returns content as an array of blocks
    const textBlock = data.content?.find(
      (b: { type: string }) => b.type === 'text'
    );
    const code = textBlock?.text ?? '';
    return {
      code: this._stripCodeFences(code),
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }

  private async _handleStream(
    response: Response,
    onChunk: StreamChunkCallback
  ): Promise<GenerateResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Anthropic: response body is not readable');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: { promptTokens: number; completionTokens: number } | undefined;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);

            // Anthropic streaming event types:
            // - content_block_delta: contains text delta
            // - message_delta: contains stop_reason and usage
            // - message_start: contains model info and input usage

            if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text;
              if (text) {
                fullContent += text;
                onChunk(text);
              }
            }

            if (parsed.type === 'message_start' && parsed.message?.usage) {
              usage = {
                promptTokens: parsed.message.usage.input_tokens,
                completionTokens: 0,
              };
            }

            if (parsed.type === 'message_delta' && parsed.usage) {
              usage = {
                promptTokens: usage?.promptTokens ?? 0,
                completionTokens: parsed.usage.output_tokens,
              };
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      code: this._stripCodeFences(fullContent),
      usage,
    };
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
