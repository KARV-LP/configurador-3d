import { expect, test } from '@playwright/test';
import {
  installMaterialLibraryFixture,
  LIBRARY_CATALOG_PATH,
  PUBLIC_CATALOG_FIXTURE,
} from './material-library-fixture';

test('navega por Cor → Material → Tecido sem linguagem técnica', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Revestir' }).click();
  const library = page.getByTestId('material-library');
  await expect(library).toBeVisible();
  await expect(library).toContainText('Tecidos');

  await page.getByLabel('Cor', { exact: true }).selectOption('verde');
  await page.getByLabel('Material', { exact: true }).selectOption('sarjado peletizado');
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');
  await expect(page.getByRole('button', { name: /Croma Musgo Pet Friendly/u })).toContainText(
    'Disponível em 3D',
  );
  await expect(page.getByRole('button', { name: /Veludo Milano Bege/u })).toContainText(
    'Acabamento 3D em preparação',
  );

  await page.getByRole('tab', { name: 'KARV Design' }).click();
  await expect(library).toContainText('KARV Design em preparação');
  await expect(page.locator('body')).not.toContainText('PBR RUNTIME');
  await expect(page.locator('body')).not.toContainText('Geometria v2');
});

test('falha da Biblioteca preserva o 3D e permite tentar novamente', async ({ page }) => {
  let requestCount = 0;
  await page.route(`**${LIBRARY_CATALOG_PATH}`, async (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(PUBLIC_CATALOG_FIXTURE),
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Revestir' }).click();
  await expect(page.getByTestId('material-library')).toContainText('Materiais indisponíveis agora');
  await expect(page.getByTestId('selection-status')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByTestId('material-library')).toContainText('Croma Musgo Pet Friendly');
});
