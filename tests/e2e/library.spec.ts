import { expect, test } from '@playwright/test';
import {
  installMaterialLibraryFixture,
  LIBRARY_CATALOG_PATH,
} from './material-library-fixture';

test('descobre e seleciona material oficial por Cor → Material → Tecido', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const library = page.getByTestId('material-library');
  await expect(library).toContainText('catálogo oficial');

  await page.getByLabel('Cor').selectOption('verde');
  await page.getByLabel('Material').selectOption('sarjado peletizado');
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');

  await page.getByRole('tab', { name: 'KARV Design' }).click();
  await expect(library).toContainText('Nenhuma criação KARV Design publicada');
});

test('falha da Biblioteca não derruba o Core 3D', async ({ page }) => {
  await page.route(`**${LIBRARY_CATALOG_PATH}`, async (route) => route.abort('failed'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
  await expect(page.getByTestId('material-library')).toContainText('Biblioteca indisponível');
  await expect(page.getByTestId('selection-status')).toBeVisible();
});
