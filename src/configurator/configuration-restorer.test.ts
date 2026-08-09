import { describe, expect, it } from 'vitest';
import type { PublicMaterial } from '../materials/public-catalog';
import type { SerializedConfigurationV1 } from './config-serializer';
import { resolveConfigurationMaterials } from './configuration-restorer';

const integrity = Object.freeze({
  sha256: 'a'.repeat(64),
  widthPx: 2048,
  heightPx: 1024,
  bytes: 1000,
});

const productionMaterial: PublicMaterial = Object.freeze({
  id: 'fabric-kv-002',
  channel: 'fabric',
  name: 'Croma Musgo Pet Friendly',
  collection: 'Croma',
  color: Object.freeze({ name: 'Musgo', family: 'verde' }),
  materialType: 'sarjado peletizado',
  technologies: Object.freeze([]),
  functional: Object.freeze({
    petFriendly: true,
    waterRepellency: null,
    easyClean: null,
    indoorUse: true,
    outdoorUse: null,
  }),
  appearance: Object.freeze({
    texture: null,
    touch: null,
    sheen: null,
    visualCharacter: Object.freeze([]),
  }),
  physicalReferenceCm: Object.freeze({ width: 120, height: 60 }),
  assets: Object.freeze({
    preview: 'https://example.test/preview.webp',
    baseColor: 'https://example.test/base-color.webp',
    normal: 'https://example.test/normal.webp',
    ao: 'https://example.test/ao.webp',
  }),
  assetIntegrity: Object.freeze({ baseColor: integrity, normal: integrity, ao: integrity }),
  pbr: Object.freeze({
    status: 'production',
    roughnessFactor: 0.88,
    metalness: 0,
    normalConvention: 'opengl',
    normalStrength: 1,
    aoStrength: 1,
  }),
  pbrReady: true,
});

const payload: SerializedConfigurationV1 = Object.freeze({
  schema_version: 1,
  geometry: Object.freeze({ id: 'karv-chair', version: 2, sha256: 'b'.repeat(64) }),
  assignments: Object.freeze({ seat: 'fabric-kv-002' }),
});

describe('resolveConfigurationMaterials', () => {
  it('resolve somente IDs canônicos para material PBR público', () => {
    const resolved = resolveConfigurationMaterials(payload, [productionMaterial]);
    expect(resolved.seat?.id).toBe('fabric-kv-002');
    expect(resolved.seat?.publicName).toBe('Croma Musgo Pet Friendly');
  });

  it('rejeita ID removido da Biblioteca', () => {
    expect(() => resolveConfigurationMaterials(payload, [])).toThrow('Material indisponível');
  });

  it('rejeita material público que ainda não possui PBR de produção', () => {
    const previewOnly: PublicMaterial = Object.freeze({
      ...productionMaterial,
      pbrReady: false,
      pbr: null,
      assetIntegrity: null,
      assets: Object.freeze({ ...productionMaterial.assets, normal: null, ao: null }),
    });
    expect(() => resolveConfigurationMaterials(payload, [previewOnly])).toThrow(
      'Material sem acabamento 3D disponível',
    );
  });
});
