import type { TextureTransform } from '../materials/pbr-material';
import type { MaterialAppearance, Rgba } from '../materials/runtime-material';

interface SceneSampler {
  readonly scale: Readonly<{ u: number; v: number }> | null;
  readonly offset: Readonly<{ u: number; v: number }> | null;
  readonly rotation: number | null;
  setScale(value: Readonly<{ u: number; v: number }> | null): void;
  setOffset(value: Readonly<{ u: number; v: number }> | null): void;
  setRotation(value: number | null): void;
}

export interface RuntimeTextureHandle {
  readonly sampler: SceneSampler;
}

interface SceneTextureInfo {
  readonly texture: RuntimeTextureHandle | null;
  setTexture(texture: RuntimeTextureHandle | null): void;
}

interface ScenePbrMaterial {
  readonly baseColorFactor: readonly number[];
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
  readonly baseColorTexture: SceneTextureInfo | null;
  setBaseColorFactor(value: readonly [number, number, number, number]): void;
  setMetallicFactor(value: number): void;
  setRoughnessFactor(value: number): void;
}

interface SceneMaterial {
  readonly name: string;
  readonly pbrMetallicRoughness: ScenePbrMaterial;
  readonly normalTexture: SceneTextureInfo | null;
  readonly occlusionTexture: SceneTextureInfo | null;
}

interface SceneModel {
  getMaterialByName(name: string): SceneMaterial | null;
}

export interface ModelViewerElementApi extends HTMLElement {
  readonly model?: SceneModel;
  readonly loaded?: boolean;
  materialFromPoint(clientX: number, clientY: number): SceneMaterial | null;
  createTexture(
    uri: string,
    type?: 'image/png' | 'image/jpeg' | 'image/webp',
  ): Promise<RuntimeTextureHandle>;
}

export interface MaterialAppearancePort {
  materialNameAtPoint(clientX: number, clientY: number): string | null;
  getAppearance(materialName: string): MaterialAppearance;
  setAppearance(materialName: string, appearance: MaterialAppearance): void;
  getBaseColorFactor(materialName: string): Rgba;
  setBaseColorFactor(materialName: string, factor: Rgba): void;
}

export interface PbrTextureBinding {
  readonly texture: RuntimeTextureHandle;
  readonly transform: TextureTransform;
}

export interface PbrTextureSet {
  readonly baseColor: PbrTextureBinding | null;
  readonly normal: PbrTextureBinding | null;
  readonly ambientOcclusion: PbrTextureBinding | null;
}

export interface PbrTexturePort {
  createTexture(uri: string): Promise<RuntimeTextureHandle>;
  getTextures(materialName: string): PbrTextureSet;
  setTextures(materialName: string, textures: PbrTextureSet): void;
  setPbrFactors(materialName: string, roughnessFactor: number, metalness: 0): void;
}

function rgba(value: readonly number[]): Rgba {
  if (value.length !== 4) {
    throw new Error('Material runtime sem baseColorFactor RGBA.');
  }
  return Object.freeze([value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? 1]) as Rgba;
}

function samplerTransform(sampler: SceneSampler): TextureTransform {
  const scale = sampler.scale ?? { u: 1, v: 1 };
  const offset = sampler.offset ?? { u: 0, v: 0 };
  return Object.freeze({
    scale: Object.freeze({ u: scale.u, v: scale.v }),
    offset: Object.freeze({ u: offset.u, v: offset.v }),
    rotationRadians: sampler.rotation ?? 0,
  });
}

function textureBinding(texture: RuntimeTextureHandle | null): PbrTextureBinding | null {
  if (!texture) return null;
  return Object.freeze({ texture, transform: samplerTransform(texture.sampler) });
}

export class ModelViewerAdapter implements MaterialAppearancePort, PbrTexturePort {
  constructor(private readonly viewer: ModelViewerElementApi) {}

  materialNameAtPoint(clientX: number, clientY: number): string | null {
    return this.viewer.materialFromPoint(clientX, clientY)?.name ?? null;
  }

  getAppearance(materialName: string): MaterialAppearance {
    const pbr = this.getMaterial(materialName).pbrMetallicRoughness;
    return Object.freeze({
      baseColorFactor: rgba(pbr.baseColorFactor),
      metallicFactor: pbr.metallicFactor,
      roughnessFactor: pbr.roughnessFactor,
    });
  }

  setAppearance(materialName: string, appearance: MaterialAppearance): void {
    const pbr = this.getMaterial(materialName).pbrMetallicRoughness;
    pbr.setBaseColorFactor(appearance.baseColorFactor);
    pbr.setMetallicFactor(appearance.metallicFactor);
    pbr.setRoughnessFactor(appearance.roughnessFactor);
  }

  getBaseColorFactor(materialName: string): Rgba {
    return rgba(this.getMaterial(materialName).pbrMetallicRoughness.baseColorFactor);
  }

  setBaseColorFactor(materialName: string, factor: Rgba): void {
    this.getMaterial(materialName).pbrMetallicRoughness.setBaseColorFactor(factor);
  }

  createTexture(uri: string): Promise<RuntimeTextureHandle> {
    return this.viewer.createTexture(uri, 'image/webp');
  }

  getTextures(materialName: string): PbrTextureSet {
    const material = this.getMaterial(materialName);
    return Object.freeze({
      baseColor: textureBinding(material.pbrMetallicRoughness.baseColorTexture?.texture ?? null),
      normal: textureBinding(material.normalTexture?.texture ?? null),
      ambientOcclusion: textureBinding(material.occlusionTexture?.texture ?? null),
    });
  }

  setTextures(materialName: string, textures: PbrTextureSet): void {
    const material = this.getMaterial(materialName);
    this.setTextureInfo(
      material.pbrMetallicRoughness.baseColorTexture,
      textures.baseColor,
      'Base Color',
    );
    this.setTextureInfo(material.normalTexture, textures.normal, 'Normal');
    this.setTextureInfo(material.occlusionTexture, textures.ambientOcclusion, 'AO');
  }

  setPbrFactors(materialName: string, roughnessFactor: number, metalness: 0): void {
    const pbr = this.getMaterial(materialName).pbrMetallicRoughness;
    pbr.setBaseColorFactor([1, 1, 1, 1]);
    pbr.setMetallicFactor(metalness);
    pbr.setRoughnessFactor(roughnessFactor);
  }

  private setTextureInfo(
    info: SceneTextureInfo | null,
    binding: PbrTextureBinding | null,
    channel: string,
  ): void {
    if (!info) {
      if (binding) throw new Error(`Canal PBR indisponível no GLB: ${channel}`);
      return;
    }

    info.setTexture(binding?.texture ?? null);
    if (!binding) return;

    // model-viewer 4.3.1 TextureInfo.setTexture() reaplica o transform armazenado
    // pelo slot do material sobre a textura anexada. O transform físico precisa
    // portanto ser aplicado no sampler depois do binding.
    const sampler = info.texture?.sampler ?? binding.texture.sampler;
    sampler.setScale(binding.transform.scale);
    sampler.setOffset(binding.transform.offset);
    sampler.setRotation(binding.transform.rotationRadians);
  }

  private getMaterial(materialName: string): SceneMaterial {
    const material = this.viewer.model?.getMaterialByName(materialName) ?? null;
    if (!material) {
      throw new Error(`Material runtime não encontrado: ${materialName}`);
    }
    return material;
  }
}
