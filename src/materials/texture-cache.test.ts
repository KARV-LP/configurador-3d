import { describe, expect, it } from 'vitest';
import { TextureCache } from './texture-cache';

describe('TextureCache', () => {
  it('deduplica criação concorrente e contabiliza hit/miss', async () => {
    const cache = new TextureCache<{ id: number }>(2);
    let creates = 0;
    const create = async () => ({ id: ++creates });

    const [first, second] = await Promise.all([
      cache.acquire('same', create),
      cache.acquire('same', create),
    ]);

    expect(first.texture).toBe(second.texture);
    expect(creates).toBe(1);
    expect(cache.stats()).toMatchObject({ entries: 1, active: 1, hits: 1, misses: 1 });

    first.release();
    second.release();
    expect(cache.stats().idle).toBe(1);
  });

  it('mantém somente o budget de entradas ociosas', async () => {
    const cache = new TextureCache<{ key: string }>(2);
    for (const key of ['a', 'b', 'c', 'd']) {
      const lease = await cache.acquire(key, async () => ({ key }));
      lease.release();
    }

    expect(cache.stats()).toMatchObject({ entries: 2, active: 0, idle: 2, misses: 4 });
    cache.clearUnused();
    expect(cache.stats()).toMatchObject({ entries: 0, active: 0, idle: 0 });
  });
});
