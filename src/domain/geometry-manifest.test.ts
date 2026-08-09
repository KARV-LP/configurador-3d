import { describe, expect, it } from 'vitest';
import {
  CANONICAL_GEOMETRY_ID,
  CANONICAL_GEOMETRY_VERSION,
  parseCanonicalGeometryManifest,
} from './geometry-manifest';

const validManifest = {
  schema: 'karv.geometry.manifest/1',
  geometry_id: CANONICAL_GEOMETRY_ID,
  geometry_version: CANONICAL_GEOMETRY_VERSION,
  asset: {
    file: 'base.glb',
    byte_length: 647_280,
    sha256: '8'.repeat(64),
    required_extensions: ['KHR_draco_mesh_compression'],
  },
};

describe('parseCanonicalGeometryManifest', () => {
  it('aceita a geometria canônica esperada', () => {
    const manifest = parseCanonicalGeometryManifest(validManifest);

    expect(manifest.geometryId).toBe('karv-chair');
    expect(manifest.geometryVersion).toBe(2);
    expect(manifest.byteLength).toBe(647_280);
  });

  it('rejeita outra geometry_version', () => {
    expect(() => parseCanonicalGeometryManifest({ ...validManifest, geometry_version: 3 })).toThrow(
      'Geometria canônica incompatível',
    );
  });

  it('rejeita um hash não canônico', () => {
    expect(() =>
      parseCanonicalGeometryManifest({
        ...validManifest,
        asset: { ...validManifest.asset, sha256: 'inválido' },
      }),
    ).toThrow('Asset canônico inválido');
  });
});
