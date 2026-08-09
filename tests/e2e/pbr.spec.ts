import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test('aplica Base Color, Normal, AO e roughness no material selecionado', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  const pbrAssetRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/public/v1/assets/fabric-kv-002/')) {
      if (/\/(base-color|normal|ao)\.webp$/u.test(url.pathname))
        pbrAssetRequests.push(url.pathname);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('pbr-status')).toContainText('PBR de produção disponível');

  const viewer = page.getByTestId('karv-viewer');
  const hit = await viewer.evaluate((element) => {
    const api = element as HTMLElement & {
      materialFromPoint(x: number, y: number): { name?: string } | null;
    };
    const rect = element.getBoundingClientRect();
    for (let row = 2; row <= 8; row += 1) {
      for (let column = 2; column <= 8; column += 1) {
        const x = rect.left + (rect.width * column) / 10;
        const y = rect.top + (rect.height * row) / 10;
        const material = api.materialFromPoint(x, y);
        if (material?.name && material.name !== 'pezinhos') return { x, y, name: material.name };
      }
    }
    return null;
  });

  expect(hit).not.toBeNull();
  if (!hit) return;
  await page.mouse.click(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('Selecionado:');

  await page.getByRole('button', { name: 'Aplicar PBR na peça' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });
  await expect(page.getByTestId('pbr-status')).not.toContainText('Não foi possível');

  const state = await viewer.evaluate((element, materialName) => {
    const api = element as HTMLElement & {
      model?: {
        getMaterialByName(name: string): {
          pbrMetallicRoughness: {
            baseColorTexture: { texture: unknown } | null;
            roughnessFactor: number;
            metallicFactor: number;
          };
          normalTexture: { texture: unknown } | null;
          occlusionTexture: { texture: unknown } | null;
        } | null;
      };
    };
    const material = api.model?.getMaterialByName(materialName) ?? null;
    return material
      ? {
          baseColor: Boolean(material.pbrMetallicRoughness.baseColorTexture?.texture),
          normal: Boolean(material.normalTexture?.texture),
          ao: Boolean(material.occlusionTexture?.texture),
          roughness: material.pbrMetallicRoughness.roughnessFactor,
          metalness: material.pbrMetallicRoughness.metallicFactor,
        }
      : null;
  }, hit.name);

  expect(state).toEqual({ baseColor: true, normal: true, ao: true, roughness: 0.88, metalness: 0 });
  expect(pbrAssetRequests.filter((path) => path.endsWith('/base-color.webp'))).toHaveLength(1);
  expect(pbrAssetRequests.filter((path) => path.endsWith('/normal.webp'))).toHaveLength(1);
  expect(pbrAssetRequests.filter((path) => path.endsWith('/ao.webp'))).toHaveLength(1);

  await page.getByRole('button', { name: 'Aplicar PBR na peça' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10');
  expect(pbrAssetRequests.filter((path) => path.endsWith('/base-color.webp'))).toHaveLength(1);
  expect(pbrAssetRequests.filter((path) => path.endsWith('/normal.webp'))).toHaveLength(1);
  expect(pbrAssetRequests.filter((path) => path.endsWith('/ao.webp'))).toHaveLength(1);

  await page.getByRole('button', { name: 'Reset geral' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('0/10');
  expect(consoleErrors).toEqual([]);
});
