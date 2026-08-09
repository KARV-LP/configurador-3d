import { describe, expect, it } from 'vitest';
import { parsePublicCatalog } from './public-catalog';
import { validateRuntimeCatalog } from './runtime-catalog-guard';

const endpoint =
  'https://example.test/KARV-LP/karv-material-library/main/public/v1/catalog.json';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

function rawMaterial(id = 'fabric-kv-002') {
  return {
    id,
    channel: 'fabric',
    name: 'Croma Musgo',
    collection: 'All Colours',
    color: { name: 'Musgo', family: 'verde' },
    material_type: 'sarjado',
    technologies: [],
    functional: {
      pet_friendly: true,
      water_repellency: false,
      easy_clean: false,
      indoor_use: true,
      outdoor_use: false,
    },
    appearance: {
      texture: 'textura',
      touch: 'macio',
      sheen: 'baixo',
      visual_character: ['teste'],
    },
    physical_reference_cm: { width: 120, height: 60 },
    assets: {
      preview: `./assets/${id}/preview.webp`,
      base_color: `./assets/${id}/base-color.webp`,
      normal: `./assets/${id}/normal.webp`,
      ao: `./assets/${id}/ao.webp`,
    },
    asset_integrity: {
      base_color: { sha256: HASH_A, width_px: 2048, height_px: 1024, bytes: 512800 },
      normal: { sha256: HASH_B, width_px: 2048, height_px: 1024, bytes: 1524084 },
      ao: { sha256: HASH_C, width_px: 2048, height_px: 1024, bytes: 328640 },
    },
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
}

function catalog(materials: unknown[]) {
  return parsePublicCatalog(
    { schema: 'karv.public-material-catalog/1', channels: ['fabric', 'karv_design'], materials },
    endpoint,
  );
}

describe('runtime catalog guard', () => {
  it('aceita namespace oficial mesmo quando o caminho proprietário contém maiúsculas', () => {
    expect(validateRuntimeCatalog(catalog([rawMaterial()]), endpoint).materials).toHaveLength(1);
  });

  it('bloqueia IDs públicos duplicados para evitar resolução ambígua', () => {
    const parsed = catalog([rawMaterial(), rawMaterial()]);
    expect(() => validateRuntimeCatalog(parsed, endpoint)).toThrow('IDs públicos duplicados');
  });

  it('bloqueia PBR acima do budget de bytes', () => {
    const oversized = rawMaterial();
    oversized.asset_integrity.normal.bytes = 3_000_000;
    const parsed = catalog([oversized]);
    expect(() => validateRuntimeCatalog(parsed, endpoint)).toThrow('budget de bytes');
  });

  it('bloqueia mapas PBR com dimensões divergentes', () => {
    const mismatched = rawMaterial();
    mismatched.asset_integrity.ao.width_px = 1024;
    const parsed = catalog([mismatched]);
    expect(() => validateRuntimeCatalog(parsed, endpoint)).toThrow('dimensões divergentes');
  });
});
