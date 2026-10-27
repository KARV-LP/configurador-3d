import { expect, test } from '@playwright/test';
import {
  installMaterialLibraryFixture,
  LIBRARY_CATALOG_PATH,
  PUBLIC_CATALOG_FIXTURE,
} from './material-library-fixture';

for (const viewport of [
  { width: 1672, height: 941 },
  { width: 390, height: 844 },
]) {
  test(`categorias, galeria e seleção em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installMaterialLibraryFixture(page);
    const first = PUBLIC_CATALOG_FIXTURE.materials[0]!;
    await page.route(`**${LIBRARY_CATALOG_PATH}`, (route) =>
      route.fulfill({
        json: {
          ...PUBLIC_CATALOG_FIXTURE,
          materials: [
            {
              ...first,
              category: 'Estampado',
              media: {
                images: [
                  { src: first.assets.preview },
                  { src: first.assets.base_color, thumbnail: first.assets.preview },
                ],
                video: { src: './assets/fabric-kv-001/test.mp4', poster: first.assets.preview },
              },
            },
            ...PUBLIC_CATALOG_FIXTURE.materials.slice(1),
          ],
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Revestir' }).click();
    const panel = page.getByTestId('material-library');
    const categories = panel.getByRole('navigation', { name: 'Categoria', exact: true });
    await expect(categories.getByRole('button')).toHaveCount(9);
    await categories.getByRole('button', { name: 'Estampado', exact: true }).click();
    const card = panel.getByRole('button', { name: /Toledo Escama Preto,/ });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: 'Foto 2', exact: true }).click();
    await expect(panel.locator('.revestimento-gallery__stage img')).toHaveAttribute(
      'src',
      /base-color.webp$/,
    );
    await panel.getByRole('button', { name: 'Ver vídeo', exact: true }).click();
    const video = panel.locator('video');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).not.toHaveAttribute('autoplay');
    await expect.poll(() => video.evaluate((el) => el.paused)).toBe(true);
    await panel.getByRole('button', { name: 'Mídia anterior' }).click();
    await expect(video).toHaveCount(0);
    await categories.getByRole('button', { name: 'Veludo', exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /Veludo Milano Bege,/ })).toBeVisible();
    await expect(
      panel.getByRole('button', { name: 'Aplicar em toda a poltrona', exact: true }),
    ).toBeDisabled();
    await panel.getByRole('tab', { name: 'Couro e Courvin' }).click();
    await expect(panel).toContainText('Couro e Courvin em preparação');
    await expect(panel.locator('.material-card')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Aplicar nesta área' })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await panel.getByRole('tab', { name: 'Tecidos', exact: true }).click();
    await expect(panel.locator('.material-card')).toHaveCount(3);
    await card.click();
    await panel.screenshot({ path: `test-results/revestimentos-${viewport.width}.png` });
  });
}
