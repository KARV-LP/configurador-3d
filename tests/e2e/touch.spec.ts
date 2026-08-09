import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('seleciona superfície por touch e abre bottom sheet contextual', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  const viewer = page.getByTestId('karv-viewer');
  const hit = await viewer.evaluate((element) => {
    const api = element as HTMLElement & {
      materialFromPoint(x: number, y: number): { name?: string } | null;
    };
    const rect = element.getBoundingClientRect();
    for (let row = 1; row <= 9; row += 1) {
      for (let column = 1; column <= 9; column += 1) {
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
  if (!hit) return;

  await page.touchscreen.tap(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('selecionado');

  const sheet = page.getByTestId('material-library');
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeCloseTo(390, 0);
  expect(box?.y ?? 0).toBeGreaterThan(160);
  await expect(page.getByRole('button', { name: 'Fechar materiais' })).toBeVisible();
});
