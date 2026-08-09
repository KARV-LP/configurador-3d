import { describe, expect, it } from 'vitest';
import { filterMaterials, parsePublicCatalog } from './public-catalog';

const endpoint = 'https://example.test/public/v1/catalog.json';
const material = {
  id: 'fabric-kv-001',
  channel: 'fabric',
  name: 'Tecido Preto',
  collection: 'Coleção A',
  color: { name: 'Preto', family: 'preto' },
  material_type: 'veludo',
  technologies: [],
  functional: {
    pet_friendly: false,
    water_repellency: false,
    easy_clean: false,
    indoor_use: true,
    outdoor_use: false,
  },
  appearance: { texture: 'lisa', touch: 'macio', sheen: 'baixo', visual_character: ['neutro'] },
  physical_reference_cm: { width: 120, height: 60 },
  assets: {
    preview: './assets/fabric-kv-001/preview.webp',
    base_color: './assets/fabric-kv-001/base-color.webp',
    normal: null,
    ao: null,
  },
  published: true,
  ready_for_configurator: true,
  pbr_ready: false,
  compatibility: { geometry_ids: ['karv-chair'], min_geometry_version: 2 },
};

function catalog(items: unknown[]) {
  return {
    schema: 'karv.public-material-catalog/1',
    channels: ['fabric', 'karv_design'],
    materials: items,
  };
}

describe('public material catalog', () => {
  it('valida e resolve somente assets do namespace público', () => {
    const parsed = parsePublicCatalog(catalog([material]), endpoint);
    expect(parsed.materials).toHaveLength(1);
    expect(parsed.materials[0]?.assets.preview).toBe(
      'https://example.test/public/v1/assets/fabric-kv-001/preview.webp',
    );
  });

  it('rejeita item com metadata privada sem derrubar itens válidos', () => {
    const privateKey = ['sup', 'plier'].join('');
    const privateItem = { ...material, id: 'fabric-kv-002', [privateKey]: 'privado' };
    const parsed = parsePublicCatalog(catalog([material, privateItem]), endpoint);
    expect(parsed.materials.map((entry) => entry.id)).toEqual(['fabric-kv-001']);
    expect(parsed.rejectedCount).toBe(1);
  });

  it('remove itens não publicados ou incompatíveis', () => {
    const unpublished = { ...material, id: 'fabric-kv-002', published: false };
    const incompatible = {
      ...material,
      id: 'fabric-kv-003',
      compatibility: { geometry_ids: ['outra-geometria'], min_geometry_version: 1 },
    };
    const parsed = parsePublicCatalog(catalog([material, unpublished, incompatible]), endpoint);
    expect(parsed.materials).toHaveLength(1);
    expect(parsed.rejectedCount).toBe(2);
  });

  it('filtra por Cor → Material → Tecido usando metadata', () => {
    const second = {
      ...material,
      id: 'fabric-kv-002',
      name: 'Sarja Verde',
      color: { name: 'Musgo', family: 'verde' },
      material_type: 'sarja',
      assets: {
        ...material.assets,
        preview: './assets/fabric-kv-002/preview.webp',
        base_color: './assets/fabric-kv-002/base-color.webp',
      },
    };
    const parsed = parsePublicCatalog(catalog([material, second]), endpoint);
    expect(
      filterMaterials(parsed.materials, {
        channel: 'fabric',
        colorFamily: 'verde',
        materialType: 'sarja',
      }),
    ).toHaveLength(1);
  });
});
