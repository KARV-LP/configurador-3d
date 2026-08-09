import {
  parsePublicCatalog,
  PUBLIC_MATERIAL_CATALOG_URL,
  type PublicCatalog,
} from './public-catalog';
import { validateRuntimeCatalog } from './runtime-catalog-guard';

const CACHE_KEY = 'karv.material-library.public.v1';

export type CatalogSource = 'network' | 'cache';
export interface CatalogLoadResult {
  readonly catalog: PublicCatalog;
  readonly source: CatalogSource;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const nativeFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export class MaterialLibraryClient {
  constructor(
    private readonly endpoint = PUBLIC_MATERIAL_CATALOG_URL,
    private readonly fetcher: FetchLike = nativeFetch,
    private readonly storage: StorageLike | null = typeof localStorage === 'undefined'
      ? null
      : localStorage,
  ) {}

  async load(signal?: AbortSignal): Promise<CatalogLoadResult> {
    try {
      const response = await this.fetcher(this.endpoint, {
        cache: 'no-cache',
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error(`Biblioteca respondeu HTTP ${response.status}.`);
      const raw = await response.json();
      const catalog = validateRuntimeCatalog(parsePublicCatalog(raw, this.endpoint), this.endpoint);
      if (catalog.rejectedCount === 0) this.writeCache(raw);
      return Object.freeze({ catalog, source: 'network' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      const cached = this.readCache();
      if (cached) return Object.freeze({ catalog: cached, source: 'cache' });
      throw new Error('Biblioteca KARV indisponível no momento.', { cause: error });
    }
  }

  private readCache(): PublicCatalog | null {
    try {
      const raw = this.storage?.getItem(CACHE_KEY);
      return raw
        ? validateRuntimeCatalog(parsePublicCatalog(JSON.parse(raw), this.endpoint), this.endpoint)
        : null;
    } catch {
      return null;
    }
  }

  private writeCache(value: unknown): void {
    try {
      this.storage?.setItem(CACHE_KEY, JSON.stringify(value));
    } catch {
      // Cache é otimização; falha de storage não invalida o catálogo de rede.
    }
  }
}
