import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from './public-catalog';
import { toProductionPbrMaterial } from './pbr-material';

const endpoint = 'https://example.test/public/v1/catalog.json';
const integrity = {
  base_color: { sha256: 'a'.repeat(64), width_px: 2048, height_px: 1024, bytes: 500000 },
  normal: { sha256: 'b'.repeat(64), width_px: 2048, height_px: 1024, bytes: 1500000 },
  ao: { sha256: 'c'.repeat(64), width_px: 2048, height_px: 1024, bytes: 300000 },
};
const pbrMaterial = {
  id: 'fabric-kv-002',
  channel: 'fabric',
  name: 'Croma Musgo',
  collection: 'All Colours',
  color: { name: 'Musgo', family: 'verde' },
  material_type: 'sarjado',
  technologies: ['Pet Friendly'],
  functional: {
    pet_friendly: true,
    water_repellency: true,
    easy_clean: true,
    indoor_use: true,
    outdoor_use: true,
  },
  appearance: {
    texture: 'sarja',
    touch: 'macio',
    sheen: 'baixo',
    visual_character: ['natural'],
  },
  physical_reference_cm: { width: 120, height: 60 },
  assets: {
    preview: './assets/fabric-kv-002/preview.webp',
    base_color: './assets/fabric-kv-002/base-color.webp',
    normal: './assets/fabric-kv-002/normal.webp',
    ao: './assets/fabric-kv-002/ao.webp',
  },
  asset_integrity: integrity,
  pbr: {
    status: 'production',
    roughness_factor: 0.88,
    metalness: 0,
    normal_convention: 'opengl',
    normal_strength: 1,
    ao_strength: 1,
  },
  published: true,
  ready_for_configurator: true,
  pbr_ready: true,
  compatibility: { geometry_ids: ['karv-chair'], min_geometry_version: 2 },
};

function catalog(materials: unknown[]) {
  return {
    schema: 'karv.public-material-catalog/1',
    channels: ['fabric', 'karv_design'],
    materials,
  };
}

describe('public production PBR contract', () => {
  it('converte material publicado em definição runtime genérica', () => {
    const parsed = parsePublicCatalog(catalog([pbrMaterial]), endpoint).materials[0];
    if (!parsed) throw new Error('Material PBR não parseado.');
    const runtime = toProductionPbrMaterial(parsed);

    expect(runtime).not.toBeNull();
    expect(runtime?.physical).toEqual({ widthM: 1.2, heightM: 0.6 });
    expect(runtime?.roughnessFactor).toBe(0.88);
    expect(runtime?.metalness).toBe(0);
    expect(runtime?.normal.uri).toBe(
      'https://example.test/public/v1/assets/fabric-kv-002/normal.webp',
    );
  });

  it('rejeita pbr_ready sem integridade, sem derrubar outro material válido', () => {
    const incomplete = { ...pbrMaterial, id: 'fabric-kv-003', asset_integrity: undefined };
    const parsed = parsePublicCatalog(catalog([pbrMaterial, incomplete]), endpoint);
    expect(parsed.materials.map((material) => material.id)).toEqual(['fabric-kv-002']);
    expect(parsed.rejectedCount).toBe(1);
  });
});
