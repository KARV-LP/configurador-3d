import { expect, test } from '@playwright/test';

test('carrega a poltrona canônica sem erro crítico de página', async ({ page }) => {
  const criticalErrors: string[] = [];

  page.on('pageerror', (error) => criticalErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') criticalErrors.push(message.text());
  });

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Configurador 3D KARV' }),
  ).toBeVisible();

  const viewer = page.getByTestId('karv-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('src', /base(?:-[\w]+)?\.glb/);
  await expect(page.locator('[data-viewer-status]')).toHaveText('3D pronto', {
    timeout: 30_000,
  });

  expect(criticalErrors).toEqual([]);
});
