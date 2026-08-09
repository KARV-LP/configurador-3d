import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { SelectionController } from './selection-controller';
import { SurfaceRegistry } from './surface-registry';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const registry = new SurfaceRegistry(parseSurfaceMap(surfaceMapJson, manifest));

class PickPort {
  picked: string | null = null;
  materialNameAtPoint(): string | null {
    return this.picked;
  }
}

describe('SelectionController', () => {
  it('seleciona todas as superfícies configuráveis por material runtime', () => {
    const port = new PickPort();
    const selection = new SelectionController(registry, port);

    for (const surface of registry.configurableSurfaces) {
      port.picked = registry.runtimeMaterialName(surface);
      expect(selection.selectAt(10, 20)).toMatchObject({
        kind: 'configurable',
        surfaceId: surface.surfaceId,
        publicName: surface.publicName,
      });
    }
  });

  it('rejeita uma superfície fixa como configurável', () => {
    const port = new PickPort();
    const fixed = registry.fixedSurfaces[0];
    if (!fixed) throw new Error('Fixture sem superfície fixa.');
    port.picked = registry.runtimeMaterialName(fixed);
    const selection = new SelectionController(registry, port);

    expect(selection.selectAt(10, 20)).toMatchObject({
      kind: 'fixed',
      surfaceId: fixed.surfaceId,
    });
  });

  it('retorna none sem hit válido', () => {
    const port = new PickPort();
    expect(new SelectionController(registry, port).selectAt(0, 0)).toEqual({ kind: 'none' });
  });
});
