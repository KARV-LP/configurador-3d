import type { Page } from '@playwright/test';

export const LIBRARY_ORIGIN = 'https://raw.githubusercontent.com';
export const LIBRARY_CATALOG_PATH = '/KARV-LP/karv-material-library/main/public/v1/catalog.json';
export const LIBRARY_CATALOG_URL = `${LIBRARY_ORIGIN}${LIBRARY_CATALOG_PATH}`;
const LIBRARY_ASSET_PREFIX = '/KARV-LP/karv-material-library/main/public/v1/assets/';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

const material = (
  id: string,
  name: string,
  collection: string,
  colorName: string,
  colorFamily: string,
  materialType: string,
) => ({
  id,
  channel: 'fabric',
  name,
  collection,
  color: { name: colorName, family: colorFamily },
  material_type: materialType,
  technologies: [],
  functional: {
    pet_friendly: false,
    water_repellency: false,
    easy_clean: false,
    indoor_use: true,
    outdoor_use: false,
  },
  appearance: {
    texture: 'textura de teste',
    touch: 'macio',
    sheen: 'baixo',
    visual_character: ['teste'],
  },
  physical_reference_cm: { width: 120, height: 60 },
  assets: {
    preview: `./assets/${id}/preview.webp`,
    base_color: `./assets/${id}/base-color.webp`,
    normal: null,
    ao: null,
  },
  published: true,
  ready_for_configurator: true,
  pbr_ready: false,
  compatibility: { geometry_ids: ['karv-chair'], min_geometry_version: 2 },
});

const productionMaterial = (
  id: string,
  name: string,
  collection: string,
  colorName: string,
  colorFamily: string,
  materialType: string,
  roughnessFactor: number,
) => ({
  ...material(id, name, collection, colorName, colorFamily, materialType),
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
    roughness_factor: roughnessFactor,
    metalness: 0,
    normal_convention: 'opengl',
    normal_strength: 1,
    ao_strength: 1,
  },
  pbr_ready: true,
});

const croma = productionMaterial(
  'fabric-kv-002',
  'Croma Musgo Pet Friendly',
  'All Colours',
  'Musgo',
  'verde',
  'sarjado peletizado',
  0.88,
);

const grafite = productionMaterial(
  'fabric-kv-004',
  'Milano Grafite 3D',
  'Milano',
  'Grafite',
  'cinza',
  'veludo liso',
  0.72,
);

export const PUBLIC_CATALOG_FIXTURE = {
  schema: 'karv.public-material-catalog/1',
  channels: ['fabric', 'karv_design'],
  materials: [
    material('fabric-kv-001', 'Toledo Escama Preto', 'Toledo', 'Escama Preto', 'preto', 'rústico'),
    croma,
    material('fabric-kv-003', 'Veludo Milano Bege', 'Milano', 'Bege', 'bege', 'veludo liso'),
    grafite,
  ],
};

const transparentWebp = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64',
);

export async function installMaterialLibraryFixture(page: Page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());

    if (url.origin === LIBRARY_ORIGIN && url.pathname === LIBRARY_CATALOG_PATH) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(PUBLIC_CATALOG_FIXTURE),
      });
      return;
    }

    if (url.origin === LIBRARY_ORIGIN && url.pathname.startsWith(LIBRARY_ASSET_PREFIX)) {
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        headers: { 'access-control-allow-origin': '*' },
        body: transparentWebp,
      });
      return;
    }

    await route.continue();
  });
}
