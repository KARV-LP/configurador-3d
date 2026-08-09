import { expect, test } from '@playwright/test';

test('carrega o GLB canônico usando somente assets locais', async ({ page }) => {
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
  await expect(status).toHaveText('Modelo 3D carregado');

  const viewerLoaded = await page.locator('model-viewer').evaluate((element) => {
    return Boolean((element as HTMLElement & { loaded?: boolean }).loaded);
  });

  expect(viewerLoaded).toBe(true);
  expect(requestedPaths).toContain('/assets/geometry/karv-chair/v2/base.manifest.json');
  expect(requestedPaths).toContain('/assets/geometry/karv-chair/v2/base.glb');
  expect(requestedPaths).toContain('/vendor/draco/draco_wasm_wrapper.js');
  expect(requestedPaths).toContain('/vendor/draco/draco_decoder.wasm');
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
