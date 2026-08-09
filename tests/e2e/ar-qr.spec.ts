import { expect, test, type Page } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

async function waitUntilReady(page: Page) {
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
  await expect(page.getByRole('button', { name: 'Ver no ambiente' })).toBeEnabled({
    timeout: 20_000,
  });
}

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

async function applyOneMaterial(page: Page) {
  await selectVisibleSurface(page);
  await page.getByRole('button', { name: /Croma Musgo Pet Friendly/u }).click();
  await page.getByRole('button', { name: 'Aplicar nesta área' }).click();
  await expect(page.getByTestId('assigned-count')).toContainText('1/10', { timeout: 20_000 });
}

test('desktop gera QR do estado F7 e restaura câmera sem alterar configuração', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await applyOneMaterial(page);

  const viewer = page.getByTestId('karv-viewer');
  const before = await viewer.evaluate((element) => {
    const api = element as HTMLElement & {
      getCameraOrbit(): { toString(): string };
      getCameraTarget(): { toString(): string };
      getFieldOfView(): number;
    };
    return {
      orbit: api.getCameraOrbit().toString(),
      target: api.getCameraTarget().toString(),
      fieldOfView: api.getFieldOfView(),
    };
  });

  await page.getByRole('button', { name: 'Ver no ambiente' }).click();
  const handoff = page.getByTestId('ar-handoff');
  await expect(handoff).toBeVisible();
  await expect(page.getByAltText('QR Code da configuração atual')).toBeVisible({ timeout: 20_000 });
  const handoffUrl = await handoff.getAttribute('data-handoff-url');
  expect(handoffUrl).toBeTruthy();
  const url = new URL(handoffUrl ?? '');
  expect(url.searchParams.get('config')).toBeTruthy();
  expect(url.searchParams.get('intent')).toBe('ar');
  await expect(page.getByTestId('assigned-count')).toContainText('1/10');

  const sideTheta = await viewer.evaluate((element) => {
    const api = element as HTMLElement & { getCameraOrbit(): { theta: number } };
    return api.getCameraOrbit().theta;
  });
  expect(sideTheta).toBeCloseTo(Math.PI / 2, 2);

  await page.getByRole('button', { name: 'Fechar QR Code' }).click();
  await expect(handoff).toBeHidden();
  const after = await viewer.evaluate((element) => {
    const api = element as HTMLElement & {
      getCameraOrbit(): { toString(): string };
      getCameraTarget(): { toString(): string };
      getFieldOfView(): number;
    };
    return {
      orbit: api.getCameraOrbit().toString(),
      target: api.getCameraTarget().toString(),
      fieldOfView: api.getFieldOfView(),
    };
  });
  expect(after).toEqual(before);
  await expect(page.getByTestId('assigned-count')).toContainText('1/10');
});

test('QR abre nova sessão mobile com a mesma configuração antes do fallback AR', async ({
  browser,
  page,
}) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);
  await applyOneMaterial(page);
  await page.getByRole('button', { name: 'Ver no ambiente' }).click();
  const handoff = page.getByTestId('ar-handoff');
  await expect(page.getByAltText('QR Code da configuração atual')).toBeVisible({ timeout: 20_000 });
  const handoffUrl = await handoff.getAttribute('data-handoff-url');
  expect(handoffUrl).toBeTruthy();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/151 Mobile Safari/537.36',
  });
  const mobilePage = await mobileContext.newPage();
  await installMaterialLibraryFixture(mobilePage);
  await mobilePage.goto(handoffUrl ?? '/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(mobilePage);

  await expect(mobilePage.getByTestId('assigned-count')).toContainText('1/10', { timeout: 30_000 });
  await expect(mobilePage.getByText('Configuração recuperada')).toBeVisible();
  const fallback = mobilePage.getByTestId('ar-mobile-panel');
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('RA indisponível neste dispositivo');
  expect(await fallback.getAttribute('data-handoff-url')).toContain('config=');

  await mobileContext.close();
});

test('runtime AR exclui Scene Viewer e fixa escala física', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);

  const attributes = await page.getByTestId('karv-viewer').evaluate((element) => ({
    ar: element.hasAttribute('ar'),
    modes: element.getAttribute('ar-modes'),
    scale: element.getAttribute('ar-scale'),
    placement: element.getAttribute('ar-placement'),
  }));

  expect(attributes).toEqual({
    ar: true,
    modes: 'webxr quick-look',
    scale: 'fixed',
    placement: 'floor',
  });
  expect(attributes.modes).not.toContain('scene-viewer');
});
