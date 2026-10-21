import { describe, expect, it } from 'vitest';
import { AVAILABLE_MOLDS, MOLD_REGISTRY, moldForSurface } from './mold-registry';

describe('registro de moldes oficiais', () => {
  it('mantém vínculos únicos entre superfície e arquivo oficial', () => {
    expect(new Set(MOLD_REGISTRY.map(({ surfaceId }) => surfaceId)).size).toBe(
      MOLD_REGISTRY.length,
    );
    expect(AVAILABLE_MOLDS).toHaveLength(6);
    expect(AVAILABLE_MOLDS.every(({ url, sha256 }) => url && sha256?.length === 64)).toBe(true);
  });

  it('registra a tira superior como pendente sem inventar um arquivo', () => {
    expect(moldForSurface('side-top')).toMatchObject({
      label: 'Tira Superior da Lateral',
      url: null,
      sha256: null,
    });
  });
});
