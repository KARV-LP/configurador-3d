import type { MaterialAppearance, Rgba } from '../materials/runtime-material';

interface ScenePbrMaterial {
  readonly baseColorFactor: readonly number[];
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
  setBaseColorFactor(value: readonly [number, number, number, number]): void;
  setMetallicFactor(value: number): void;
  setRoughnessFactor(value: number): void;
}

interface SceneMaterial {
  readonly name: string;
  readonly pbrMetallicRoughness: ScenePbrMaterial;
}

interface SceneModel {
  getMaterialByName(name: string): SceneMaterial | null;
}

export interface ModelViewerElementApi extends HTMLElement {
  readonly model?: SceneModel;
  readonly loaded?: boolean;
  materialFromPoint(clientX: number, clientY: number): SceneMaterial | null;
}

export interface MaterialAppearancePort {
  materialNameAtPoint(clientX: number, clientY: number): string | null;
  getAppearance(materialName: string): MaterialAppearance;
  setAppearance(materialName: string, appearance: MaterialAppearance): void;
}

function rgba(value: readonly number[]): Rgba {
  if (value.length !== 4) {
    throw new Error('Material runtime sem baseColorFactor RGBA.');
  }
  return Object.freeze([value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? 1]) as Rgba;
}

export class ModelViewerAdapter implements MaterialAppearancePort {
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

  private getMaterial(materialName: string): SceneMaterial {
    const material = this.viewer.model?.getMaterialByName(materialName) ?? null;
    if (!material) {
      throw new Error(`Material runtime não encontrado: ${materialName}`);
    }
    return material;
  }
}
