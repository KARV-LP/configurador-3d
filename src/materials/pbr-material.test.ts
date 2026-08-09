import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { textureTransformForSurface, type ProductionPbrMaterial } from './pbr-material';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const map = parseSurfaceMap(surfaceMapJson, manifest);
const material = Object.freeze({
  physical: Object.freeze({ widthM: 1.2, heightM: 0.6 }),
}) as Pick<ProductionPbrMaterial, 'physical'>;

describe('physical PBR texture transform', () => {
  it('mantém a mesma escala física usando calibração de cada superfície', () => {
    const seat = map.surfaces.find((surface) => surface.surfaceId === 'seat')?.textureFrame;
    const side = map.surfaces.find((surface) => surface.surfaceId === 'backrest-side')?.textureFrame;
    if (!seat || !side) throw new Error('Texture frames canônicos ausentes.');

    const seatTransform = textureTransformForSurface(seat, material);
    const sideTransform = textureTransformForSurface(side, material);

    expect(seatTransform.scale.u).toBeCloseTo(1.264077 / 1.2, 6);
    expect(seatTransform.scale.v).toBeCloseTo(1.264077 / 0.6, 6);
    expect(sideTransform.scale.u).toBeCloseTo(0.832865 / 1.2, 6);
    expect(sideTransform.scale.v).toBeCloseTo(0.832865 / 0.6, 6);
  });

  it('converte rotação e flips do contrato sem depender da UI', () => {
    const transform = textureTransformForSurface(
      {
        uvSet: 0,
        uvName: 'UVMap',
        rotationDegrees: 90,
        flipU: true,
        flipV: false,
        metersPerUvUnit: 1.2,
        calibrationMethod: 'manual',
        calibrationStatus: 'visual-approved',
      },
      material,
    );

    expect(transform.scale.u).toBeCloseTo(-1, 6);
    expect(transform.scale.v).toBeCloseTo(2, 6);
    expect(transform.offset).toEqual({ u: 1, v: 0 });
    expect(transform.rotationRadians).toBeCloseTo(Math.PI / 2, 6);
  });
});
