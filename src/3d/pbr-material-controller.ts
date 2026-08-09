import {
  textureCacheKey,
  textureTransformForSurface,
  type PbrAssetDefinition,
  type ProductionPbrMaterial,
  type TextureTransform,
} from '../materials/pbr-material';
import { TextureCache, type TextureCacheStats, type TextureLease } from '../materials/texture-cache';
import type { MaterialAppearance } from '../materials/runtime-material';
import type {
  MaterialAppearancePort,
  PbrTexturePort,
  PbrTextureSet,
  RuntimeTextureHandle,
} from './model-viewer-adapter';
import { SurfaceRegistry } from './surface-registry';

interface ActivePbrAssignment {
  readonly materialId: string;
  readonly leases: readonly TextureLease<RuntimeTextureHandle>[];
}

interface LoadedPbrAssignment {
  readonly textures: PbrTextureSet;
  readonly leases: readonly TextureLease<RuntimeTextureHandle>[];
}

interface RuntimeMaterialState {
  readonly textures: PbrTextureSet;
  readonly appearance: MaterialAppearance;
}

type PbrRuntimePort = PbrTexturePort & MaterialAppearancePort;

export class PbrMaterialController {
  private readonly baseline = new Map<string, RuntimeMaterialState>();
  private readonly active = new Map<string, ActivePbrAssignment>();

  constructor(
    private readonly registry: SurfaceRegistry,
    private readonly port: PbrRuntimePort,
    private readonly cache = new TextureCache<RuntimeTextureHandle>(),
  ) {}

  initialize(): void {
    this.baseline.clear();
    for (const surface of this.registry.configurableSurfaces) {
      const materialName = this.registry.runtimeMaterialName(surface);
      this.baseline.set(
        surface.surfaceId,
        Object.freeze({
          textures: this.port.getTextures(materialName),
          appearance: this.port.getAppearance(materialName),
        }),
      );
    }
  }

  async apply(surfaceId: string, material: ProductionPbrMaterial): Promise<void> {
    this.assertSupportedParameters(material);
    const surface = this.requireConfigurable(surfaceId);
    const materialName = this.registry.runtimeMaterialName(surface);
    const previous = this.captureState(materialName);
    const loaded = await this.loadForSurface(surfaceId, material);
    try {
      this.port.setTextures(materialName, loaded.textures);
      this.port.setPbrFactors(materialName, material.roughnessFactor, material.metalness);
    } catch (error) {
      this.restoreState(materialName, previous);
      this.releaseLeases(loaded.leases);
      throw error;
    }

    this.releaseActive(surfaceId);
    this.active.set(
      surfaceId,
      Object.freeze({ materialId: material.id, leases: loaded.leases }),
    );
  }

  async applyAll(material: ProductionPbrMaterial): Promise<void> {
    this.assertSupportedParameters(material);
    const loaded = new Map<string, LoadedPbrAssignment>();
    try {
      for (const surface of this.registry.configurableSurfaces) {
        loaded.set(surface.surfaceId, await this.loadForSurface(surface.surfaceId, material));
      }
    } catch (error) {
      for (const assignment of loaded.values()) this.releaseLeases(assignment.leases);
      throw error;
    }

    const previous = new Map<string, RuntimeMaterialState>();
    try {
      for (const surface of this.registry.configurableSurfaces) {
        const assignment = loaded.get(surface.surfaceId);
        if (!assignment) throw new Error(`PBR preparado ausente: ${surface.surfaceId}`);
        const materialName = this.registry.runtimeMaterialName(surface);
        previous.set(surface.surfaceId, this.captureState(materialName));
        this.port.setTextures(materialName, assignment.textures);
        this.port.setPbrFactors(materialName, material.roughnessFactor, material.metalness);
      }
    } catch (error) {
      for (const surface of this.registry.configurableSurfaces) {
        const state = previous.get(surface.surfaceId);
        if (state) this.restoreState(this.registry.runtimeMaterialName(surface), state);
      }
      for (const assignment of loaded.values()) this.releaseLeases(assignment.leases);
      throw error;
    }

    for (const surface of this.registry.configurableSurfaces) {
      this.releaseActive(surface.surfaceId);
      const assignment = loaded.get(surface.surfaceId);
      if (assignment) {
        this.active.set(
          surface.surfaceId,
          Object.freeze({ materialId: material.id, leases: assignment.leases }),
        );
      }
    }
  }

