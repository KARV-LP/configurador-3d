import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('revestimentos usa uma página mobile opaca e retorna ao 3D', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  const selectionStatusBox = await page.getByTestId('selection-status').boundingBox();
  expect(selectionStatusBox).not.toBeNull();
  expect(selectionStatusBox?.height ?? 844).toBeLessThan(50);

  await page.getByRole('button', { name: 'Revestir' }).click();
  const panel = page.getByTestId('material-library');
  await expect(panel).toBeVisible();
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(390);
  expect(box?.height).toBe(844);
  await expect(panel).toHaveCSS('background-color', 'rgb(249, 247, 241)');
  await expect(page.locator('.panel-scrim')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mover painel de tecidos' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Fechar materiais' })).toBeHidden();
  const backTo3D = page.getByRole('button', { name: 'Voltar ao 3D' });
  await expect(backTo3D).toBeVisible();
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
  await expect
    .poll(() => panel.evaluate((element) => element.contains(document.elementFromPoint(195, 422))))
    .toBe(true);

  await backTo3D.click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('karv-viewer')).toBeVisible();
});
