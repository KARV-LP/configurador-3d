import { chromium } from '@playwright/test';

const [beforeUrl, afterUrl] = process.argv.slice(2);
const catalogPath = '/KARV-LP/karv-material-library/main/public/v1/catalog.json';
const assetPrefix = '/KARV-LP/karv-material-library/main/public/v1/assets/';
const hash = 'a'.repeat(64);
const material = {
  id: 'fabric-kv-002',
  channel: 'fabric',
  name: 'Croma Musgo Pet Friendly',
  collection: 'All Colours',
  color: { name: 'Musgo', family: 'verde' },
  material_type: 'sarjado peletizado',
  technologies: [],
  functional: {
    pet_friendly: false,
    water_repellency: false,
    easy_clean: false,
    indoor_use: true,
    outdoor_use: false,
  },
  appearance: {
    texture: 'fixture',
    touch: 'macio',
    sheen: 'baixo',
    visual_character: ['fixture'],
  },
  physical_reference_cm: { width: 120, height: 60 },
  assets: {
    preview: './assets/fabric-kv-002/preview.webp',
    base_color: './assets/fabric-kv-002/base-color.webp',
    normal: './assets/fabric-kv-002/normal.webp',
    ao: './assets/fabric-kv-002/ao.webp',
  },
  asset_integrity: {
    base_color: { sha256: hash, width_px: 1, height_px: 1, bytes: 38 },
    normal: { sha256: hash, width_px: 1, height_px: 1, bytes: 38 },
    ao: { sha256: hash, width_px: 1, height_px: 1, bytes: 38 },
  },
  pbr: {
    status: 'production',
    roughness_factor: 0.88,
    metalness: 0,
    normal_convention: 'opengl',
    normal_strength: 1,
    ao_strength: 1,
  },
  published: true,
  ready_for_configurator: true,
  pbr_ready: true,
  compatibility: { geometry_ids: ['karv-chair'], min_geometry_version: 2 },
};
const catalog = {
  schema: 'karv.public-material-catalog/1',
  channels: ['fabric', 'karv_design'],
  materials: [material],
};
const transparentWebp = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64',
);

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summarize = (runs) => ({
  glbVisibleMs: median(runs.map((run) => run.glbVisibleMs)),
  interactiveMs: median(runs.map((run) => run.interactiveMs)),
  initialRequests: median(runs.map((run) => run.initialRequests)),
  initialBytes: median(runs.map((run) => run.initialBytes)),
  catalogRequests: median(runs.map((run) => run.catalogRequests)),
  runs,
});

async function measure(url) {
  const browser = await chromium.launch({ headless: true });
  const runs = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    let interactiveAt = Number.POSITIVE_INFINITY;
    const finished = [];
    await page.route('**/*', async (route) => {
      const target = new URL(route.request().url());
      if (target.hostname === 'raw.githubusercontent.com' && target.pathname === catalogPath) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(catalog),
        });
        return;
      }
      if (target.hostname === 'raw.githubusercontent.com' && target.pathname.startsWith(assetPrefix)) {
        await route.fulfill({
          status: 200,
          contentType: 'image/webp',
          headers: { 'access-control-allow-origin': '*' },
          body: transparentWebp,
        });
        return;
      }
      await route.continue();
    });
    const startedAt = performance.now();
    page.on('requestfinished', async (request) => {
      const endedAt = performance.now();
      try {
        const response = await request.response();
        const bytes = response ? (await response.body()).byteLength : 0;
        finished.push({ url: request.url(), endedAt, bytes });
      } catch {
        finished.push({ url: request.url(), endedAt, bytes: 0 });
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const viewer = document.querySelector('model-viewer');
      return Boolean(viewer && viewer.loaded);
    }, null, { timeout: 45000 });
    const glbVisibleMs = Math.round(performance.now() - startedAt);
    await page.locator('main').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.querySelector('main')?.getAttribute('data-configurator-ready') === 'true',
      null,
      { timeout: 45000 },
    );
    interactiveAt = performance.now();
    await page.waitForTimeout(150);
    const initial = finished.filter((entry) => entry.endedAt <= interactiveAt);
    runs.push({
      glbVisibleMs,
      interactiveMs: Math.round(interactiveAt - startedAt),
      initialRequests: initial.length,
      initialBytes: initial.reduce((total, entry) => total + entry.bytes, 0),
      catalogRequests: initial.filter((entry) => entry.url.includes(catalogPath)).length,
    });
    await context.close();
  }
  await browser.close();
  return summarize(runs);
}

const before = await measure(beforeUrl);
const after = await measure(afterUrl);
const result = {
  method: 'median of 3 cold Chromium contexts; local production previews; deterministic catalog fixture',
  baselineSha: '159f6195f28a8d7de68df59cc8f64872f98d1688',
  candidateSha: process.env.CANDIDATE_SHA,
  before,
  after,
  delta: {
    glbVisibleMs: after.glbVisibleMs - before.glbVisibleMs,
    interactiveMs: after.interactiveMs - before.interactiveMs,
    initialRequests: after.initialRequests - before.initialRequests,
    initialBytes: after.initialBytes - before.initialBytes,
    catalogRequests: after.catalogRequests - before.catalogRequests,
  },
};
process.stdout.write(JSON.stringify(result, null, 2));
