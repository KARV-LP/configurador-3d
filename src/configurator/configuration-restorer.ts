import { toProductionPbrMaterial, type ProductionPbrMaterial } from '../materials/pbr-material';
import type { PublicMaterial } from '../materials/public-catalog';
import type { SerializedConfigurationV1 } from './config-serializer';

export class ConfigurationRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationRestoreError';
  }
}

export function resolveConfigurationMaterials(
  payload: SerializedConfigurationV1,
  materials: readonly PublicMaterial[],
): Readonly<Record<string, ProductionPbrMaterial>> {
  const catalog = new Map(materials.map((material) => [material.id, material]));
  const resolved: Record<string, ProductionPbrMaterial> = {};

  for (const [surfaceId, materialId] of Object.entries(payload.assignments)) {
    const material = catalog.get(materialId);
    if (!material) throw new ConfigurationRestoreError(`Material indisponível: ${materialId}`);
    const productionMaterial = toProductionPbrMaterial(material);
    if (!productionMaterial) {
      throw new ConfigurationRestoreError(`Material sem acabamento 3D disponível: ${materialId}`);
    }
    resolved[surfaceId] = productionMaterial;
  }

  return Object.freeze(resolved);
}
