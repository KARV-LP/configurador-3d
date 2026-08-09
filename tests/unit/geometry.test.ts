import { describe, expect, it } from 'vitest';
import { CANONICAL_GEOMETRY } from '../../src/domain/geometry';

describe('canonical geometry', () => {
  it('pins the F0 geometry identity and hash', () => {
    expect(CANONICAL_GEOMETRY.id).toBe('karv-chair');
    expect(CANONICAL_GEOMETRY.version).toBe(2);
    expect(CANONICAL_GEOMETRY.sha256).toBe(
      '878a8b89aa330da1dc7a4be00a5de6c0321ab1273c90c414ed1f22fc851df1bf',
    );
  });

  it('points to the canonical GLB asset', () => {
    expect(CANONICAL_GEOMETRY.assetUrl).toContain(
      '/assets/geometry/karv-chair/v2/base.glb',
    );
  });
});
