import type { SurfaceDescriptor } from '../domain/surface-map';
import type { MaterialAppearancePort } from './model-viewer-adapter';
import { SurfaceRegistry } from './surface-registry';

export type SelectionResult =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'fixed' | 'configurable';
      surfaceId: string;
      publicName: string;
      publicGroup: string;
    }>;

function resultFor(surface: SurfaceDescriptor): SelectionResult {
  return Object.freeze({
    kind: surface.classification,
    surfaceId: surface.surfaceId,
    publicName: surface.publicName,
    publicGroup: surface.publicGroup,
  });
}

export class SelectionController {
  constructor(
    private readonly registry: SurfaceRegistry,
    private readonly port: Pick<MaterialAppearancePort, 'materialNameAtPoint'>,
  ) {}

  selectAt(clientX: number, clientY: number): SelectionResult {
    const materialName = this.port.materialNameAtPoint(clientX, clientY);
    if (!materialName) return Object.freeze({ kind: 'none' });
    const surface = this.registry.fromRuntimeMaterialName(materialName);
    return surface ? resultFor(surface) : Object.freeze({ kind: 'none' });
  }

  selectSurface(surfaceId: string): SelectionResult {
    const surface = this.registry.get(surfaceId);
    return surface ? resultFor(surface) : Object.freeze({ kind: 'none' });
  }
}
