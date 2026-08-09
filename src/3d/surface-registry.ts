import { runtimeMaterialName } from '../domain/runtime-material';
import type { SurfaceDescriptor, SurfaceMap } from '../domain/surface-map';

export class SurfaceRegistry {
  readonly configurableSurfaces: readonly SurfaceDescriptor[];
  readonly fixedSurfaces: readonly SurfaceDescriptor[];
  private readonly byId = new Map<string, SurfaceDescriptor>();
  private readonly byRuntimeMaterialName = new Map<string, SurfaceDescriptor>();

  constructor(readonly surfaceMap: SurfaceMap) {
    for (const surface of surfaceMap.surfaces) {
      if (this.byId.has(surface.surfaceId)) {
        throw new Error(`Surface id duplicado: ${surface.surfaceId}`);
      }
      const materialName = this.runtimeMaterialName(surface);
      if (this.byRuntimeMaterialName.has(materialName)) {
        throw new Error(`Material runtime ambíguo: ${materialName}`);
      }
      this.byId.set(surface.surfaceId, surface);
      this.byRuntimeMaterialName.set(materialName, surface);
    }
    this.configurableSurfaces = Object.freeze(
      surfaceMap.surfaces.filter((surface) => surface.classification === 'configurable'),
    );
    this.fixedSurfaces = Object.freeze(
      surfaceMap.surfaces.filter((surface) => surface.classification === 'fixed'),
    );
  }

  get(surfaceId: string): SurfaceDescriptor | null {
    return this.byId.get(surfaceId) ?? null;
  }

  fromRuntimeMaterialName(materialName: string): SurfaceDescriptor | null {
    return this.byRuntimeMaterialName.get(materialName) ?? null;
  }

  runtimeMaterialName(surface: SurfaceDescriptor): string {
    return surface.binding.requiresMaterialInstance
      ? runtimeMaterialName(surface.surfaceId)
      : surface.binding.materialName;
  }
}
