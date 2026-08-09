import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import type {
  PbrAssetDefinition,
  ProductionPbrMaterial,
  TextureTransform,
} from '../materials/pbr-material';
import type { MaterialAppearance, Rgba } from '../materials/runtime-material';
import type {
  MaterialAppearancePort,
  PbrTexturePort,
  PbrTextureSet,
  RuntimeTextureHandle,
} from './model-viewer-adapter';
import { PbrMaterialController } from './pbr-material-controller';
import { SurfaceRegistry } from './surface-registry';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const registry = new SurfaceRegistry(parseSurfaceMap(surfaceMapJson, manifest));
const BASELINE_APPEARANCE: MaterialAppearance = Object.freeze({
  baseColorFactor: Object.freeze([0.7, 0.7, 0.7, 1]) as Rgba,
  metallicFactor: 0,
  roughnessFactor: 0.8,
});

class FakeTexture implements RuntimeTextureHandle {
  readonly sampler = {
    setScale: () => undefined,
    setOffset: () => undefined,
    setRotation: () => undefined,
  };

  constructor(
    readonly uri: string,
    readonly transform: TextureTransform,
  ) {}
}

class FakePbrPort implements PbrTexturePort, MaterialAppearancePort {
  readonly textures = new Map<string, PbrTextureSet>();
  readonly appearances = new Map<string, MaterialAppearance>();
  creates = 0;
  failNextTextureMaterialName: string | null = null;

  constructor() {
    for (const surface of registry.configurableSurfaces) {
      this.appearances.set(registry.runtimeMaterialName(surface), BASELINE_APPEARANCE);
    }
  }

  materialNameAtPoint(): string | null {
    return null;
  }

  getAppearance(materialName: string): MaterialAppearance {
    return this.appearances.get(materialName) ?? BASELINE_APPEARANCE;
  }

  setAppearance(materialName: string, appearance: MaterialAppearance): void {
    this.appearances.set(materialName, appearance);
  }

  async createTexture(uri: string, transform: TextureTransform): Promise<RuntimeTextureHandle> {
    this.creates += 1;
    return new FakeTexture(uri, transform);
  }

  getTextures(materialName: string): PbrTextureSet {
    return (
      this.textures.get(materialName) ??
      Object.freeze({ baseColor: null, normal: null, ambientOcclusion: null })
    );
  }

  setTextures(materialName: string, textures: PbrTextureSet): void {
    if (this.failNextTextureMaterialName === materialName) {
      this.failNextTextureMaterialName = null;
      throw new Error('Falha de textura simulada.');
    }
    this.textures.set(materialName, textures);
  }

  setPbrFactors(materialName: string, roughnessFactor: number, metalness: 0): void {
    this.appearances.set(
      materialName,
      Object.freeze({
        baseColorFactor: Object.freeze([1, 1, 1, 1]) as Rgba,
        metallicFactor: metalness,
        roughnessFactor,
      }),
    );
  }
}

function fakeSha(seed: string, channel: string): string {
  const signature = `${seed}-${channel}`;
  const hex = [...signature]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return hex.repeat(Math.ceil(64 / hex.length)).slice(0, 64);
}

function asset(seed: string, channel: string): PbrAssetDefinition {
  return Object.freeze({
    uri: `https://example.test/${seed}/${channel}.webp`,
    mediaType: 'image/webp',
    sha256: fakeSha(seed, channel),
    widthPx: 2048,
    heightPx: 1024,
    bytes: 1000,
  });
}

function material(seed: string): ProductionPbrMaterial {
  return Object.freeze({
    id: `fabric-${seed}`,
    publicName: `Material ${seed}`,
    physical: Object.freeze({ widthM: 1.2, heightM: 0.6 }),
    baseColor: asset(seed, 'base'),
    normal: asset(seed, 'normal'),
    ambientOcclusion: asset(seed, 'ao'),
    roughnessFactor: 0.88,
    metalness: 0,
    normalConvention: 'opengl',
    normalStrength: 1,
    aoStrength: 1,
  });
}

describe('PbrMaterialController', () => {
  it('aplica Base Color + Normal + AO com roughness e reutiliza cache na mesma superfície', async () => {
    const port = new FakePbrPort();
    const controller = new PbrMaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície.');

    await controller.apply(surface.surfaceId, material('a'));
    expect(port.creates).toBe(3);
    expect(port.getAppearance(registry.runtimeMaterialName(surface))).toMatchObject({
      roughnessFactor: 0.88,
      metallicFactor: 0,
    });

    await controller.apply(surface.surfaceId, material('a'));
    expect(port.creates).toBe(3);
    expect(controller.cacheStats()).toMatchObject({ active: 3, hits: 3, misses: 3 });
  });

  it('mantém trocas repetidas limitadas a 3 ativos + 6 ociosos e restaura no dispose', async () => {
    const port = new FakePbrPort();
    const controller = new PbrMaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície.');
    const materialName = registry.runtimeMaterialName(surface);

    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await controller.apply(surface.surfaceId, material(seed));
    }

    expect(controller.cacheStats().active).toBe(3);
    expect(controller.cacheStats().idle).toBeLessThanOrEqual(6);
    expect(controller.cacheStats().entries).toBeLessThanOrEqual(9);

    controller.dispose();
    expect(controller.cacheStats()).toMatchObject({ entries: 0, active: 0, idle: 0 });
    expect(port.textures.get(materialName)).toEqual({
      baseColor: null,
      normal: null,
      ambientOcclusion: null,
    });
    expect(port.getAppearance(materialName)).toBe(BASELINE_APPEARANCE);
  });

  it('restaura o baseline PBR no reset', async () => {
    const port = new FakePbrPort();
    const controller = new PbrMaterialController(registry, port);
    controller.initialize();
    const surface = registry.configurableSurfaces[0];
    if (!surface) throw new Error('Fixture sem superfície.');
    const materialName = registry.runtimeMaterialName(surface);

    await controller.apply(surface.surfaceId, material('a'));
    expect(port.textures.get(materialName)?.baseColor).not.toBeNull();
    controller.reset(surface.surfaceId);
    expect(port.textures.get(materialName)).toEqual({
      baseColor: null,
      normal: null,
      ambientOcclusion: null,
    });
  });

  it('faz rollback atômico se apply-all falhar em uma superfície', async () => {
    const port = new FakePbrPort();
    const controller = new PbrMaterialController(registry, port);
    controller.initialize();
    const first = registry.configurableSurfaces[0];
    const second = registry.configurableSurfaces[1];
    if (!first || !second) throw new Error('Fixture insuficiente.');
    port.failNextTextureMaterialName = registry.runtimeMaterialName(second);

    await expect(controller.applyAll(material('a'))).rejects.toThrow('Falha de textura simulada.');

    expect(port.textures.get(registry.runtimeMaterialName(first))).toEqual({
      baseColor: null,
      normal: null,
      ambientOcclusion: null,
    });
    expect(port.getAppearance(registry.runtimeMaterialName(first))).toBe(BASELINE_APPEARANCE);
    expect(controller.cacheStats().active).toBe(0);
  });
});
