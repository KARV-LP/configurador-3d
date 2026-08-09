import { expect, test } from '@playwright/test';

test('carrega o runtime derivado do GLB canônico usando somente assets locais', async ({
  page,
}) => {
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
  expect(requestedPaths).toContain('/assets/runtime/karv-chair/v2/base.glb');
  expect(requestedPaths).toContain('/vendor/draco/draco_wasm_wrapper.js');
  expect(requestedPaths).toContain('/vendor/draco/draco_decoder.wasm');
  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('seleciona por mouse e opera aplicação/reset pelo Core F2', async ({ page }) => {
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
        const material = api.materialFromPoint(x, y);
        if (material?.name && material.name !== 'pezinhos') return { x, y };
      }
    }
    return null;
  });

  expect(hit).not.toBeNull();
  if (!hit) return;

  await page.mouse.click(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('Selecionado:');

  await page.getByRole('button', { name: 'Aplicar areia na peça' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10');

  await page.getByRole('button', { name: 'Aplicar areia em todas' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('10/10');

  await page.getByRole('button', { name: 'Reset geral' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('0/10');
});
