import type { CustomBaseColorSource, OwnedCustomTexture } from './custom-base-color';
import {
  textureCacheKey,
  textureTransformForSurface,
  type PbrAssetDefinition,
  type ProductionPbrMaterial,
  type TextureTransform,
} from '../materials/pbr-material';
import {
  TextureCache,
  type TextureCacheStats,
  type TextureLease,
} from '../materials/texture-cache';
import type { MaterialAppearance } from '../materials/runtime-material';
import type {
  MaterialAppearancePort,
  PbrTextureBinding,
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
  private disposed = false;
  private catalogPending = 0;
  private customGeneration = 0;
  private customPending = false;
  private readonly customCache = new TextureCache<OwnedCustomTexture>(0, (owned) =>
    owned.dispose(),
  );
  private readonly customActive = new Map<string, TextureLease<OwnedCustomTexture>>();
  private readonly quarantined: TextureLease<OwnedCustomTexture>[] = [];
  private readonly baseline = new Map<string, RuntimeMaterialState>();
  private readonly baselineBaseColorTransform = new Map<string, TextureTransform>();
  private readonly active = new Map<string, ActivePbrAssignment>();

  constructor(
    private readonly registry: SurfaceRegistry,
    private readonly port: PbrRuntimePort,
    private readonly cache = new TextureCache<RuntimeTextureHandle>(),
  ) {}

  initialize(): void {
    this.disposed = false;
    this.baseline.clear();
    this.baselineBaseColorTransform.clear();
    for (const surface of this.registry.configurableSurfaces) {
      const materialName = this.registry.runtimeMaterialName(surface);
      const currentTextures = this.port.getTextures(materialName);
      const currentAppearance = this.port.getAppearance(materialName);
      if (currentTextures.baseColor) {
        this.baselineBaseColorTransform.set(surface.surfaceId, currentTextures.baseColor.transform);
      }
      const neutral = Object.freeze({
        textures: Object.freeze({ ...currentTextures, baseColor: null }),
        appearance: Object.freeze({
          ...currentAppearance,
          baseColorFactor: Object.freeze([0.72, 0.7, 0.67, 1] as const),
        }),
      });
      this.port.setTextures(materialName, neutral.textures);
      this.port.setAppearance(materialName, neutral.appearance);
      this.baseline.set(surface.surfaceId, neutral);
    }
  }

  async apply(surfaceId: string, material: ProductionPbrMaterial): Promise<void> {
    this.assertCatalogTransactionAvailable();
    this.catalogPending++;
    try {
      this.assertSupportedParameters(material);
      const surface = this.requireConfigurable(surfaceId);
      const materialName = this.registry.runtimeMaterialName(surface);
      const previous = this.captureState(materialName);
      const loaded = await this.loadForSurface(surfaceId, material);
      try {
        this.port.setTextures(materialName, loaded.textures);
        this.port.setPbrFactors(materialName, material.roughnessFactor, material.metalness);
      } catch (error) {
        let rollbackError: unknown = null;
        try {
          this.restoreState(materialName, previous);
        } catch (caught) {
          rollbackError = caught;
        } finally {
          this.releaseLeases(loaded.leases);
        }
        if (rollbackError) {
          throw new Error('Falha ao restaurar estado PBR após erro de aplicação.', {
            cause: error,
          });
        }
        throw error;
      }

      this.releaseActive(surfaceId);
      this.releaseCustom(surfaceId);
      this.active.set(surfaceId, Object.freeze({ materialId: material.id, leases: loaded.leases }));
    } finally {
      this.catalogPending--;
    }
  }

  async applyAll(material: ProductionPbrMaterial): Promise<void> {
    this.assertCatalogTransactionAvailable();
    this.catalogPending++;
    try {
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
        let rollbackError: unknown = null;
        try {
          for (const surface of this.registry.configurableSurfaces) {
            const state = previous.get(surface.surfaceId);
            if (!state) continue;
            try {
              this.restoreState(this.registry.runtimeMaterialName(surface), state);
            } catch (caught) {
              rollbackError ??= caught;
            }
          }
        } finally {
          for (const assignment of loaded.values()) this.releaseLeases(assignment.leases);
        }
        if (rollbackError) {
          throw new Error('Falha ao restaurar estado PBR após erro de aplicação global.', {
            cause: error,
          });
        }
        throw error;
      }

      for (const surface of this.registry.configurableSurfaces) {
        this.releaseActive(surface.surfaceId);
        this.releaseCustom(surface.surfaceId);
        const assignment = loaded.get(surface.surfaceId);
        if (assignment) {
          this.active.set(
            surface.surfaceId,
            Object.freeze({ materialId: material.id, leases: assignment.leases }),
          );
        }
      }
    } finally {
      this.catalogPending--;
    }
  }

  async replaceConfiguration(
    assignments: Readonly<Record<string, ProductionPbrMaterial>>,
  ): Promise<void> {
    this.assertCatalogTransactionAvailable();
    this.catalogPending++;
    try {
      for (const [surfaceId, material] of Object.entries(assignments)) {
        this.requireConfigurable(surfaceId);
        this.assertSupportedParameters(material);
      }

      const loaded = new Map<string, LoadedPbrAssignment>();
      try {
        for (const [surfaceId, material] of Object.entries(assignments)) {
          loaded.set(surfaceId, await this.loadForSurface(surfaceId, material));
        }
      } catch (error) {
        for (const assignment of loaded.values()) this.releaseLeases(assignment.leases);
        throw error;
      }

      const previous = new Map<string, RuntimeMaterialState>();
      try {
        for (const surface of this.registry.configurableSurfaces) {
          const materialName = this.registry.runtimeMaterialName(surface);
          previous.set(surface.surfaceId, this.captureState(materialName));
          const material = assignments[surface.surfaceId];
          const assignment = loaded.get(surface.surfaceId);
          if (material && assignment) {
            this.port.setTextures(materialName, assignment.textures);
            this.port.setPbrFactors(materialName, material.roughnessFactor, material.metalness);
          } else {
            this.restoreState(materialName, this.requireBaseline(surface.surfaceId));
          }
        }
      } catch (error) {
        let rollbackError: unknown = null;
        try {
          for (const surface of this.registry.configurableSurfaces) {
            const state = previous.get(surface.surfaceId);
            if (!state) continue;
            try {
              this.restoreState(this.registry.runtimeMaterialName(surface), state);
            } catch (caught) {
              rollbackError ??= caught;
            }
          }
        } finally {
          for (const assignment of loaded.values()) this.releaseLeases(assignment.leases);
        }
        if (rollbackError) {
          throw new Error('Falha ao restaurar o estado anterior da configuração PBR.', {
            cause: error,
          });
        }
        throw error;
      }

      for (const surface of this.registry.configurableSurfaces) {
        this.releaseActive(surface.surfaceId);
        this.releaseCustom(surface.surfaceId);
      }
      for (const [surfaceId, material] of Object.entries(assignments)) {
        const assignment = loaded.get(surfaceId);
        if (!assignment) continue;
        this.active.set(
          surfaceId,
          Object.freeze({ materialId: material.id, leases: assignment.leases }),
        );
      }
      this.cache.clearUnused();
    } finally {
      this.catalogPending--;
    }
  }

  /** Sua ARTE: aplica uma textura local somente na face escolhida e preserva as demais. */
  async applyCustomBaseColor(surfaceId: string, source: CustomBaseColorSource): Promise<void> {
    if (this.disposed || this.quarantined.length)
      throw new Error('Runtime custom indisponível; recrie o viewer.');
    if (this.customPending || this.catalogPending) throw new Error('Transação 3D em andamento.');

    const surface = this.requireConfigurable(surfaceId);
    this.customPending = true;
    const generation = ++this.customGeneration;
    let lease: TextureLease<OwnedCustomTexture> | null = null;
    try {
      lease = await this.customCache.acquire(`${surfaceId}:${source.cacheKey}`, source.create);
      if (generation !== this.customGeneration) throw new Error('Transação custom cancelada.');

      const materialName = this.registry.runtimeMaterialName(surface);
      const previous = this.captureState(materialName);
      const baseline = this.requireBaseline(surfaceId);
      const frame = surface.textureFrame;
      if (!frame) throw new Error('Frame UV ausente.');
      const transform =
        this.baselineBaseColorTransform.get(surfaceId) ??
        textureTransformForSurface(frame, {
          physical: { widthM: frame.metersPerUvUnit, heightM: frame.metersPerUvUnit },
        });
      const textures = Object.freeze({
        ...baseline.textures,
        baseColor: this.binding(lease.texture.texture, transform),
      });

      try {
        this.port.setTextures(materialName, textures);
        this.port.setAppearance(materialName, baseline.appearance);
      } catch (error) {
        try {
          this.restoreState(materialName, previous);
        } catch (rollbackError) {
          this.quarantined.push(lease);
          lease = null;
          throw new AggregateError(
            [error, rollbackError],
            'Falha fatal no rollback custom; recrie o viewer.',
            { cause: rollbackError },
          );
        }
        throw error;
      }

      this.releaseActive(surfaceId);
      this.releaseCustom(surfaceId);
      this.customActive.set(surfaceId, lease);
      lease = null;
      this.cache.clearUnused();
    } finally {
      lease?.release();
      this.customCache.clearUnused();
      this.customPending = false;
    }
  }

  /** F11: troca somente Base Color sobre baseline canônico; omitidas voltam ao baseline. */
  async replaceCustomBaseColors(
    assignments: Readonly<Record<string, CustomBaseColorSource>>,
  ): Promise<void> {
    if (this.disposed || this.quarantined.length)
      throw new Error('Runtime custom indisponível; recrie o viewer.');
    if (this.customPending || this.catalogPending) throw new Error('Transação 3D em andamento.');
    for (const surfaceId of Object.keys(assignments)) this.requireConfigurable(surfaceId);
    this.customPending = true;
    const generation = ++this.customGeneration;
    const loaded = new Map<string, TextureLease<OwnedCustomTexture>>();
    try {
      for (const [surfaceId, source] of Object.entries(assignments)) {
        const lease = await this.customCache.acquire(
          `${surfaceId}:${source.cacheKey}`,
          source.create,
        );
        loaded.set(surfaceId, lease);
        if (generation !== this.customGeneration) throw new Error('Transação custom cancelada.');
      }
      const previous = new Map<string, RuntimeMaterialState>();
      // Captura completa antes de tocar qualquer face.
      for (const surface of this.registry.configurableSurfaces) {
        previous.set(
          surface.surfaceId,
          this.captureState(this.registry.runtimeMaterialName(surface)),
        );
      }
      try {
        for (const surface of this.registry.configurableSurfaces) {
          const name = this.registry.runtimeMaterialName(surface);
          const baseline = this.requireBaseline(surface.surfaceId);
          const lease = loaded.get(surface.surfaceId);
          let textures = baseline.textures;
          if (lease) {
            const frame = surface.textureFrame;
            if (!frame) throw new Error('Frame UV ausente.');
            const transform =
              this.baselineBaseColorTransform.get(surface.surfaceId) ??
              textureTransformForSurface(frame, {
                physical: { widthM: frame.metersPerUvUnit, heightM: frame.metersPerUvUnit },
              });
            textures = Object.freeze({
              ...baseline.textures,
              baseColor: this.binding(lease.texture.texture, transform),
            });
          }
          this.port.setTextures(name, textures);
          this.port.setAppearance(name, baseline.appearance);
        }
      } catch (error) {
        const failures: unknown[] = [];
        for (const surface of this.registry.configurableSurfaces) {
          try {
            this.restoreState(
              this.registry.runtimeMaterialName(surface),
              previous.get(surface.surfaceId)!,
            );
          } catch (rollbackError) {
            failures.push(rollbackError);
          }
        }
        if (failures.length) {
          // Não destruir texturas que um driver com erro pode ainda estar usando.
          this.quarantined.push(...loaded.values());
          loaded.clear();
          throw new AggregateError(
            [error, ...failures],
            'Falha fatal no rollback custom; recrie o viewer.',
            { cause: error },
          );
        }
        throw error;
      }
      for (const surface of this.registry.configurableSurfaces)
        this.releaseActive(surface.surfaceId);
      for (const lease of this.customActive.values()) lease.release();
      this.customActive.clear();
      for (const [surfaceId, lease] of loaded) this.customActive.set(surfaceId, lease);
      loaded.clear();
      this.cache.clearUnused();
    } finally {
      for (const lease of loaded.values()) lease.release();
      this.customCache.clearUnused();
      this.customPending = false;
    }
  }

  customCacheStats(): TextureCacheStats {
    return this.customCache.stats();
  }

  private assertCatalogTransactionAvailable(): void {
    if (this.disposed || this.customPending || this.quarantined.length)
      throw new Error('Runtime PBR indisponível durante transação custom.');
  }

  private releaseCustom(surfaceId: string): void {
    this.customActive.get(surfaceId)?.release();
    this.customActive.delete(surfaceId);
  }

  reset(surfaceId: string): void {
    ++this.customGeneration;
    const surface = this.requireConfigurable(surfaceId);
    const baseline = this.requireBaseline(surfaceId);
    if (this.customActive.has(surfaceId))
      this.port.setAppearance(this.registry.runtimeMaterialName(surface), baseline.appearance);
    this.port.setTextures(this.registry.runtimeMaterialName(surface), baseline.textures);
    this.releaseActive(surfaceId);
    this.releaseCustom(surfaceId);
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
    this.disposed = true;
    ++this.customGeneration;
    for (const surface of this.registry.configurableSurfaces) {
      if (!this.active.has(surface.surfaceId) && !this.customActive.has(surface.surfaceId))
        continue;
      const baseline = this.requireBaseline(surface.surfaceId);
      const materialName = this.registry.runtimeMaterialName(surface);
      try {
        this.restoreState(materialName, baseline);
      } finally {
        this.releaseActive(surface.surfaceId);
        this.customActive.get(surface.surfaceId)?.release();
        this.customActive.delete(surface.surfaceId);
      }
    }
    for (const lease of this.quarantined.splice(0)) lease.release();
    this.customCache.clearUnused();
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
          baseColor: this.binding(baseColor.texture, transform),
          normal: this.binding(normal.texture, transform),
          ambientOcclusion: this.binding(ambientOcclusion.texture, transform),
        }),
        leases: Object.freeze(leases),
      });
    } catch (error) {
      this.releaseLeases(leases);
      throw error;
    }
  }

  private binding(texture: RuntimeTextureHandle, transform: TextureTransform): PbrTextureBinding {
    return Object.freeze({ texture, transform });
  }

  private acquire(asset: PbrAssetDefinition, transform: TextureTransform) {
    const key = textureCacheKey(asset, transform);
    return this.cache.acquire(key, () => this.port.createTexture(asset.uri));
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
