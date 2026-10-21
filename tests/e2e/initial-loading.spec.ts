import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test('loading acompanha estados reais e só libera a interface pronta', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  const errors: string[] = [];
  const catalogRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/karv-material-library/')) catalogRequests.push(request.url());
  });
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

  await page.evaluate(() => {
    type LoadingStage = { progress: string | null; stage: string | null };
    const stages: LoadingStage[] = [];
    const capture = () => {
      const loader = document.querySelector<HTMLElement>('[data-testid="initial-loading"]');
      if (loader) {
        stages.push({
          progress: loader.dataset.progress ?? null,
          stage: loader.dataset.stage ?? null,
        });
      }
    };
    capture();
    const observer = new MutationObserver(capture);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-progress', 'data-stage'],
    });
    Object.assign(window, { __karvLoadingStages: stages });
  });

  releaseModel();

  const main = page.locator('main');
  await expect(main).toHaveAttribute('data-configurator-ready', 'true', { timeout: 45_000 });
  await expect(loading).toHaveCount(0, { timeout: 5_000 });

  const stages = await page.evaluate(
    () =>
      (
        window as Window & {
          __karvLoadingStages: Array<{ progress: string | null; stage: string | null }>;
        }
      ).__karvLoadingStages,
  );
  expect(stages.some(({ progress }) => Number(progress) > initialProgress)).toBe(true);
  expect(stages.some(({ progress }) => progress === '100')).toBe(true);
  expect(stages.some(({ stage }) => stage === 'Pronto')).toBe(true);

  await expect(main).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('body')).not.toHaveAttribute('data-f11-proposal');
  const baselineHasImageTextures = await page.getByTestId('karv-viewer').evaluate((element) => {
    const viewer = element as HTMLElement & {
      model?: {
        getMaterialByName(name: string): {
          pbrMetallicRoughness: { baseColorTexture: { texture: unknown } | null };
        } | null;
      };
    };
    const configurableMaterials = [
      'assento',
      'encosto-frt',
      'encosto lat',
      'encosto traseiro',
      'lat ext ',
      'lat int',
      'lat rr',
      'Material.012',
      'VIVO',
    ];
    return configurableMaterials.some((name) =>
      Boolean(
        viewer.model?.getMaterialByName(name)?.pbrMetallicRoughness.baseColorTexture?.texture,
      ),
    );
  });
  expect(baselineHasImageTextures).toBe(false);
  const revestir = page.getByRole('button', { name: 'Revestir' });
  await expect(revestir).toBeVisible();
  expect(catalogRequests).toEqual([]);

  await revestir.click();
  await expect.poll(() => catalogRequests.length).toBeGreaterThan(0);
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
