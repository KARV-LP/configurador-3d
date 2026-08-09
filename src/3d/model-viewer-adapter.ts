import type { TextureTransform } from '../materials/pbr-material';
import type { MaterialAppearance, Rgba } from '../materials/runtime-material';

interface SceneSampler {
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
  createTexture(uri: string, type?: 'image/png' | 'image/jpeg' | 'image/webp'): Promise<RuntimeTextureHandle>;
}

export interface MaterialAppearancePort {
  materialNameAtPoint(clientX: number, clientY: number): string | null;
  getAppearance(materialName: string): MaterialAppearance;
  setAppearance(materialName: string, appearance: MaterialAppearance): void;
}

export interface PbrTextureSet {
  readonly baseColor: RuntimeTextureHandle | null;
  readonly normal: RuntimeTextureHandle | null;
  readonly ambientOcclusion: RuntimeTextureHandle | null;
}

export interface PbrTexturePort {
  createTexture(uri: string, transform: TextureTransform): Promise<RuntimeTextureHandle>;
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

  async createTexture(uri: string, transform: TextureTransform): Promise<RuntimeTextureHandle> {
    const texture = await this.viewer.createTexture(uri, 'image/webp');
    texture.sampler.setScale(transform.scale);
    texture.sampler.setOffset(transform.offset);
    texture.sampler.setRotation(transform.rotationRadians);
    return texture;
  }

  getTextures(materialName: string): PbrTextureSet {
    const material = this.getMaterial(materialName);
    return Object.freeze({
      baseColor: material.pbrMetallicRoughness.baseColorTexture?.texture ?? null,
      normal: material.normalTexture?.texture ?? null,
      ambientOcclusion: material.occlusionTexture?.texture ?? null,
    });
  }

  setTextures(materialName: string, textures: PbrTextureSet): void {
    const material = this.getMaterial(materialName);
    this.setTextureInfo(material.pbrMetallicRoughness.baseColorTexture, textures.baseColor, 'Base Color');
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
    texture: RuntimeTextureHandle | null,
    channel: string,
  ): void {
    if (!info) {
      if (texture) throw new Error(`Canal PBR indisponível no GLB: ${channel}`);
      return;
    }
    info.setTexture(texture);
  }

  private getMaterial(materialName: string): SceneMaterial {
    const material = this.viewer.model?.getMaterialByName(materialName) ?? null;
    if (!material) {
      throw new Error(`Material runtime não encontrado: ${materialName}`);
    }
    return material;
  }
}
