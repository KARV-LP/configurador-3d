export const PBR_MAX_IDLE_TEXTURES = 6;
export const PBR_TEXTURES_PER_ACTIVE_SURFACE = 3;

interface CacheEntry<T> {
  readonly promise: Promise<T>;
  refs: number;
  lastUsed: number;
}

export interface TextureCacheStats {
  readonly entries: number;
  readonly active: number;
  readonly idle: number;
  readonly hits: number;
  readonly misses: number;
}

export interface TextureLease<T> {
  readonly texture: T;
  release(): void;
}

export class TextureCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private clock = 0;
  private hitCount = 0;
  private missCount = 0;

  constructor(private readonly maxIdleEntries = PBR_MAX_IDLE_TEXTURES) {
    if (!Number.isInteger(maxIdleEntries) || maxIdleEntries < 0) {
      throw new Error('Budget de cache inválido.');
    }
  }

  async acquire(key: string, createTexture: () => Promise<T>): Promise<TextureLease<T>> {
    let entry = this.entries.get(key);
    if (entry) {
      this.hitCount += 1;
    } else {
      this.missCount += 1;
      const promise = createTexture().catch((error: unknown) => {
        this.entries.delete(key);
        throw error;
      });
      entry = { promise, refs: 0, lastUsed: ++this.clock };
      this.entries.set(key, entry);
    }

    entry.refs += 1;
    entry.lastUsed = ++this.clock;
    try {
      const texture = await entry.promise;
      let released = false;
      return Object.freeze({
        texture,
        release: () => {
          if (released) return;
          released = true;
          this.release(key);
        },
      });
    } catch (error) {
      entry.refs = Math.max(0, entry.refs - 1);
      throw error;
    }
  }

  clearUnused(): void {
    for (const [key, entry] of this.entries) {
      if (entry.refs === 0) this.entries.delete(key);
    }
  }

  stats(): TextureCacheStats {
    const active = [...this.entries.values()].filter((entry) => entry.refs > 0).length;
    return Object.freeze({
      entries: this.entries.size,
      active,
      idle: this.entries.size - active,
      hits: this.hitCount,
      misses: this.missCount,
    });
  }

  private release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    entry.lastUsed = ++this.clock;
    this.trimIdle();
  }

  private trimIdle(): void {
    const idle = [...this.entries.entries()]
      .filter(([, entry]) => entry.refs === 0)
      .sort(([, left], [, right]) => left.lastUsed - right.lastUsed);
    while (idle.length > this.maxIdleEntries) {
      const oldest = idle.shift();
      if (oldest) this.entries.delete(oldest[0]);
    }
  }
}
