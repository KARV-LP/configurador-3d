import type { TextureFrame } from '../domain/surface-map';
import type { PublicAssetIntegrity, PublicMaterial } from './public-catalog';

export interface PbrAssetDefinition extends PublicAssetIntegrity {
  readonly uri: string;
  readonly mediaType: 'image/webp';
}

export interface ProductionPbrMaterial {
  readonly id: string;
  readonly publicName: string;
  readonly physical: Readonly<{ widthM: number; heightM: number }>;
  readonly baseColor: PbrAssetDefinition;
  readonly normal: PbrAssetDefinition;
  readonly ambientOcclusion: PbrAssetDefinition;
  readonly roughnessFactor: number;
  readonly metalness: 0;
  readonly normalConvention: 'opengl';
  readonly normalStrength: number;
  readonly aoStrength: number;
}

export interface TextureTransform {
  readonly scale: Readonly<{ u: number; v: number }>;
  readonly offset: Readonly<{ u: number; v: number }>;
  readonly rotationRadians: number;
}

function pbrAsset(uri: string, integrity: PublicAssetIntegrity): PbrAssetDefinition {
  return Object.freeze({ uri, mediaType: 'image/webp', ...integrity });
}

export function toProductionPbrMaterial(material: PublicMaterial): ProductionPbrMaterial | null {
  const integrity = material.assetIntegrity;
  const pbr = material.pbr;
  const normal = material.assets.normal;
  const ao = material.assets.ao;
  if (
    !material.pbrReady ||
    !integrity ||
    !pbr ||
    pbr.status !== 'production' ||
    !normal ||
    !ao
  ) {
    return null;
  }

  return Object.freeze({
    id: material.id,
    publicName: material.name,
    physical: Object.freeze({
      widthM: material.physicalReferenceCm.width / 100,
      heightM: material.physicalReferenceCm.height / 100,
    }),
    baseColor: pbrAsset(material.assets.baseColor, integrity.baseColor),
    normal: pbrAsset(normal, integrity.normal),
    ambientOcclusion: pbrAsset(ao, integrity.ao),
    roughnessFactor: pbr.roughnessFactor,
    metalness: 0,
    normalConvention: 'opengl',
    normalStrength: pbr.normalStrength,
    aoStrength: pbr.aoStrength,
  });
}

export function textureTransformForSurface(
  frame: TextureFrame,
  material: Pick<ProductionPbrMaterial, 'physical'>,
): TextureTransform {
  const { widthM, heightM } = material.physical;
  if (widthM <= 0 || heightM <= 0 || frame.metersPerUvUnit <= 0) {
    throw new Error('Escala física PBR inválida.');
  }

  const repeatU = frame.metersPerUvUnit / widthM;
  const repeatV = frame.metersPerUvUnit / heightM;
  return Object.freeze({
    scale: Object.freeze({
      u: frame.flipU ? -repeatU : repeatU,
      v: frame.flipV ? -repeatV : repeatV,
    }),
    offset: Object.freeze({
      u: frame.flipU ? 1 : 0,
      v: frame.flipV ? 1 : 0,
    }),
    rotationRadians: (frame.rotationDegrees * Math.PI) / 180,
  });
}

export function textureCacheKey(asset: PbrAssetDefinition, transform: TextureTransform): string {
  const { scale, offset, rotationRadians } = transform;
  return [
    asset.sha256,
    scale.u.toFixed(8),
    scale.v.toFixed(8),
    offset.u.toFixed(4),
    offset.v.toFixed(4),
    rotationRadians.toFixed(8),
  ].join('|');
}
