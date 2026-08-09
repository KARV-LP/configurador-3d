import type { Page } from '@playwright/test';

export const LIBRARY_ORIGIN = 'https://raw.githubusercontent.com';
export const LIBRARY_CATALOG_PATH = '/KARV-LP/karv-material-library/main/public/v1/catalog.json';

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

export const PUBLIC_CATALOG_FIXTURE = {
  schema: 'karv.public-material-catalog/1',
  channels: ['fabric', 'karv_design'],
  materials: [
    material('fabric-kv-001', 'Toledo Escama Preto', 'Toledo', 'Escama Preto', 'preto', 'rústico'),
    material('fabric-kv-002', 'Croma Musgo Pet Friendly', 'All Colours', 'Musgo', 'verde', 'sarjado peletizado'),
    material('fabric-kv-003', 'Veludo Milano Bege', 'Milano', 'Bege', 'bege', 'veludo liso'),
  ],
};

const transparentWebp = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64',
);

export async function installMaterialLibraryFixture(page: Page) {
  await page.route(`**${LIBRARY_CATALOG_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_CATALOG_FIXTURE),
    });
  });
  await page.route('**/KARV-LP/karv-material-library/main/public/v1/assets/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/webp', body: transparentWebp });
  });
}
