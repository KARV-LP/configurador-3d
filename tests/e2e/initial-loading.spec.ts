import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test('loading acompanha estados reais e só libera a interface pronta', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  let releaseModel!: () => void;
  const modelGate = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  await page.route('**/assets/runtime/karv-chair/v2/base.glb', async (route) => {
    await modelGate;
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const loading = page.getByTestId('initial-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toContainText('Preparando sua Poltrona KARV');
  await expect(loading).toHaveAttribute('data-stage', 'Carregando modelo 3D');
  const initialProgress = Number(await loading.getAttribute('data-progress'));
  expect(initialProgress).toBeGreaterThan(0);
  expect(initialProgress).toBeLessThan(100);
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');

  releaseModel();

  await expect(loading).toHaveAttribute('data-progress', '100', { timeout: 45_000 });
  await expect(loading).toHaveAttribute('data-stage', 'Pronto');
  expect(Number(await loading.getAttribute('data-progress'))).toBeGreaterThan(initialProgress);
  await expect(loading).toHaveCount(0, { timeout: 5_000 });

  await expect(page.locator('main')).toHaveAttribute('data-configurator-ready', 'true');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('button', { name: 'Revestir' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('erro de inicialização interrompe o loading e oferece nova tentativa', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.route('**/assets/geometry/karv-chair/v2/base.manifest.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  );

  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const loading = page.getByTestId('initial-loading');
  await expect(loading).toHaveClass(/initial-loader--error/, { timeout: 45_000 });
  await expect(loading).toContainText('Não foi possível preparar o configurador');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
  await expect(loading).not.toHaveAttribute('data-progress', '100');
  expect(errors).toEqual([]);
});
