import qualityBudgets from '../../budgets.json';
import type { PublicCatalog, PublicMaterial } from './public-catalog';

function assertAssetUrl(urlValue: string, materialId: string, catalogUrl: string): void {
  const asset = new URL(urlValue);
  const catalog = new URL(catalogUrl);
  const publicRoot = new URL('./', catalog);
  const expectedPrefix = `${publicRoot.pathname}assets/${materialId}/`;

  if (
    asset.protocol !== 'https:' ||
    asset.origin !== catalog.origin ||
    !asset.pathname.startsWith(expectedPrefix) ||
    asset.pathname !== asset.pathname.toLowerCase() ||
    decodeURIComponent(asset.pathname).includes('..')
  ) {
    throw new Error(`Asset fora do namespace público permitido: ${materialId}`);
  }
}

function assertProductionPbrBudget(material: PublicMaterial): void {
  if (!material.pbrReady) return;
  const integrity = material.assetIntegrity;
  if (!integrity) throw new Error(`Integridade PBR ausente: ${material.id}`);

  const entries = [integrity.baseColor, integrity.normal, integrity.ao];
  const [base, ...rest] = entries;
  if (!base) throw new Error(`Integridade PBR incompleta: ${material.id}`);

  for (const entry of entries) {
    if (
      entry.widthPx > qualityBudgets.materials.productionTextureMaxEdgePx ||
      entry.heightPx > qualityBudgets.materials.productionTextureMaxEdgePx ||
      entry.widthPx * entry.heightPx > qualityBudgets.materials.productionTextureMaxPixels
    ) {
      throw new Error(`Textura PBR excede budget de resolução: ${material.id}`);
    }
  }

  if (rest.some((entry) => entry.widthPx !== base.widthPx || entry.heightPx !== base.heightPx)) {
    throw new Error(`Mapas PBR com dimensões divergentes: ${material.id}`);
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > qualityBudgets.materials.productionPbrBytes) {
    throw new Error(`Material PBR excede budget de bytes: ${material.id}`);
  }
}

export function validateRuntimeCatalog(catalog: PublicCatalog, catalogUrl: string): PublicCatalog {
  const ids = catalog.materials.map((material) => material.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Biblioteca KARV contém IDs públicos duplicados.');
  }

  for (const material of catalog.materials) {
    assertAssetUrl(material.assets.preview, material.id, catalogUrl);
    assertAssetUrl(material.assets.baseColor, material.id, catalogUrl);
    if (material.assets.normal) assertAssetUrl(material.assets.normal, material.id, catalogUrl);
    if (material.assets.ao) assertAssetUrl(material.assets.ao, material.id, catalogUrl);
    assertProductionPbrBudget(material);
  }

  return catalog;
}
