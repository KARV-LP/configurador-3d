import { expect, test } from '@playwright/test';
import {
  installMaterialLibraryFixture,
  LIBRARY_CATALOG_PATH,
  LIBRARY_ORIGIN,
} from './material-library-fixture';

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('carrega o runtime 3D local e usa somente o namespace externo aprovado', async ({ page }) => {
  const externalRequests: string[] = [];
  const requestedPaths: string[] = [];
  const consoleErrors: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      requestedPaths.push(url.pathname);
      if (url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBe(true);

  const status = page.getByTestId('viewer-status');
  await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 45_000 });
  await expect(page.getByRole('button', { name: 'Revestir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver no ambiente' })).toBeVisible();

  const viewerLoaded = await page.locator('model-viewer').evaluate((element) => {
    return Boolean((element as HTMLElement & { loaded?: boolean }).loaded);
  });

  expect(viewerLoaded).toBe(true);
  expect(requestedPaths).toContain('/assets/geometry/karv-chair/v2/base.manifest.json');
  expect(requestedPaths).toContain('/assets/runtime/karv-chair/v2/base.glb');
  expect(requestedPaths).toContain('/vendor/draco/draco_wasm_wrapper.js');
  expect(requestedPaths).toContain('/vendor/draco/draco_decoder.wasm');
  expect(requestedPaths).toContain(LIBRARY_CATALOG_PATH);

  for (const requestUrl of externalRequests) {
    const url = new URL(requestUrl);
    expect(url.origin).toBe(LIBRARY_ORIGIN);
    expect(url.pathname.startsWith('/KARV-LP/karv-material-library/main/public/v1/')).toBe(true);
  }
  expect(consoleErrors).toEqual([]);
});

test('seleciona por mouse, abre contexto e restaura a área pela UI oficial', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

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
        if (document.elementFromPoint(x, y) !== element) continue;
        const material = api.materialFromPoint(x, y);
        if (material?.name && material.name !== 'pezinhos') return { x, y };
      }
    }
    return null;
  });

  expect(hit).not.toBeNull();
  if (!hit) return;

  await page.mouse.click(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('selecionado');
  await expect(page.getByTestId('material-library')).toBeVisible();

  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Restaurar esta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('0/10');
});
