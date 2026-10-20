import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installMaterialLibraryFixture } from './material-library-fixture';

const enabled = process.env.VITE_F11_REVIEW_PROPOSAL === 'sid-tattoo-p4';
const evidenceDir = 'artifacts/f11-visual-review';

test.describe('F11.3 gate visual no configurador real', () => {
  test.skip(!enabled, 'Executado somente no gate visual opt-in F11.3.');

  test('mantém proposta, Biblioteca KARV e texturas durante órbita horizontal completa', async ({
    page,
  }) => {
    mkdirSync(evidenceDir, { recursive: true });
    await installMaterialLibraryFixture(page);
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('viewer-status')).toHaveAttribute('data-state', 'ready', {
      timeout: 45_000,
    });
    await expect(page.locator('body')).toHaveAttribute('data-f11-proposal', 'sid-tattoo-p4', {
      timeout: 45_000,
    });

    const viewer = page.getByTestId('karv-viewer');
    await expect(viewer).toHaveAttribute('max-camera-orbit', '180deg 78deg 4.2m');
    await expect(page.getByRole('button', { name: 'Revestir' })).toBeVisible();
    await page.getByRole('button', { name: 'Revestir' }).click();
    await expect(page.getByTestId('material-library')).toBeVisible();
    await expect(page.getByRole('button', { name: /Croma Musgo Pet Friendly/u })).toBeVisible();
    await expect(page.getByLabel('Área da poltrona').locator('option')).toHaveCount(11);
    await page.getByRole('button', { name: 'Fechar biblioteca de Revestimentos' }).click();

    const assertPersistent = async () => {
      const snapshot = await page.evaluate(() => window.__karvF11Review?.snapshot());
      expect(snapshot).toBeTruthy();
      expect(Object.keys(snapshot ?? {})).toHaveLength(10);
      expect(Object.values(snapshot ?? {}).every(({ present, stable }) => present && stable)).toBe(
        true,
      );
    };

    const capture = async (name: string, azimuth: number) => {
      await viewer.evaluate((element, degrees) => {
        element.setAttribute('camera-orbit', `${degrees}deg 72deg 3.4m`);
      }, azimuth);
      await page.waitForTimeout(700);
      await assertPersistent();
      await viewer.screenshot({ path: `${evidenceDir}/${name}.png` });
    };

    await capture('01-frontal', 0);
    await capture('02-tres-quartos-frontal', -45);
    await capture('03-lateral', -90);
    await capture('04-traseira', 180);
    await capture('05-tres-quartos-traseira', 135);

    await viewer.evaluate((element) => {
      element.setAttribute('camera-orbit', '0deg 72deg 3.4m');
    });
    await page.waitForTimeout(700);
    const frontBox = await viewer.boundingBox();
    expect(frontBox).not.toBeNull();
    if (frontBox) {
      await page.screenshot({
        path: `${evidenceDir}/06-detalhe-encosto-frontal-assento.png`,
        clip: {
          x: frontBox.x + frontBox.width * 0.25,
          y: frontBox.y + frontBox.height * 0.3,
          width: frontBox.width * 0.5,
          height: frontBox.height * 0.48,
        },
      });
    }

    await viewer.evaluate((element) => {
      element.setAttribute('camera-orbit', '145deg 72deg 3.4m');
    });
    await page.waitForTimeout(700);
    const rearBox = await viewer.boundingBox();
    expect(rearBox).not.toBeNull();
    if (rearBox) {
      await page.screenshot({
        path: `${evidenceDir}/07-detalhe-encosto-traseiro-lateral-externa.png`,
        clip: {
          x: rearBox.x + rearBox.width * 0.18,
          y: rearBox.y + rearBox.height * 0.18,
          width: rearBox.width * 0.64,
          height: rearBox.height * 0.58,
        },
      });
    }

    for (const azimuth of [180, 135, 90, 45, 0, -45, -90, -135, -180]) {
      await viewer.evaluate((element, degrees) => {
        element.setAttribute('camera-orbit', `${degrees}deg 72deg 3.4m`);
      }, azimuth);
      await page.waitForTimeout(180);
      await assertPersistent();
    }

    expect(errors).toEqual([]);
  });
});
