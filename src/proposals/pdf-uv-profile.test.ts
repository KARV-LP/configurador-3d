import { describe, expect, it } from 'vitest';
import { KARV_PDF_UV_PROFILES, pdfUvProfileFor } from './pdf-uv-profile';

describe('perfis canônicos PDF → UV da Poltrona KARV', () => {
  it('registra as seis faces por surface_id com escala estritamente uniforme', () => {
    expect(KARV_PDF_UV_PROFILES.map((profile) => profile.surfaceId)).toEqual([
      'seat',
      'backrest-front',
      'backrest-side',
      'backrest-rear',
      'side-outer',
      'side-inner',
    ]);

    for (const profile of KARV_PDF_UV_PROFILES) {
      expect(profile.id).not.toContain('sid-tattoo-p4');
      expect(profile.geometryId).toBe('karv-chair');
      expect(profile.geometryVersion).toBe(2);
      expect(profile.uniformScale).toBe(1);
      expect(profile.outputPx.width / profile.templateWindowPx.width).toBe(profile.uniformScale);
      expect(profile.outputPx.height / profile.templateWindowPx.height).toBe(profile.uniformScale);
      expect(profile.templateWindowPx.x).toBeGreaterThanOrEqual(0);
      expect(profile.templateWindowPx.y).toBeGreaterThanOrEqual(0);
      const rotationDegrees: number = profile.rotationDegrees;
      const quarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
      const rotatedWidth = quarterTurn
        ? profile.canonicalRasterPx.height
        : profile.canonicalRasterPx.width;
      const rotatedHeight = quarterTurn
        ? profile.canonicalRasterPx.width
        : profile.canonicalRasterPx.height;
      expect(profile.templateWindowPx.x + profile.templateWindowPx.width).toBeLessThanOrEqual(
        rotatedWidth,
      );
      expect(profile.templateWindowPx.y + profile.templateWindowPx.height).toBeLessThanOrEqual(
        rotatedHeight,
      );
      expect(profile.outputPx.width / profile.outputPx.height).toBeCloseTo(
        profile.contourMm.width / profile.contourMm.height,
        3,
      );
    }
  });

  it('reutiliza o mesmo perfil por face sem conhecer proposal_id', () => {
    const seat = pdfUvProfileFor('seat');
    expect(seat?.id).toBe('karv-chair/v2/seat/pdf-clamp-v1');
    expect(
      pdfUvProfileFor('seat', {
        width: seat!.canonicalRasterPx.width,
        height: seat!.canonicalRasterPx.height,
      }),
    ).toBe(seat);
    expect(pdfUvProfileFor('seat', { width: 128, height: 128 })).toBeNull();
    expect(pdfUvProfileFor('feet')).toBeNull();
  });
});
