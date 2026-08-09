import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import {
  DIAGNOSTIC_MATERIALS,
  type MaterialAppearance,
  type Rgba,
} from '../materials/runtime-material';
import type { MaterialAppearancePort } from './model-viewer-adapter';
import { MaterialController } from './material-controller';
import { SurfaceRegistry } from './surface-registry';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const registry = new SurfaceRegistry(parseSurfaceMap(surfaceMapJson, manifest));
const baseline: MaterialAppearance = Object.freeze({
  baseColorFactor: Object.freeze([0.8, 0.8, 0.8, 1]) as Rgba,
  metallicFactor: 0,
  roughnessFactor: 0.75,
});

class FakeMaterialPort implements MaterialAppearancePort {
  readonly appearances = new Map<string, MaterialAppearance>();
  picked: string | null = null;

  constructor() {
    for (const surface of registry.configurableSurfaces) {
      this.appearances.set(registry.runtimeMaterialName(surface), baseline);
    }
  }

  materialNameAtPoint(): string | null {
    return this.picked;
  }

  getAppearance(materialName: string): MaterialAppearance {
    const appearance = this.appearances.get(materialName);
    if (!appearance) throw new Error(`Material fake ausente: ${materialName}`);
    return appearance;
  }

  setAppearance(materialName: string, appearance: MaterialAppearance): void {
    if (!this.appearances.has(materialName)) throw new Error('Material fake desconhecido.');
    this.appearances.set(materialName, appearance);
  }

  getBaseColorFactor(materialName: string): Rgba {
    return this.getAppearance(materialName).baseColorFactor;
  }

  setBaseColorFactor(materialName: string, factor: Rgba): void {
    const current = this.getAppearance(materialName);
    this.setAppearance(
      materialName,
      Object.freeze({
        ...current,
        baseColorFactor: factor,
      }),
    );
  }
}

describe('MaterialController', () => {
  it('highlight é reversível e não destrói a aparência corrente', () => {
    const port = new FakeMaterialPort();
    const controller = new MaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície configurável.');
    const name = registry.runtimeMaterialName(surface);
    const before = port.getAppearance(name);

    controller.highlight(surface.surfaceId);
    expect(port.getAppearance(name).baseColorFactor).not.toEqual(before.baseColorFactor);
    controller.clearHighlight();
    expect(port.getAppearance(name)).toEqual(before);
  });

  it('highlight restaura somente Base Color e preserva PBR alterado enquanto selecionado', () => {
    const port = new FakeMaterialPort();
    const controller = new MaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície configurável.');
    const name = registry.runtimeMaterialName(surface);

    controller.highlight(surface.surfaceId);
    port.setAppearance(
      name,
      Object.freeze({
        baseColorFactor: Object.freeze([1, 1, 1, 1]) as Rgba,
        metallicFactor: 0,
        roughnessFactor: 0.72,
      }),
    );
    controller.clearHighlight();

    expect(port.getAppearance(name)).toMatchObject({
      baseColorFactor: baseline.baseColorFactor,
      metallicFactor: 0,
      roughnessFactor: 0.72,
    });
  });

  it('aplica e reseta uma superfície pela API do core', () => {
    const port = new FakeMaterialPort();
    const controller = new MaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície configurável.');
    const name = registry.runtimeMaterialName(surface);

    controller.apply(surface.surfaceId, DIAGNOSTIC_MATERIALS.sand);
    expect(port.getAppearance(name)).toEqual(DIAGNOSTIC_MATERIALS.sand.appearance);
    controller.reset(surface.surfaceId);
    expect(port.getAppearance(name)).toEqual(baseline);
  });

  it('aplica globalmente somente nas superfícies configuráveis', () => {
    const port = new FakeMaterialPort();
    const controller = new MaterialController(registry, port);
    controller.initialize();

    controller.applyAll(DIAGNOSTIC_MATERIALS.graphite);
    for (const appearance of port.appearances.values()) {
      expect(appearance).toEqual(DIAGNOSTIC_MATERIALS.graphite.appearance);
    }
  });

  it('impede aplicação em superfície fixa', () => {
    const port = new FakeMaterialPort();
    const controller = new MaterialController(registry, port);
    controller.initialize();
    const fixed = registry.fixedSurfaces[0];
    if (!fixed) throw new Error('Fixture sem superfície fixa.');

    expect(() => controller.apply(fixed.surfaceId, DIAGNOSTIC_MATERIALS.sand)).toThrow(
      'Superfície não configurável',
    );
  });
});
