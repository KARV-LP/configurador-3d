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
  await expect(panel).toContainText('selecionado. Escolha o acabamento.');

  const panelBox = await panel.boundingBox();
  const viewerBox = await page.getByTestId('karv-viewer').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(viewerBox).not.toBeNull();
  expect(panelBox?.width ?? 0).toBeLessThan((viewerBox?.width ?? 0) * 0.3);
  expect(panelBox?.height ?? 0).toBeGreaterThan((viewerBox?.height ?? 0) * 0.5);
  expect(panelBox?.x ?? 0).toBeGreaterThan((viewerBox?.width ?? 0) * 0.65);
  await expect(page.locator('.panel-scrim')).toHaveCount(0);
});

test('controles contextuais preservam o ambiente limpo e o orbit ancorado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  const viewer = page.getByTestId('karv-viewer');
  await expect(viewer).toHaveAttribute('disable-pan', '');
  await expect(viewer).toHaveAttribute('orbit-sensitivity', '0.65');
  await expect(viewer).not.toHaveAttribute('disable-zoom', '');
  await expect(viewer).toHaveAttribute('camera-orbit', '0deg 72deg 3.4m');
  await expect(viewer).toHaveAttribute('min-camera-orbit', '-180deg 55deg 3.2m');
  await expect(viewer).toHaveAttribute('max-camera-orbit', '180deg 88deg 4.2m');
  await expect(viewer).toHaveAttribute('camera-target', '0.266837072m 0.336909632m 0m');

  await expect(page.getByTestId('surface-nav')).toHaveCount(0);
  await page.getByRole('button', { name: 'Revestir' }).click();
  const surfaceControl = page.getByLabel('Área da poltrona');
  await expect(surfaceControl.locator('option')).toHaveCount(11);
  await surfaceControl.selectOption({ label: 'Assento' });
  await expect(page.getByTestId('selection-status')).toContainText('Assento selecionado');
  await expect(page.getByTestId('material-library')).toBeVisible();
});

test('painel vertical pode ser movido sem bloquear o viewer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  await page.getByRole('button', { name: 'Revestir' }).click();
  const panel = page.getByTestId('material-library');
  const mover = page.getByRole('button', { name: 'Mover painel de tecidos' });
  const before = await panel.boundingBox();
  const handle = await mover.boundingBox();
  expect(before).not.toBeNull();
  expect(handle).not.toBeNull();

  if (handle) {
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x - 180, handle.y + 60, { steps: 8 });
    await page.mouse.up();
  }

  const after = await panel.boundingBox();
  expect(after).not.toBeNull();
  expect(after?.x ?? 0).toBeLessThan((before?.x ?? 0) - 100);
  await expect(page.getByTestId('karv-viewer')).toBeVisible();
});

test('aplica o tecido na área escolhida pelo painel vertical', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });

  await page.getByRole('button', { name: 'Revestir' }).click();
  await page.getByLabel('Área da poltrona').selectOption({ label: 'Assento' });
  const publicSurface = 'Assento';

  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  const applyButton = page.getByRole('button', { name: 'Aplicar nesta área' });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
  await expect(page.getByTestId('pbr-status')).toContainText('Material aplicado.');
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  const summary = page.getByRole('dialog', { name: 'Resumo da configuração' });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(publicSurface);
  await expect(summary).toContainText('Croma Musgo Pet Friendly');
  await expect(summary).not.toContainText('fabric-kv-002');
  await expect(summary).not.toContainText('encosto-frt');
});
