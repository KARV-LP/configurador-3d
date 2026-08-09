import type {
  MaterialAppearance,
  Rgba,
  RuntimeMaterialDefinition,
} from '../materials/runtime-material';
import type { MaterialAppearancePort, MaterialHighlightPort } from './model-viewer-adapter';
import { SurfaceRegistry } from './surface-registry';

const HIGHLIGHT_FACTOR = Object.freeze([1, 0.62, 0.16, 1]) as Rgba;

type MaterialRuntimePort = MaterialAppearancePort & MaterialHighlightPort;

export class MaterialController {
  private readonly baseline = new Map<string, MaterialAppearance>();
  private highlightedSurfaceId: string | null = null;
  private highlightedBaseColor: Rgba | null = null;

  constructor(
    private readonly registry: SurfaceRegistry,
    private readonly port: MaterialRuntimePort,
  ) {}

  initialize(): void {
    this.baseline.clear();
    for (const surface of this.registry.configurableSurfaces) {
      const materialName = this.registry.runtimeMaterialName(surface);
      this.baseline.set(surface.surfaceId, this.port.getAppearance(materialName));
    }
  }

  apply(surfaceId: string, material: RuntimeMaterialDefinition): void {
    const surface = this.requireConfigurable(surfaceId);
    this.port.setAppearance(this.registry.runtimeMaterialName(surface), material.appearance);
  }

  applyAll(material: RuntimeMaterialDefinition): void {
    for (const surface of this.registry.configurableSurfaces) {
      this.port.setAppearance(this.registry.runtimeMaterialName(surface), material.appearance);
    }
  }

  reset(surfaceId: string): void {
    const surface = this.requireConfigurable(surfaceId);
    const baseline = this.baseline.get(surfaceId);
    if (!baseline) throw new Error(`Baseline ausente para ${surfaceId}`);
    this.port.setAppearance(this.registry.runtimeMaterialName(surface), baseline);
  }

  resetAll(): void {
    for (const surface of this.registry.configurableSurfaces) {
      this.reset(surface.surfaceId);
    }
  }

  highlight(surfaceId: string): void {
    this.clearHighlight();
    const surface = this.requireConfigurable(surfaceId);
    const materialName = this.registry.runtimeMaterialName(surface);
    const currentBaseColor = this.port.getBaseColorFactor(materialName);
    const highlightColor = Object.freeze([
      HIGHLIGHT_FACTOR[0],
      HIGHLIGHT_FACTOR[1],
      HIGHLIGHT_FACTOR[2],
      currentBaseColor[3],
    ]) as Rgba;
    this.highlightedSurfaceId = surfaceId;
    this.highlightedBaseColor = currentBaseColor;
    this.port.setBaseColorFactor(materialName, highlightColor);
  }

  clearHighlight(): void {
    if (!this.highlightedSurfaceId || !this.highlightedBaseColor) return;
    const surface = this.requireConfigurable(this.highlightedSurfaceId);
    this.port.setBaseColorFactor(
      this.registry.runtimeMaterialName(surface),
      this.highlightedBaseColor,
    );
    this.highlightedSurfaceId = null;
    this.highlightedBaseColor = null;
  }

  private requireConfigurable(surfaceId: string) {
    const surface = this.registry.get(surfaceId);
    if (!surface || surface.classification !== 'configurable') {
      throw new Error(`Superfície não configurável: ${surfaceId}`);
    }
    return surface;
  }
}
