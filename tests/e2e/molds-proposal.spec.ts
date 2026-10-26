import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

test.beforeEach(async ({ page }) => {
  await installMaterialLibraryFixture(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
    timeout: 45_000,
  });
});

test('oferece os oito moldes oficiais e um único pacote ZIP', async ({ page }) => {
  await page.getByRole('button', { name: 'Moldes' }).click();
  const panel = page.getByRole('dialog', { name: 'Download dos Moldes' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: /^Baixar (?!todos)/u })).toHaveCount(8);
  await expect(panel.getByText('Lateral Traseira')).toBeVisible();
  await expect(panel.getByText('Tira Superior da Lateral')).toBeVisible();
  await expect(panel.getByText('Pendente')).toHaveCount(0);
  await expect(panel.getByRole('link', { name: 'Baixar todos (8)' })).toHaveAttribute(
    'href',
    '/moldes/karv-chair/v2/moldes-oficiais-karv.zip',
  );
});

test('resume todas as faces e envia snapshot, configuração e contato', async ({ page }) => {
  const proposalId = 'KARV-PROP-20261021T120000Z-A1B2C3D4';
  let uploads = 0;
  let finalizedPayload: unknown = null;
  await page.route('**/.netlify/functions/submit-proposal*', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      uploads++;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '{"stored":true}',
      });
      return;
    }
    const body = request.postDataJSON() as { action?: string; payload?: unknown };
    if (body.action === 'initialize') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ proposalId, uploadToken: 'test-token' }),
      });
      return;
    }
    finalizedPayload = body.payload;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ proposalId }),
    });
  });

  await page.getByRole('button', { name: 'Enviar proposta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Enviar Proposta' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.proposal-preview li')).toHaveCount(10);
  await expect(dialog.getByAltText('Poltrona KARV com a configuração atual')).toBeVisible();

  await dialog.getByLabel('Nome *').fill('Cliente KARV');
  await dialog.getByLabel('Empresa/Estúdio').fill('Estúdio Exemplo');
  await dialog.getByLabel('WhatsApp *').fill('+55 11 99999-0000');
  await dialog.getByLabel('E-mail *').fill('cliente@example.com');
  await dialog.getByLabel('Cidade/UF *').fill('São Paulo/SP');
  await dialog.getByLabel('Observações').fill('Contato comercial, sem checkout.');
  await dialog.getByRole('button', { name: 'ENVIAR PROPOSTA' }).click();

  await expect(dialog).toContainText(`Proposta ${proposalId} recebida.`);
  expect(uploads).toBeGreaterThan(0);
  expect(finalizedPayload).toMatchObject({
    schema: 'karv.customer-proposal/1',
    geometry: { id: 'karv-chair', version: 2 },
    contact: { name: 'Cliente KARV', email: 'cliente@example.com' },
  });
});
