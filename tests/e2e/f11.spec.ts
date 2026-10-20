import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installMaterialLibraryFixture } from './material-library-fixture';
const fixture = JSON.parse(readFileSync('contracts/examples/proposal.example.json', 'utf8')) as {
  revestimentos: { base_color: { sha256: string } }[];
};
import type {} from './f11-harness';

const url = 'http://127.0.0.1:4174/tests/e2e/f11-harness.html';
test('F11 aplica WebP real apenas no assento, preserva PBR/F7 e reseta baseline', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  const before = await page.evaluate(() => window.f11.snapshot());
  const baseline = await page.locator('model-viewer').screenshot();
  await page.evaluate(() => window.f11.apply());
  const after = await page.evaluate(() => window.f11.snapshot());
  expect(after.state.status).toBe('ready');
  expect(after.f7).toBe(before.f7);
  expect(after.surfaces.filter((s) => s.baseChanged).map((s) => s.id)).toEqual(['seat']);
  expect(after.surfaces.every((s) => s.normalSame && s.aoSame && s.appearanceSame)).toBe(true);
  const custom = await page.locator('model-viewer').screenshot();
  expect(custom.equals(baseline)).toBe(false);
  await page.evaluate(() => window.f11.apply());
  expect((await page.evaluate(() => window.f11.snapshot())).creates).toBe(1);
  await page.evaluate(() => window.f11.reset());
  const reset = await page.evaluate(() => window.f11.snapshot());
  expect(
    reset.surfaces.every((s) => !s.baseChanged && s.normalSame && s.aoSame && s.appearanceSame),
  ).toBe(true);
  expect(reset.cache.active).toBe(0);
  expect(reset.releases).toBe(reset.creates);
  expect(reset.f7).toBe(before.f7);
  expect(errors).toEqual([]);
});

test('F11.3B aplica seis artes WebP e mantém as quatro faces restantes neutras', async ({
  page,
}) => {
  await installMaterialLibraryFixture(page);
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}?proposal=hybrid`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  const before = await page.evaluate(() => window.f11.snapshot());
  await page.evaluate(() => window.f11.apply());
  const after = await page.evaluate(() => window.f11.snapshot());
  const customIds = [
    'seat',
    'backrest-front',
    'backrest-side',
    'backrest-rear',
    'side-outer',
    'side-inner',
  ];
  const neutralIds = ['side-rear', 'side-top', 'piping-seat', 'piping-backrest'];
  expect(after.state.status).toBe('ready');
  expect(after.f7).toBe(before.f7);
  expect(after.surfaces.filter((s) => s.baseChanged).map((s) => s.id)).toEqual(customIds);
  expect(
    after.surfaces
      .filter((s) => s.canonicalChanged)
      .map((s) => s.id)
      .sort(),
  ).toEqual(customIds.sort());
  expect(
    after.surfaces
      .filter((s) => neutralIds.includes(s.id))
      .every((s) => s.assignment == null && !s.baseChanged),
  ).toBe(true);
  expect(after.surfaces.every((s) => s.normalSame && s.aoSame && s.appearanceSame)).toBe(true);
  await page.locator('model-viewer').screenshot({ path: 'artifacts/f11-hybrid-front.png' });
  await page.locator('model-viewer').evaluate((element) => {
    element.setAttribute('camera-orbit', '180deg 60deg 1.6m');
  });
  await page.waitForTimeout(1000);
  await page.locator('model-viewer').screenshot({ path: 'artifacts/f11-hybrid-rear.png' });
  await page.evaluate(() => window.f11.reset());
  const reset = await page.evaluate(() => window.f11.snapshot());
  expect(reset.surfaces.filter((s) => s.baseChanged)).toEqual([]);
  expect(
    reset.surfaces
      .filter((s) => s.canonicalChanged)
      .map((s) => s.id)
      .sort(),
  ).toEqual([]);
  expect(reset.releases).toBe(reset.creates);
  expect(errors).toEqual([]);
});

test('F11 decoder real rejeita WebP corrompido com hash/bytes coerentes sem mutação', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const bytes = Buffer.from(readFileSync('assets/proposals/demo-custom/v1/seat.webp'));
  bytes.fill(0, 12);
  const broken = structuredClone(fixture);
  broken.revestimentos[0]!.base_color.sha256 = createHash('sha256').update(bytes).digest('hex');
  await page.route('**/proposal-assets/demo-custom/v1/seat.webp', (route) =>
    route.fulfill({ body: bytes, contentType: 'image/webp' }),
  );
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  const message = await page.evaluate(async (value) => {
    try {
      await window.f11.apply(value);
      return null;
    } catch (error) {
      return String(error);
    }
  }, broken);
  expect(message).toBeTruthy();
  const state = await page.evaluate(() => window.f11.snapshot());
  expect(state.state.status).toBe('error');
  expect(state.creates).toBe(0);
  expect(state.surfaces.every((s) => !s.baseChanged)).toBe(true);
  expect(errors).toEqual([]);
});
