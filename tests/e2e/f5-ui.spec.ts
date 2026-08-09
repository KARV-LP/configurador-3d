import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

async function selectVisibleSurface(page: import('@playwright/test').Page) {
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

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('desktop mantém a poltrona protagonista e não expõe linguagem técnica', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  await expect(page.getByText('KARV', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver no ambiente' })).toBeVisible();
  await expect(page.getByTestId('karv-viewer')).toBeVisible();

  const body = page.locator('body');
  await expect(body).not.toContainText('Core F2');
  await expect(body).not.toContainText('PBR RUNTIME F4');
  await expect(body).not.toContainText('Geometria v2');
  await expect(body).not.toContainText('ASSENTO');
  await expect(body).not.toContainText('VIVO_ENCOSTO');

  await selectVisibleSurface(page);
  const panel = page.getByTestId('material-library');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Escolha o acabamento desta área');

  const panelBox = await panel.boundingBox();
  const viewerBox = await page.getByTestId('karv-viewer').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(viewerBox).not.toBeNull();
  expect(viewerBox?.width ?? 0).toBeGreaterThan((panelBox?.width ?? 0) * 2.5);
});

test('configuração aplicada reaparece no resumo somente com nomes públicos', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  await selectVisibleSurface(page);
  const selectionText = (await page.getByTestId('selection-status').textContent()) ?? '';
  const publicSurface = selectionText.replace(/ selecionado$/u, '').trim();
  expect(publicSurface.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  const summary = page.getByRole('dialog', { name: 'Resumo da configuração' });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(publicSurface);
  await expect(summary).toContainText('Croma Musgo Pet Friendly');
  await expect(summary).not.toContainText('fabric-kv-002');
  await expect(summary).not.toContainText('encosto-frt');
});

test('ação Ver no ambiente informa indisponibilidade sem iniciar RA antes da F6', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ver no ambiente' }).click();
  await expect(
    page.getByText('A experiência em realidade aumentada será ativada na próxima etapa.'),
  ).toBeVisible();
});
