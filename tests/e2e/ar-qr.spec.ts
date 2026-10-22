import { expect, test, type Page, type Route } from '@playwright/test';
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

interface ARSessionFixtureState {
  readonly files: Map<string, Buffer>;
  assets: Array<{
    surfaceId: string;
    originalName: string;
    mediaType: string;
    bytes: number;
  }>;
  geometry: { id: string; version: number; sha256: string } | null;
}

const AR_SESSION_ID = 'KARV-AR-20261022T120000Z-ABCDEF12';
const AR_UPLOAD_TOKEN = 'b'.repeat(32);
const AR_ACCESS_TOKEN = 'a'.repeat(48);

async function installARSessionFixture(page: Page, state: ARSessionFixtureState) {
  await page.route('**/.netlify/functions/ar-session**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'PUT') {
      state.files.set(
        url.searchParams.get('surfaceId') ?? '',
        request.postDataBuffer() ?? Buffer.alloc(0),
      );
      await route.fulfill({ status: 201, json: { stored: true } });
      return;
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        action?: string;
        files?: typeof state.assets;
        geometry?: typeof state.geometry;
      };
      if (body.action === 'initialize') {
        await route.fulfill({
          status: 201,
          json: {
            sessionId: AR_SESSION_ID,
            uploadToken: AR_UPLOAD_TOKEN,
            accessToken: AR_ACCESS_TOKEN,
            expiresAt: '2026-10-22T13:00:00.000Z',
          },
        });
        return;
      }
      state.assets = (body.files ?? []).map(({ surfaceId, originalName, mediaType, bytes }) => ({
        surfaceId,
        originalName,
        mediaType,
        bytes,
      }));
      state.geometry = body.geometry ?? null;
      await route.fulfill({ status: 201, json: { sessionId: AR_SESSION_ID } });
      return;
    }
    const surfaceId = url.searchParams.get('surfaceId');
    if (surfaceId) {
      const asset = state.assets.find((candidate) => candidate.surfaceId === surfaceId);
      await route.fulfill({
        status: asset ? 200 : 404,
        contentType: asset?.mediaType ?? 'application/json',
        body: state.files.get(surfaceId) ?? Buffer.alloc(0),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        schema: 'karv.ar-session/1',
        expiresAt: '2026-10-22T13:00:00.000Z',
        geometry: state.geometry,
        assets: state.assets,
      },
    });
  });
}

async function tinyPng(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 3;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível.');
    context.fillStyle = '#8b4ac4';
    context.fillRect(0, 0, 3, 2);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG inválido.')))),
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  return Buffer.from(bytes);
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

test('QR transfere Sua ARTE para Android e iPhone antes de liberar a RA', async ({
  browser,
  page,
}) => {
  const fixture: ARSessionFixtureState = { files: new Map(), assets: [], geometry: null };
  await page.setViewportSize({ width: 1440, height: 900 });
  await installMaterialLibraryFixture(page);
  await installARSessionFixture(page, fixture);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);

  await page.getByRole('button', { name: 'Revestir' }).click();
  await page.getByRole('tab', { name: 'Sua ARTE' }).click();
  const panel = page.getByTestId('custom-art-panel');
  await panel.getByLabel('Face da Sua ARTE').selectOption('backrest-side');
  await panel.getByLabel('Arquivo da Sua ARTE').setInputFiles({
    name: 'arte-ra.png',
    mimeType: 'image/png',
    buffer: await tinyPng(page),
  });
  await expect(panel).toContainText('Aplicado', { timeout: 30_000 });

  await page.getByRole('button', { name: 'Ver no ambiente' }).click();
  const handoff = page.getByTestId('ar-handoff');
  await expect(page.getByAltText('QR Code da configuração atual')).toBeVisible({ timeout: 30_000 });
  const handoffUrl = await handoff.getAttribute('data-handoff-url');
  expect(handoffUrl).toBeTruthy();
  const handoffLocation = new URL(handoffUrl ?? '');
  expect(handoffLocation.searchParams.get('intent')).toBe('ar');
  expect(handoffLocation.searchParams.has('config')).toBe(false);
  expect(new URLSearchParams(handoffLocation.hash.slice(1)).get('ar-session')).toBe(
    `${AR_SESSION_ID}.${AR_ACCESS_TOKEN}`,
  );
  expect(handoffUrl).not.toContain('data:');
  expect(handoffUrl).not.toContain('blob:');

  for (const mobile of [
    {
      name: 'Android',
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/151 Mobile Safari/537.36',
    },
    {
      name: 'iPhone',
      viewport: { width: 393, height: 852 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1',
    },
  ]) {
    const mobileContext = await browser.newContext({
      viewport: mobile.viewport,
      hasTouch: true,
      isMobile: true,
      userAgent: mobile.userAgent,
    });
    const mobilePage = await mobileContext.newPage();
    await installMaterialLibraryFixture(mobilePage);
    await installARSessionFixture(mobilePage, fixture);
    await mobilePage.goto(handoffUrl ?? '/', { waitUntil: 'domcontentloaded' });
    await waitUntilReady(mobilePage);

    await expect(mobilePage.getByTestId('assigned-count'), mobile.name).toContainText('1/10', {
      timeout: 30_000,
    });
    await expect(mobilePage.getByText('Configuração recuperada'), mobile.name).toBeVisible();
    await expect(mobilePage.getByTestId('ar-mobile-panel'), mobile.name).toBeVisible();
    await expect
      .poll(
        () =>
          mobilePage.getByTestId('karv-viewer').evaluate((element) => {
            const viewer = element as HTMLElement & {
              model?: {
                getMaterialByName(name: string): {
                  pbrMetallicRoughness: { baseColorTexture: { texture: unknown } | null };
                } | null;
              };
            };
            return Boolean(
              viewer.model?.getMaterialByName('encosto lat')?.pbrMetallicRoughness.baseColorTexture
                ?.texture,
            );
          }),
        { message: mobile.name },
      )
      .toBe(true);

    await mobilePage.getByRole('button', { name: 'Continuar no 3D' }).click();
    await mobilePage.getByRole('button', { name: 'Revestir' }).click();
    await mobilePage.getByRole('tab', { name: 'Sua ARTE' }).click();
    const mobileArtPanel = mobilePage.getByTestId('custom-art-panel');
    await mobileArtPanel.getByLabel('Face da Sua ARTE').selectOption('backrest-side');
    await expect(mobileArtPanel, mobile.name).toContainText('arte-ra.png');
    await mobileContext.close();
  }
});

test('runtime AR exclui Scene Viewer e fixa escala física', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitUntilReady(page);

  const attributes = await page.getByTestId('karv-viewer').evaluate((element) => {
    const viewer = element as HTMLElement & { ar?: boolean };
    return {
      ar: viewer.ar === true,
      modes: element.getAttribute('ar-modes'),
      scale: element.getAttribute('ar-scale'),
      placement: element.getAttribute('ar-placement'),
    };
  });

  expect(attributes).toEqual({
    ar: true,
    modes: 'webxr quick-look',
    scale: 'fixed',
    placement: 'floor',
  });
  expect(attributes.modes).not.toContain('scene-viewer');
});
