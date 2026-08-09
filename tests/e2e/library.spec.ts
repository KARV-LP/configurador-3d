import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture, LIBRARY_CATALOG_PATH } from './material-library-fixture';

test('navega por Cor → Material → Tecido sem linguagem técnica', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Materiais' }).click();
  const library = page.getByTestId('material-library');
  await expect(library).toBeVisible();
  await expect(library).toContainText('Tecidos');

  await page.getByLabel('Cor', { exact: true }).selectOption('verde');
  await page.getByLabel('Material', { exact: true }).selectOption('sarjado peletizado');
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');

  await page.getByRole('tab', { name: 'KARV Design' }).click();
  await expect(library).toContainText('KARV Design em preparação');
  await expect(page.locator('body')).not.toContainText('PBR RUNTIME');
  await expect(page.locator('body')).not.toContainText('Geometria v2');
});

test('falha da Biblioteca preserva a experiência 3D e mostra estado específico', async ({ page }) => {
  await page.route(`**${LIBRARY_CATALOG_PATH}`, async (route) => route.abort('failed'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Materiais' }).click();
  await expect(page.getByTestId('material-library')).toContainText('Materiais indisponíveis agora');
  await expect(page.getByTestId('selection-status')).toBeVisible();
});
