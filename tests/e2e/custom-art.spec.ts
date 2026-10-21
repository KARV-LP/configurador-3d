import { expect, test, type Page } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

const CONFIGURABLE_MATERIALS = [
  'assento',
  'encosto-frt',
  'encosto lat',
  'encosto traseiro',
  'lat ext ',
  'lat int',
  'lat rr',
  'Material.012',
  'VIVO',
] as const;

function canonicalBackrestSidePdf(): Buffer {
  const content =
    'q\n0.12 0.18 0.24 rg\n0 0 1233 1253 re f\n0.8 0.55 0.2 rg\n120 140 993 973 re f\nQ\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1233 1253] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function rasterBuffer(page: Page, type: 'image/png' | 'image/jpeg'): Promise<Buffer> {
  const bytes = await page.evaluate(async (mediaType) => {
    const canvas = document.createElement('canvas');
    canvas.width = 3;
    canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível no teste.');
    context.fillStyle = '#7b3fc6';
    context.fillRect(0, 0, 2, 2);
    context.fillStyle = '#e9b44c';
    context.fillRect(2, 0, 1, 1);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Falha ao criar fixture.'))),
        mediaType,
        0.92,
      ),
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, type);
  return Buffer.from(bytes);
}

async function baseColorPresence(page: Page): Promise<Record<string, boolean>> {
  return page.getByTestId('karv-viewer').evaluate((element, materialNames) => {
    const viewer = element as HTMLElement & {
      model?: {
        getMaterialByName(name: string): {
          pbrMetallicRoughness: { baseColorTexture: { texture: unknown } | null };
        } | null;
      };
    };
    return Object.fromEntries(
      materialNames.map((name) => [
        name,
        Boolean(
          viewer.model?.getMaterialByName(name)?.pbrMetallicRoughness.baseColorTexture?.texture,
        ),
      ]),
    );
  }, CONFIGURABLE_MATERIALS);
}

test('Sua ARTE aplica PDF, PNG, JPG e JPEG somente na face escolhida', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  const errors: string[] = [];
  const outboundWrites: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) {
      outboundWrites.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-configurator-ready', 'true', {
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Revestir' }).click();
  await page.getByRole('tab', { name: 'Sua ARTE' }).click();

  const panel = page.getByTestId('custom-art-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Aceitamos PDF, PNG e JPEG');
  await expect(panel.getByRole('button', { name: 'Carregar arquivo' })).toBeDisabled();

  await panel.getByLabel('Face da Sua ARTE').selectOption('backrest-side');
  await expect(panel.getByRole('button', { name: 'Carregar arquivo' })).toBeEnabled();
  expect(Object.values(await baseColorPresence(page)).every((present) => !present)).toBe(true);

  await page.evaluate(() => {
    const states: string[] = [];
    const capture = () => {
      const value = document.querySelector('.custom-art__status span')?.textContent;
      if (value) states.push(value);
    };
    capture();
    new MutationObserver(capture).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    Object.assign(window, { __karvCustomArtStates: states });
  });

  const png = await rasterBuffer(page, 'image/png');
  const jpeg = await rasterBuffer(page, 'image/jpeg');
  const cases = [
    {
      name: 'ENCOSTO_LATERAL.pdf',
      mimeType: 'application/pdf',
      buffer: canonicalBackrestSidePdf(),
      raster: false,
    },
    { name: 'arte.png', mimeType: 'image/png', buffer: png, raster: true },
    { name: 'arte.jpg', mimeType: 'image/jpeg', buffer: jpeg, raster: true },
    { name: 'arte.jpeg', mimeType: 'image/jpeg', buffer: jpeg, raster: true },
  ] as const;

  for (const candidate of cases) {
    await panel.getByLabel('Arquivo da Sua ARTE').setInputFiles(candidate);
    await expect(panel).toContainText('Aplicado', { timeout: 45_000 });
    await expect(panel).toContainText(candidate.name);
    await expect(panel).toContainText('Arte aplicada somente nesta face.');
    await expect(page.getByTestId('assigned-count')).toHaveText('1/10');

    const presence = await baseColorPresence(page);
    expect(presence['encosto lat']).toBe(true);
    expect(
      Object.entries(presence)
        .filter(([name]) => name !== 'encosto lat')
        .every(([, present]) => !present),
    ).toBe(true);

    if (candidate.raster) {
      const dimensions = await panel
        .locator('.custom-art__status img')
        .evaluate((image) => [
          (image as HTMLImageElement).naturalWidth,
          (image as HTMLImageElement).naturalHeight,
        ]);
      expect(dimensions).toEqual([3, 2]);
    }
  }

  const states = await page.evaluate(
    () => (window as Window & { __karvCustomArtStates: string[] }).__karvCustomArtStates,
  );
  expect(states).toContain('Processando');
  expect(states).toContain('Aplicado');
  expect(outboundWrites).toEqual([]);

  await panel.getByRole('button', { name: 'Remover arte' }).click();
  await expect(panel).toContainText('Aguardando');
  await expect(page.getByTestId('assigned-count')).toHaveText('0/10');
  expect(Object.values(await baseColorPresence(page)).every((present) => !present)).toBe(true);
  expect(errors).toEqual([]);
});

test('Sua ARTE rejeita divergência de MIME, extensão e assinatura', async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/');
  await expect(page.locator('main')).toHaveAttribute('data-configurator-ready', 'true', {
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Revestir' }).click();
  await page.getByRole('tab', { name: 'Sua ARTE' }).click();

  const panel = page.getByTestId('custom-art-panel');
  await panel.getByLabel('Face da Sua ARTE').selectOption('backrest-side');
  const input = panel.getByLabel('Arquivo da Sua ARTE');
  const jpeg = await rasterBuffer(page, 'image/jpeg');

  await input.setInputFiles({ name: 'arte.png', mimeType: 'image/jpeg', buffer: jpeg });
  await expect(panel).toContainText('extensão e tipo de arquivo correspondentes');

  await input.setInputFiles({
    name: 'arte.jpg',
    mimeType: 'image/jpeg',
    buffer: canonicalBackrestSidePdf(),
  });
  await expect(panel).toContainText('conteúdo do arquivo não corresponde');
  expect(Object.values(await baseColorPresence(page)).every((present) => !present)).toBe(true);
});
