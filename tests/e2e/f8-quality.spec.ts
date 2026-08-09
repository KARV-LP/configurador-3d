import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const budgets = JSON.parse(readFileSync(resolve(root, 'budgets.json'), 'utf8')) as {
  runtime: {
    modelInteractiveMs: number;
    criticalRequestsBeforeInteractive: number;
    previewRequestsBeforeLibraryOpen: number;
  };
};

async function selectConfigurableSurface(page: import('@playwright/test').Page) {
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
        if (material?.name && material.name !== 'pezinhos') return { x, y, name: material.name };
      }
    }
    return null;
  });
  expect(hit).not.toBeNull();
  if (!hit) throw new Error('Superfície configurável não encontrada.');
  await page.mouse.click(hit.x, hit.y);
  return hit;
}

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
});

test('mantém o carregamento inicial dentro dos budgets e não antecipa previews', async ({
  page,
}) => {
  let interactive = false;
  const requestsBeforeInteractive: string[] = [];
  const previewsBeforeLibraryOpen: string[] = [];

  page.on('request', (request) => {
    if (interactive) return;
    requestsBeforeInteractive.push(request.url());
    if (new URL(request.url()).pathname.endsWith('/preview.webp')) {
      previewsBeforeLibraryOpen.push(request.url());
    }
  });

  const startedAt = Date.now();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: budgets.runtime.modelInteractiveMs,
  });
  const interactiveMs = Date.now() - startedAt;
  interactive = true;

  expect(interactiveMs).toBeLessThanOrEqual(budgets.runtime.modelInteractiveMs);
  expect(requestsBeforeInteractive.length).toBeLessThanOrEqual(
    budgets.runtime.criticalRequestsBeforeInteractive,
  );
  expect(previewsBeforeLibraryOpen).toHaveLength(budgets.runtime.previewRequestsBeforeLibraryOpen);
});

test('troca material PBR na mesma superfície sem acumular assignment anterior', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: budgets.runtime.modelInteractiveMs,
  });

  const hit = await selectConfigurableSurface(page);
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Croma Musgo Pet Friendly');
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  await page.getByRole('button', { name: /Milano Grafite 3D/u }).click();
  await expect(page.getByTestId('selected-material')).toContainText('Milano Grafite 3D');
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });

  const roughness = await page.getByTestId('karv-viewer').evaluate((element, materialName) => {
    const api = element as HTMLElement & {
      model?: {
        getMaterialByName(name: string): {
          pbrMetallicRoughness: { roughnessFactor: number };
        } | null;
      };
    };
    return api.model?.getMaterialByName(materialName)?.pbrMetallicRoughness.roughnessFactor ?? null;
  }, hit.name);
  expect(roughness).toBeCloseTo(0.72, 5);

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  const summary = page.getByRole('dialog', { name: 'Resumo da configuração' });
  await expect(summary).toContainText('Milano Grafite 3D');
  await expect(summary).not.toContainText('Croma Musgo Pet Friendly');
  expect(consoleErrors).toEqual([]);
});
