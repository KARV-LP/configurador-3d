import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

function canonicalBackrestSidePdf(): Buffer {
  const content = 'q\n0.12 0.18 0.24 rg\n0 0 1233 1253 re f\n0.8 0.55 0.2 rg\n120 140 993 973 re f\nQ\n';
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

test('Sua ARTE aplica PDF local somente após escolha explícita da face', async ({ page }) => {
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
  await expect(panel.getByRole('button', { name: 'Carregar PDF' })).toBeDisabled();

  await panel.getByLabel('Face da Sua ARTE').selectOption('backrest-side');
  await expect(panel.getByRole('button', { name: 'Carregar PDF' })).toBeEnabled();

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

  await panel.getByLabel('Arquivo PDF da Sua ARTE').setInputFiles({
    name: 'ENCOSTO_LATERAL.pdf',
    mimeType: 'application/pdf',
    buffer: canonicalBackrestSidePdf(),
  });

  await expect(panel).toContainText('Aplicado', { timeout: 45_000 });
  await expect(panel).toContainText('ENCOSTO_LATERAL.pdf');
  await expect(panel).toContainText('Arte aplicada somente nesta face.');
  await expect(page.getByTestId('assigned-count')).toHaveText('1/10');

  const states = await page.evaluate(
    () => (window as Window & { __karvCustomArtStates: string[] }).__karvCustomArtStates,
  );
  expect(states).toContain('Processando');
  expect(states).toContain('Aplicado');
  expect(outboundWrites).toEqual([]);

  await panel.getByRole('button', { name: 'Remover arte' }).click();
  await expect(panel).toContainText('Aguardando');
  await expect(page.getByTestId('assigned-count')).toHaveText('0/10');
  expect(errors).toEqual([]);
});
