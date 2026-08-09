import {
  CONFIGURATION_QUERY_PARAM,
  ConfigSerializer,
  ConfigurationValidationError,
  type SerializedConfigurationV1,
} from './config-serializer';
import type { CoreConfigurationSnapshot } from './configuration-store';

export const CONFIGURATION_STORAGE_KEY = 'karv.configurator.configuration.v1';

export interface ConfigurationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ConfigurationCandidate =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'valid';
      readonly source: 'url' | 'storage';
      readonly token: string;
      readonly payload: SerializedConfigurationV1;
    }
  | {
      readonly kind: 'invalid';
      readonly source: 'url' | 'storage';
      readonly error: ConfigurationValidationError;
    };

export class ConfigurationSession {
  constructor(
    private readonly serializer: ConfigSerializer,
    private readonly storage: ConfigurationStorage | null,
  ) {}

  resolve(currentUrl: string): ConfigurationCandidate {
    const url = new URL(currentUrl);
    const explicitToken = url.searchParams.get(CONFIGURATION_QUERY_PARAM);
    if (explicitToken !== null) {
      try {
        return Object.freeze({
          kind: 'valid',
          source: 'url',
          token: explicitToken,
          payload: this.serializer.decode(explicitToken),
        });
      } catch (error) {
        return Object.freeze({
          kind: 'invalid',
          source: 'url',
          error: this.asValidationError(error),
        });
      }
    }

    const stored = this.readStorage();
    if (!stored) return Object.freeze({ kind: 'none' });
    try {
      return Object.freeze({
        kind: 'valid',
        source: 'storage',
        token: stored,
        payload: this.serializer.decode(stored),
      });
    } catch (error) {
      this.clear();
      return Object.freeze({
        kind: 'invalid',
        source: 'storage',
        error: this.asValidationError(error),
      });
    }
  }

  persist(snapshot: CoreConfigurationSnapshot): string | null {
    const hasAssignments = Object.values(snapshot.assignments).some(
      (materialId) => materialId !== null,
    );
    if (!hasAssignments) {
      this.clear();
      return null;
    }

    const token = this.serializer.encode(snapshot);
    try {
      this.storage?.setItem(CONFIGURATION_STORAGE_KEY, token);
    } catch {
      // Persistência local é conveniência; o estado em memória continua válido.
    }
    return token;
  }

  createShareUrl(currentUrl: string, snapshot: CoreConfigurationSnapshot): string {
    const token = this.serializer.encode(snapshot);
    const url = new URL(currentUrl);
    url.searchParams.set(CONFIGURATION_QUERY_PARAM, token);
    url.hash = '';
    return url.href;
  }

  syncExistingShareUrl(currentUrl: string, token: string | null): string | null {
    const url = new URL(currentUrl);
    if (!url.searchParams.has(CONFIGURATION_QUERY_PARAM)) return null;
    if (token) url.searchParams.set(CONFIGURATION_QUERY_PARAM, token);
    else url.searchParams.delete(CONFIGURATION_QUERY_PARAM);
    return url.href;
  }

  clear(): void {
    try {
      this.storage?.removeItem(CONFIGURATION_STORAGE_KEY);
    } catch {
      // Falha de storage não deve quebrar o configurador.
    }
  }

  private readStorage(): string | null {
    try {
      return this.storage?.getItem(CONFIGURATION_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private asValidationError(error: unknown): ConfigurationValidationError {
    if (error instanceof ConfigurationValidationError) return error;
    return new ConfigurationValidationError(
      'invalid-payload',
      'Configuração persistida inválida.',
      {
        cause: error,
      },
    );
  }
}
