import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { ConfigurationStore } from '../configurator/configuration-store';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { DIAGNOSTIC_MATERIALS, type MaterialAppearance } from '../materials/runtime-material';
import { Core3DController } from './core-3d-controller';
import { MaterialController } from './material-controller';
import type { MaterialAppearancePort } from './model-viewer-adapter';
import { SelectionController } from './selection-controller';
import { SurfaceRegistry } from './surface-registry';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const registry = new SurfaceRegistry(parseSurfaceMap(surfaceMapJson, manifest));

class FakePort implements MaterialAppearancePort {
  readonly appearances = new Map<string, MaterialAppearance>();
  materialNameAtPoint(): string | null {
    return null;
  }
  getAppearance(name: string): MaterialAppearance {
    const appearance = this.appearances.get(name);
    if (!appearance) throw new Error('Material fake ausente.');
    return appearance;
  }
  setAppearance(name: string, appearance: MaterialAppearance): void {
    this.appearances.set(name, appearance);
  }
}

function createCore() {
  const port = new FakePort();
  const initial: MaterialAppearance = Object.freeze({
    baseColorFactor: Object.freeze([0.7, 0.7, 0.7, 1]),
    metallicFactor: 0,
    roughnessFactor: 0.8,
  });
  for (const surface of registry.configurableSurfaces) {
    port.appearances.set(registry.runtimeMaterialName(surface), initial);
  }
  const materials = new MaterialController(registry, port);
  materials.initialize();
  const store = new ConfigurationStore(
    registry.configurableSurfaces.map((surface) => surface.surfaceId),
  );
  return new Core3DController(
    new SelectionController(registry, port),
    materials,
    store,
    () => undefined,
  );
}

describe('Core3DController', () => {
  it('aplica por peça, aplica globalmente e reseta sem DOM', () => {
    const core = createCore();
    const first = registry.configurableSurfaces[0];
    if (!first) throw new Error('Fixture sem superfície configurável.');

    expect(core.selectSurface(first.surfaceId).kind).toBe('configurable');
    expect(core.applySelected(DIAGNOSTIC_MATERIALS.sand)).toBe(true);
    expect(core.getConfiguration().assignments[first.surfaceId]).toBe(
      DIAGNOSTIC_MATERIALS.sand.id,
    );
    expect(Object.values(core.getConfiguration().assignments).filter(Boolean)).toHaveLength(1);

    core.applyAll(DIAGNOSTIC_MATERIALS.graphite);
    expect(Object.values(core.getConfiguration().assignments)).toEqual(
      Array(10).fill(DIAGNOSTIC_MATERIALS.graphite.id),
    );

    expect(core.resetSelected()).toBe(true);
    expect(core.getConfiguration().assignments[first.surfaceId]).toBeNull();
    core.resetAll();
    expect(Object.values(core.getConfiguration().assignments).every((value) => value === null)).toBe(
      true,
    );
  });

  it('não permite que a seleção fixa vire alvo de aplicação', () => {
    const core = createCore();
    const fixed = registry.fixedSurfaces[0];
    if (!fixed) throw new Error('Fixture sem superfície fixa.');

    expect(core.selectSurface(fixed.surfaceId).kind).toBe('fixed');
    expect(core.applySelected(DIAGNOSTIC_MATERIALS.sand)).toBe(false);
  });
});
