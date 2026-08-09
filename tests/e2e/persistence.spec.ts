import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

const APP_URL = 'http://127.0.0.1:4173/';

async function waitUntilReady(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
}

async function configureAll(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Materiais' }).click();
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  const applyAll = page.getByRole('button', { name: 'Aplicar em toda a poltrona' });
  await expect(applyAll).toBeEnabled({ timeout: 20_000 });
  await applyAll.click();
  await expect(page.getByTestId('assigned-count')).toContainText('10/10', { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('link compartilhável restaura em nova sessão e passa a persistir localmente', async ({
  page,
}) => {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await configureAll(page);

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Compartilhar configuração' }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('config')).not.toBeNull();
  const sharedUrl = page.url();
  const token = new URL(sharedUrl).searchParams.get('config');
  expect(token).toMatch(/^[A-Za-z0-9_-]+$/u);

  await page.evaluate(() => localStorage.clear());
  await page.goto(sharedUrl, { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await expect(page.getByTestId('assigned-count')).toContainText('10/10', { timeout: 30_000 });
  await expect(page.getByText('Configuração recuperada')).toBeVisible();

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await expect(page.getByTestId('assigned-count')).toContainText('10/10', { timeout: 30_000 });
});

test('link explícito corrompido abre baseline e não reutiliza configuração local antiga', async ({
  page,
}) => {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await configureAll(page);

  await page.goto(`${APP_URL}?config=%25%25%25`, { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await expect(page.getByTestId('assigned-count')).toContainText('0/10', { timeout: 30_000 });
  await expect(page.getByText('Configuração não recuperada')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has('config')).toBe(false);
});
