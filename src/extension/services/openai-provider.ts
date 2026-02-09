// ============================================================
// Lattice — OpenAI Provider (raw fetch, streaming SSE)
// ============================================================

import type { GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, StreamChunkCallback } from './ai-provider';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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
    const shouldStream = request.stream !== false && !!onChunk;

    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.prompt },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      stream: shouldStream,
    };

    // Include stream_options to get usage data even when streaming
    if (shouldStream) {
      body.stream_options = { include_usage: true };
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage: string;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed.error?.message || `OpenAI API error: ${response.status}`;
      } catch {
        errorMessage = `OpenAI API error: ${response.status} — ${errorBody.slice(0, 200)}`;
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
    const code = data.choices?.[0]?.message?.content ?? '';
    return {
      code: this._stripCodeFences(code),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
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
      throw new Error('OpenAI: response body is not readable');
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
        // Keep incomplete last line in buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6); // strip 'data: '
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }

            // Usage comes in the final chunk when stream_options.include_usage is true
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
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
   * The prompt instructs models not to, but this is a safety net.
   */
  private _stripCodeFences(code: string): string {
    const trimmed = code.trim();
    // Match ```lang\n...\n``` or ```\n...\n```
    const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1];
    }
    return trimmed;
  }
}
