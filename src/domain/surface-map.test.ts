import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from './geometry-manifest';
import { parseSurfaceMap } from './surface-map';
import { SurfaceRegistry } from '../3d/surface-registry';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const surfaceMap = parseSurfaceMap(surfaceMapJson, manifest);

describe('surface map canônico', () => {
  it('preserva dez superfícies configuráveis e uma fixa', () => {
    const registry = new SurfaceRegistry(surfaceMap);

    expect(registry.configurableSurfaces).toHaveLength(10);
    expect(registry.fixedSurfaces).toHaveLength(1);
    expect(surfaceMap.surfaces).toHaveLength(11);
  });

  it('mantém IDs e materiais runtime sem ambiguidade', () => {
    const registry = new SurfaceRegistry(surfaceMap);
    const ids = surfaceMap.surfaces.map((surface) => surface.surfaceId);
    const runtimeNames = surfaceMap.surfaces.map((surface) => registry.runtimeMaterialName(surface));

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(runtimeNames).size).toBe(runtimeNames.length);
  });

  it('mantém regras de textura somente no contrato das superfícies configuráveis', () => {
    for (const surface of surfaceMap.surfaces) {
      if (surface.classification === 'configurable') {
        expect(surface.textureFrame).toBeDefined();
        expect(surface.textureFrame?.metersPerUvUnit).toBeGreaterThan(0);
      } else {
        expect(surface.textureFrame).toBeUndefined();
      }
    }
  });

  it('cria nomes runtime independentes para bindings que exigem instância', () => {
    const registry = new SurfaceRegistry(surfaceMap);
    const specialized = surfaceMap.surfaces.filter(
      (surface) => surface.binding.requiresMaterialInstance,
    );

    expect(specialized).toHaveLength(2);
    expect(new Set(specialized.map((surface) => registry.runtimeMaterialName(surface))).size).toBe(2);
  });
});
