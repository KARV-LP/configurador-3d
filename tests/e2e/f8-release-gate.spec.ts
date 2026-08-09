import { expect, test, type Page } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

async function selectVisibleSurface(page: Page) {
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
        if (document.elementFromPoint(x, y) !== element) continue;
        const material = api.materialFromPoint(x, y);
        if (material?.name && material.name !== 'pezinhos') return { x, y };
      }
    }
    return null;
  });
  expect(hit).not.toBeNull();
  if (hit) await page.mouse.click(hit.x, hit.y);
}

test('release gate percorre jornada crítica sem erro e dentro do budget interativo', async ({
  page,
}) => {
  await installMaterialLibraryFixture(page);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let requestsBeforeReady = 0;
  let viewerReady = false;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', () => {
    if (!viewerReady) requestsBeforeReady += 1;
  });

  const startedAt = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
  viewerReady = true;
  const interactiveMs = Date.now() - startedAt;

  expect(interactiveMs).toBeLessThanOrEqual(20_000);
  expect(requestsBeforeReady).toBeLessThanOrEqual(20);

  await selectVisibleSurface(page);
  await expect(page.getByTestId('material-library')).toBeVisible();

  await page.getByRole('button', { name: /Toledo Escama Preto/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Toledo Escama Preto');
  await expect(page.getByTestId('pbr-status')).toContainText(
    'acabamento 3D ainda está em preparação',
  );

  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Aplicar em toda a poltrona' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('10/10', { timeout: 30_000 });

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Restaurar poltrona' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('0/10');

  await page.getByRole('button', { name: 'Ver no ambiente' }).click();
  await expect(page.getByTestId('ar-handoff')).toBeVisible();
  await expect(page.getByAltText('QR Code da configuração atual')).toBeVisible({ timeout: 20_000 });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
