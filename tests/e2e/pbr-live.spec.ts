import { expect, test } from '@playwright/test';

test.skip(process.env.KARV_LIVE_LIBRARY !== '1', 'Gate live da Biblioteca KARV desabilitado.');

test('aplica material oficial usando catálogo e assets reais publicados em main', async ({
  page,
}) => {
  const catalogUrl =
    'https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/catalog.json';
  const assetPrefix =
    'https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/assets/fabric-kv-002/';
  const responses = new Map<string, number>();
  const consoleErrors: string[] = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url === catalogUrl || url.startsWith(assetPrefix)) responses.set(url, response.status());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

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
  if (!hit) return;

  await page.mouse.click(hit.x, hit.y);
  await expect(page.getByTestId('selection-status')).toContainText('selecionado');

  const materialButton = page.getByRole('button', { name: /Croma Musgo Pet Friendly/u });
  await expect(materialButton).toBeVisible({ timeout: 20_000 });
  await materialButton.click();
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 30_000 });
  await expect(page.getByTestId('pbr-status')).toContainText('Material aplicado');

  const state = await viewer.evaluate((element, materialName) => {
    interface Scale {
      readonly u: number;
      readonly v: number;
    }
    interface MaterialApi {
      readonly pbrMetallicRoughness: {
        readonly baseColorTexture: {
          readonly texture: { readonly sampler: { readonly scale: Scale | null } } | null;
        } | null;
        readonly roughnessFactor: number;
        readonly metallicFactor: number;
      };
      readonly normalTexture: { readonly texture: unknown } | null;
      readonly occlusionTexture: { readonly texture: unknown } | null;
    }
    const api = element as HTMLElement & {
      model?: { getMaterialByName(name: string): MaterialApi | null };
    };
    const material = api.model?.getMaterialByName(materialName) ?? null;
    return material
      ? {
          baseColor: Boolean(material.pbrMetallicRoughness.baseColorTexture?.texture),
          normal: Boolean(material.normalTexture?.texture),
          ao: Boolean(material.occlusionTexture?.texture),
          roughness: material.pbrMetallicRoughness.roughnessFactor,
          metalness: material.pbrMetallicRoughness.metallicFactor,
          scale: material.pbrMetallicRoughness.baseColorTexture?.texture?.sampler.scale ?? null,
        }
      : null;
  }, hit.name);

  expect(state?.baseColor).toBe(true);
  expect(state?.normal).toBe(true);
  expect(state?.ao).toBe(true);
  expect(state?.roughness).toBeCloseTo(0.88, 5);
  expect(state?.metalness).toBe(0);
  expect(state?.scale).not.toBeNull();
  expect(Math.abs(state?.scale?.u ?? 1)).not.toBeCloseTo(1, 5);

  expect(responses.get(catalogUrl)).toBe(200);
  expect(responses.get(`${assetPrefix}base-color.webp`)).toBe(200);
  expect(responses.get(`${assetPrefix}normal.webp`)).toBe(200);
  expect(responses.get(`${assetPrefix}ao.webp`)).toBe(200);
  expect(consoleErrors).toEqual([]);

  await page.getByRole('button', { name: 'Resumo', exact: true }).first().click();
  await page.getByRole('button', { name: 'Restaurar poltrona' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('0/10');
});
