import { describe, expect, it } from 'vitest';
import { SID_TATTOO_P4_PDF_UV_PROFILES, pdfUvProfileFor } from './pdf-uv-profile';

describe('perfil PDF → UV sid-tattoo-p4', () => {
  it('registra as seis faces custom com escala estritamente uniforme', () => {
    expect(SID_TATTOO_P4_PDF_UV_PROFILES.map((profile) => profile.surfaceId)).toEqual([
      'seat',
      'backrest-front',
      'backrest-side',
      'backrest-rear',
      'side-outer',
      'side-inner',
    ]);

    for (const profile of SID_TATTOO_P4_PDF_UV_PROFILES) {
      expect(profile.uniformScale).toBe(1);
      expect(profile.outputPx.width / profile.cropPx.width).toBe(profile.uniformScale);
      expect(profile.outputPx.height / profile.cropPx.height).toBe(profile.uniformScale);
      expect(profile.cropPx.x).toBeGreaterThanOrEqual(0);
      expect(profile.cropPx.y).toBeGreaterThanOrEqual(0);
      const rotationDegrees: number = profile.rotationDegrees;
      const quarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
      const rotatedWidth = quarterTurn ? profile.sourcePx.height : profile.sourcePx.width;
      const rotatedHeight = quarterTurn ? profile.sourcePx.width : profile.sourcePx.height;
      expect(profile.cropPx.x + profile.cropPx.width).toBeLessThanOrEqual(rotatedWidth);
      expect(profile.cropPx.y + profile.cropPx.height).toBeLessThanOrEqual(rotatedHeight);
      expect(profile.outputPx.width / profile.outputPx.height).toBeCloseTo(
        profile.contourMm.width / profile.contourMm.height,
        3,
      );
    }
  });

  it('não aplica perfil a outra proposta', () => {
    expect(pdfUvProfileFor('outra-proposta', 'seat')).toBeNull();
    expect(pdfUvProfileFor('sid-tattoo-p4', 'feet')).toBeNull();
  });
});