  reset(surfaceId: string): void {
    const surface = this.requireConfigurable(surfaceId);
    const baseline = this.requireBaseline(surfaceId);
    this.port.setTextures(this.registry.runtimeMaterialName(surface), baseline.textures);
    this.releaseActive(surfaceId);
  }

  resetAll(): void {
    for (const surface of this.registry.configurableSurfaces) this.reset(surface.surfaceId);
    this.cache.clearUnused();
  }

  assignedMaterialId(surfaceId: string): string | null {
    return this.active.get(surfaceId)?.materialId ?? null;
  }

  cacheStats(): TextureCacheStats {
    return this.cache.stats();
  }

  dispose(): void {
    for (const surface of this.registry.configurableSurfaces) {
      if (!this.active.has(surface.surfaceId)) continue;
      const baseline = this.requireBaseline(surface.surfaceId);
      const materialName = this.registry.runtimeMaterialName(surface);
      this.restoreState(materialName, baseline);
      this.releaseActive(surface.surfaceId);
    }
    this.cache.clearUnused();
  }

  private captureState(materialName: string): RuntimeMaterialState {
    return Object.freeze({
      textures: this.port.getTextures(materialName),
      appearance: this.port.getAppearance(materialName),
    });
  }

  private restoreState(materialName: string, state: RuntimeMaterialState): void {
    this.port.setTextures(materialName, state.textures);
    this.port.setAppearance(materialName, state.appearance);
  }

  private requireBaseline(surfaceId: string): RuntimeMaterialState {
    const baseline = this.baseline.get(surfaceId);
    if (!baseline) throw new Error(`Baseline PBR ausente para ${surfaceId}`);
    return baseline;
  }

  private async loadForSurface(
    surfaceId: string,
    material: ProductionPbrMaterial,
  ): Promise<LoadedPbrAssignment> {
    const surface = this.requireConfigurable(surfaceId);
    if (!surface.textureFrame) throw new Error(`Texture frame ausente: ${surfaceId}`);
    const transform = textureTransformForSurface(surface.textureFrame, material);
    const leases: TextureLease<RuntimeTextureHandle>[] = [];
    try {
      const baseColor = await this.acquire(material.baseColor, transform);
      leases.push(baseColor);
      const normal = await this.acquire(material.normal, transform);
      leases.push(normal);
      const ambientOcclusion = await this.acquire(material.ambientOcclusion, transform);
      leases.push(ambientOcclusion);
      return Object.freeze({
        textures: Object.freeze({
          baseColor: baseColor.texture,
          normal: normal.texture,
          ambientOcclusion: ambientOcclusion.texture,
        }),
        leases: Object.freeze(leases),
      });
    } catch (error) {
      this.releaseLeases(leases);
      throw error;
    }
  }

  private acquire(asset: PbrAssetDefinition, transform: TextureTransform) {
    const key = textureCacheKey(asset, transform);
    return this.cache.acquire(key, () => this.port.createTexture(asset.uri, transform));
  }

  private releaseActive(surfaceId: string): void {
    const previous = this.active.get(surfaceId);
    if (!previous) return;
    this.releaseLeases(previous.leases);
    this.active.delete(surfaceId);
  }

  private releaseLeases(leases: readonly TextureLease<RuntimeTextureHandle>[]): void {
    for (const lease of leases) lease.release();
  }

  private assertSupportedParameters(material: ProductionPbrMaterial): void {
    if (material.normalConvention !== 'opengl') {
      throw new Error('Somente Normal OpenGL é aceita no runtime F4.');
    }
    if (material.normalStrength !== 1 || material.aoStrength !== 1) {
      throw new Error('O runtime F4 exige strength 1 para Normal e AO.');
    }
  }

  private requireConfigurable(surfaceId: string) {
    const surface = this.registry.get(surfaceId);
    if (!surface || surface.classification !== 'configurable') {
      throw new Error(`Superfície não configurável: ${surfaceId}`);
    }
    return surface;
  }
}
