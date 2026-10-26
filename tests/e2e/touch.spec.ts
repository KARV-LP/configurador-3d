import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('painel mobile preserva área do 3D para selecionar superfícies por touch', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  const selectionStatusBox = await page.getByTestId('selection-status').boundingBox();
  expect(selectionStatusBox).not.toBeNull();
  expect(selectionStatusBox?.height ?? 844).toBeLessThan(50);

  const viewer = page.getByTestId('karv-viewer');
  await page.getByRole('button', { name: 'Revestir' }).click();
  const panel = page.getByTestId('material-library');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThan(360);
  expect(box?.width ?? 0).toBeLessThan(390);
  expect(box?.x ?? 0).toBeGreaterThan(0);
  expect(box?.y ?? 0).toBeGreaterThan(350);
  expect(box?.height ?? 844).toBeLessThan(430);
  await expect(page.locator('.panel-scrim')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mover painel de tecidos' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Fechar materiais' })).toBeVisible();
  const firstMaterial = page.getByRole('button', { name: /Toledo Escama Preto/u });
  await expect(firstMaterial).toBeVisible();
  const materialBox = await firstMaterial.boundingBox();
  const actionsBox = await page.locator('.material-actions').boundingBox();
  expect(materialBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(
    Math.min((materialBox?.y ?? 0) + (materialBox?.height ?? 0), actionsBox?.y ?? 0) -
      (materialBox?.y ?? 0),
  ).toBeGreaterThan(40);

  const exposedBottom = box?.y ?? 380;
  const hit = await viewer.evaluate((element, maximumY) => {
    const api = element as HTMLElement & {
      materialFromPoint(x: number, y: number): { name?: string } | null;
    };
    const rect = element.getBoundingClientRect();
    for (let row = 1; row <= 9; row += 1) {
      for (let column = 1; column <= 9; column += 1) {
        const x = rect.left + (rect.width * column) / 10;
        const y = rect.top + ((maximumY - rect.top) * row) / 10;
        if (document.elementFromPoint(x, y) !== element) continue;
        const material = api.materialFromPoint(x, y);
        if (material?.name && material.name !== 'pezinhos') return { x, y };
      }
    }
    return null;
  }, exposedBottom - 8);

  expect(hit).not.toBeNull();
  if (!hit) return;

  await page.touchscreen.tap(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('selecionado');
  await expect(panel).toBeVisible();
});
