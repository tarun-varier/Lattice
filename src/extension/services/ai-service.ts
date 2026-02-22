// ============================================================
// Lattice — AI Service (orchestration layer)
// ============================================================

import * as vscode from 'vscode';
import type { AIConfig, GenerateRequest, GenerateResponse } from '../../shared/types';
import type { AIProvider, ProviderId, StreamChunkCallback } from './ai-provider';
import { PROVIDER_INFO } from './ai-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GeminiProvider } from './gemini-provider';

/** SecretStorage key prefix for API keys */
const SECRET_KEY_PREFIX = 'lattice.apiKey.';

/** Extension globalState key for non-secret AI config */
const CONFIG_STATE_KEY = 'lattice.aiConfig';

/**
 * Central AI service that manages provider instances,
 * API key storage (VSCode SecretStorage), and routes
 * generation requests to the appropriate provider.
 */
export class AIService {
  private _providers: Map<string, AIProvider> = new Map();
  private _secrets: vscode.SecretStorage;
  private _globalState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this._secrets = context.secrets;
    this._globalState = context.globalState;

    // Register built-in providers
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();
    const gemini = new GeminiProvider();
    this._providers.set(openai.id, openai);
    this._providers.set(anthropic.id, anthropic);
    this._providers.set(gemini.id, gemini);
  }

  /**
   * Get the list of registered providers.
   */
  getProviders(): AIProvider[] {
    return Array.from(this._providers.values());
  }

  /**
   * Get a specific provider by ID.
   */
  getProvider(id: string): AIProvider | undefined {
    return this._providers.get(id);
  }

  /**
   * Read the current AI config (provider, model, temperature, etc.)
   * API key is read separately from SecretStorage.
   */
  async getConfig(): Promise<AIConfig> {
    const stored = this._globalState.get<Omit<AIConfig, 'apiKey'>>(CONFIG_STATE_KEY);
    const providerId = stored?.provider ?? 'openai';
    const apiKey = await this._secrets.get(`${SECRET_KEY_PREFIX}${providerId}`);

    return {
      provider: stored?.provider ?? 'openai',
      model: stored?.model ?? 'gpt-4o',
      apiKey: apiKey ?? null,
      temperature: stored?.temperature ?? 0.7,
      maxTokens: stored?.maxTokens ?? 4096,
    };
  }

  /**
   * Save AI config. The API key goes to SecretStorage;
   * everything else goes to globalState.
   */
  async setConfig(config: AIConfig): Promise<void> {
    // Store API key securely if provided
    if (config.apiKey) {
      await this._secrets.store(
        `${SECRET_KEY_PREFIX}${config.provider}`,
        config.apiKey
      );
    }

    // Store non-secret config in globalState
    await this._globalState.update(CONFIG_STATE_KEY, {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  }

  /**
   * Run a generation request against the configured provider.
   * Uses the config's provider/model unless overridden in the request.
   * Streams chunks via `onChunk` if provided.
   */
  async generate(
    request: GenerateRequest,
    onChunk?: StreamChunkCallback
  ): Promise<GenerateResponse> {
    const config = await this.getConfig();
    const providerId = config.provider;
    const provider = this._providers.get(providerId);

    if (!provider) {
      throw new Error(`Unknown AI provider: ${providerId}`);
    }

    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error(
        `No API key configured for ${provider.name}. ` +
        `Open Settings and add your ${provider.name} API key.`
      );
    }

    // Use config defaults for model/temperature/maxTokens if not in request
    const resolvedRequest: GenerateRequest = {
      ...request,
      model: request.model || config.model,
      temperature: request.temperature ?? config.temperature,
      maxTokens: request.maxTokens ?? config.maxTokens,
      stream: request.stream !== false, // default to streaming
    };

    return provider.generate(resolvedRequest, apiKey, onChunk);
  }

  /**
   * Get provider info for the UI (names, available models, etc.)
   */
  getProviderInfo(): Record<ProviderId, { name: string; models: string[] }> {
    return PROVIDER_INFO;
  }
}
