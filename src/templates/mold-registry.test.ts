import { describe, expect, it } from 'vitest';
import { AVAILABLE_MOLDS, MOLD_REGISTRY, moldForSurface } from './mold-registry';

describe('registro de moldes oficiais', () => {
  it('mantém vínculos únicos entre superfície e arquivo oficial', () => {
    expect(new Set(MOLD_REGISTRY.map(({ surfaceId }) => surfaceId)).size).toBe(
      MOLD_REGISTRY.length,
    );
    expect(AVAILABLE_MOLDS).toHaveLength(8);
    expect(AVAILABLE_MOLDS.every(({ url, sha256 }) => url && sha256?.length === 64)).toBe(true);
  });

  it('disponibiliza os dois moldes adicionais das laterais', () => {
    expect(moldForSurface('side-rear')).toMatchObject({
      label: 'Lateral Traseira',
      url: '/moldes/karv-chair/v2/lateral-rear.pdf',
    });
    expect(moldForSurface('side-top')).toMatchObject({
      label: 'Tira Superior da Lateral',
      url: '/moldes/karv-chair/v2/lateral-top.pdf',
    });
  });
});
