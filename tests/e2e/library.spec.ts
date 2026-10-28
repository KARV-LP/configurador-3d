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
  await expect(page.getByRole('button', { name: /Croma Musgo Pet Friendly/u })).toContainText(
    'Disponível em 3D',
  );
  await expect(page.getByRole('button', { name: /Veludo Milano Bege/u })).toContainText(
    'Acabamento 3D em preparação',
  );

  await page.getByLabel('Cor', { exact: true }).selectOption('verde');
  await page.getByLabel('Tipo de Revestimento', { exact: true }).selectOption('sarjado peletizado');
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');

  await page.getByRole('tab', { name: 'KARV Design' }).click();
  await expect(library).toContainText('KARV Design em preparação');
  await expect(page.locator('body')).not.toContainText('PBR RUNTIME');
  await expect(page.locator('body')).not.toContainText('Geometria v2');
});

test('falha da Biblioteca preserva o 3D e permite tentar novamente', async ({ page }) => {
  let requestCount = 0;
  let catalogAvailable = false;
  await page.route(`**${LIBRARY_CATALOG_PATH}`, async (route) => {
    requestCount += 1;
    if (!catalogAvailable) {
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

  const loading = page.getByTestId('initial-loading');
  await expect(page.locator('main')).toHaveAttribute('data-configurator-ready', 'true', {
    timeout: 45_000,
  });
  await expect(loading).toHaveCount(0);
  expect(requestCount).toBe(0);

  await page.getByRole('button', { name: 'Revestir' }).click();
  const library = page.getByTestId('material-library');
  await expect(library).toContainText('Revestimentos indisponíveis agora');
  catalogAvailable = true;
  await library.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(library).toContainText('Croma Musgo Pet Friendly');
});
