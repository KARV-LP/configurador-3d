import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { CameraController } from './camera-controller';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const surfaceMap = parseSurfaceMap(surfaceMapJson, manifest);
const camera = new CameraController(surfaceMap.camera);

describe('CameraController', () => {
  it('deriva os atributos de câmera do contrato F0', () => {
    const attributes = camera.attributes();

    expect(attributes.cameraOrbit).toBe('0deg 75deg 1.6m');
    expect(attributes.minCameraOrbit).toBe('-180deg 35deg 0.9m');
    expect(attributes.maxCameraOrbit).toBe('180deg 90deg 3m');
    expect(attributes.disableZoom).toBe(true);
  });

  it('limita órbitas aos limites canônicos', () => {
    expect(camera.clampOrbit({ azimuthDeg: -999, polarDeg: 5, radiusM: 0.1 })).toEqual({
      azimuthDeg: -180,
      polarDeg: 35,
      radiusM: 0.9,
    });
    expect(camera.clampOrbit({ azimuthDeg: 999, polarDeg: 150, radiusM: 9 })).toEqual({
      azimuthDeg: 180,
      polarDeg: 90,
      radiusM: 3,
    });
  });
});
