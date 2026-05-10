import type { AIProvider, ProviderHealth } from './types.js';
import { createErrorResponse, ErrorCodes } from '../errors/openaiError.js';

class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();

  register(id: string, provider: AIProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw createErrorResponse(
        `Provider '${id}' not found`,
        'invalid_request_error',
        ErrorCodes.PROVIDER_NOT_FOUND,
        404
      );
    }
    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  healthAll(): Record<string, ProviderHealth> {
    const results: Record<string, ProviderHealth> = {};
    for (const [id, provider] of this.providers) {
      try {
        results[id] = { status: 'healthy' };
      } catch {
        results[id] = { status: 'unhealthy', error: 'Health check failed' };
      }
    }
    return results;
  }
}

export const registry = new ProviderRegistry();
export { ProviderRegistry };