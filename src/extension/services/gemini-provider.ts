// ============================================================
// Lattice — Google Gemini Provider (using Vercel AI SDK)
// ============================================================

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';
import type { GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, StreamChunkCallback } from './ai-provider';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Google Gemini';
  readonly models = [
    'gemini-2.0-flash-exp',
    'gemini-exp-1206',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-2.5-pro-latest',
    'gemini-2.5-pro',
    'gemini-2.5-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-8b',
  ];
  readonly defaultModel = 'gemini-2.5-flash';

  async generate(
    request: GenerateRequest,
    apiKey: string,
    onChunk?: StreamChunkCallback
  ): Promise<GenerateResponse> {
    console.log('[Gemini] Starting generation with model:', request.model || this.defaultModel);
    console.log('[Gemini] Using streaming:', !!onChunk);

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    const modelName = request.model || this.defaultModel;
    const model = google(modelName);

    // Gemini works better when system prompt is combined with user prompt
    const combinedPrompt = request.systemPrompt 
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;

    console.log('[Gemini] Combined prompt length:', combinedPrompt.length);

    try {
      if (onChunk) {
        // Streaming mode
        console.log('[Gemini] Using streaming mode');
        const result = await streamText({
          model,
          prompt: combinedPrompt,
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 8192,
        });

        console.log('[Gemini] streamText returned, reading stream...');
        let fullContent = '';
        let chunkCount = 0;

        try {
          for await (const textPart of result.textStream) {
            chunkCount++;
            console.log(`[Gemini] Chunk ${chunkCount}, length: ${textPart.length}`);
            fullContent += textPart;
            onChunk(textPart);
          }

          console.log('[Gemini] Stream complete. Total chunks:', chunkCount);
          console.log('[Gemini] Full content length:', fullContent.length);

          if (!fullContent || fullContent.trim().length === 0) {
            console.error('[Gemini] Empty stream - trying non-streaming fallback');
            // Fallback to non-streaming
            return this._generateNonStreaming(model, combinedPrompt, request);
          }

          const usage = await result.usage;
          return {
            code: this._stripCodeFences(fullContent),
            usage: usage && usage.inputTokens !== undefined && usage.outputTokens !== undefined
              ? {
                  promptTokens: usage.inputTokens,
                  completionTokens: usage.outputTokens,
                }
              : undefined,
          };
        } catch (streamError) {
          console.error('[Gemini] Stream error:', streamError);
          console.log('[Gemini] Falling back to non-streaming mode');
          // Fallback to non-streaming
          return this._generateNonStreaming(model, combinedPrompt, request);
        }
      } else {
        // Non-streaming mode
        console.log('[Gemini] Using non-streaming mode');
        return this._generateNonStreaming(model, combinedPrompt, request);
      }
    } catch (error) {
      console.error('[Gemini] Top-level error:', error);
      
      if (error instanceof Error) {
        console.error('[Gemini] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        const errorStr = error.message.toLowerCase();
        if (errorStr.includes('api key') || errorStr.includes('authentication') || errorStr.includes('401')) {
          throw new Error(`Gemini authentication error: Please check your API key is valid and has access to the Gemini API.`);
        } else if (errorStr.includes('quota') || errorStr.includes('rate limit') || errorStr.includes('429')) {
          throw new Error(`Gemini quota exceeded: You've reached your API rate limit. Please try again later.`);
        } else if (errorStr.includes('safety') || errorStr.includes('blocked')) {
          throw new Error(`Gemini content blocked: The request was filtered by safety settings. Try rephrasing your prompt.`);
        } else if (errorStr.includes('model') || errorStr.includes('not found') || errorStr.includes('404')) {
          throw new Error(`Gemini model error: The model "${modelName}" may not be available. Try using "gemini-1.5-flash" instead.`);
        }
        
        throw new Error(`Gemini error: ${error.message}`);
      }
      
      throw new Error(`Gemini unknown error: ${String(error)}`);
    }
  }

  private async _generateNonStreaming(
    model: any,
    prompt: string,
    request: GenerateRequest
  ): Promise<GenerateResponse> {
    console.log('[Gemini] Starting non-streaming generation');
    
    const result = await generateText({
      model,
      prompt,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 8192,
    });

    console.log('[Gemini] Non-streaming response received');
    console.log('[Gemini] Response text length:', result.text.length);

    if (!result.text || result.text.trim().length === 0) {
      console.error('[Gemini] Empty response from generateText');
      console.log('[Gemini] Full result:', JSON.stringify(result, null, 2));
      throw new Error('Gemini returned an empty response. Please check:\n1. Your API key has access to Gemini API\n2. The model name is correct\n3. Try using "gemini-1.5-flash" or "gemini-1.5-pro"');
    }

    return {
      code: this._stripCodeFences(result.text),
      usage: result.usage && result.usage.inputTokens !== undefined && result.usage.outputTokens !== undefined
        ? {
            promptTokens: result.usage.inputTokens,
            completionTokens: result.usage.outputTokens,
          }
        : undefined,
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
