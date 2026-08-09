import { CANONICAL_GEOMETRY_ID, CANONICAL_GEOMETRY_VERSION } from '../domain/geometry-manifest';

export const PUBLIC_MATERIAL_CATALOG_URL =
  'https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/catalog.json';

export type MaterialChannel = 'fabric' | 'karv_design';

export interface PublicMaterial {
  readonly id: string;
  readonly channel: MaterialChannel;
  readonly name: string;
  readonly collection: string;
  readonly color: Readonly<{ name: string; family: string }>;
  readonly materialType: string;
  readonly technologies: readonly string[];
  readonly functional: Readonly<{
    petFriendly: boolean | null;
    waterRepellency: boolean | null;
    easyClean: boolean | null;
    indoorUse: boolean | null;
    outdoorUse: boolean | null;
  }>;
  readonly appearance: Readonly<{
    texture: string | null;
    touch: string | null;
    sheen: string | null;
    visualCharacter: readonly string[];
  }>;
  readonly physicalReferenceCm: Readonly<{ width: number; height: number }>;
  readonly assets: Readonly<{
    preview: string;
    baseColor: string;
    normal: string | null;
    ao: string | null;
  }>;
  readonly pbrReady: boolean;
}

export interface PublicCatalog {
  readonly channels: readonly MaterialChannel[];
  readonly materials: readonly PublicMaterial[];
  readonly rejectedCount: number;
}

type JsonRecord = Record<string, unknown>;
const MATERIAL_KEYS = new Set([
  'id',
  'channel',
  'name',
  'collection',
  'color',
  'material_type',
  'technologies',
  'functional',
  'appearance',
  'physical_reference_cm',
  'assets',
  'published',
  'ready_for_configurator',
  'pbr_ready',
  'compatibility',
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Campo inválido: ${key}`);
  return value;
}

function readNullableString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`Campo inválido: ${key}`);
  return value;
}

function readNullableBoolean(record: JsonRecord, key: string): boolean | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'boolean') throw new Error(`Campo inválido: ${key}`);
  return value;
}

function readStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Lista pública inválida.');
  }
  return Object.freeze(value.map(String));
}

function resolveAsset(record: JsonRecord, key: string, materialId: string, catalogUrl: string) {
  const value = record[key];
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !value.startsWith(`./assets/${materialId}/`) ||
    value.includes('..') ||
    /^https?:/iu.test(value)
  ) {
    throw new Error(`Asset público inválido: ${key}`);
  }
  return new URL(value, catalogUrl).href;
}

function parseMaterial(value: unknown, catalogUrl: string): PublicMaterial | null {
  if (!isRecord(value)) throw new Error('Material público inválido.');
  if (Object.keys(value).some((key) => !MATERIAL_KEYS.has(key))) {
    throw new Error('Material contém metadata fora do contrato público.');
  }
  if (value.published !== true || value.ready_for_configurator !== true) return null;

  const compatibility = value.compatibility;
  if (!isRecord(compatibility) || !Array.isArray(compatibility.geometry_ids)) return null;
  if (
    !compatibility.geometry_ids.includes(CANONICAL_GEOMETRY_ID) ||
    typeof compatibility.min_geometry_version !== 'number' ||
    compatibility.min_geometry_version > CANONICAL_GEOMETRY_VERSION
  ) {
    return null;
  }

  const id = readString(value, 'id');
  if (!/^(fabric|design)-kv-[0-9]{3,}$/u.test(id)) throw new Error('ID público inválido.');
  const channel = value.channel;
  if (channel !== 'fabric' && channel !== 'karv_design') throw new Error('Canal público inválido.');

  const color = value.color;
  const functional = value.functional;
  const appearance = value.appearance;
  const physical = value.physical_reference_cm;
  const assets = value.assets;
  if (
    !isRecord(color) ||
    !isRecord(functional) ||
    !isRecord(appearance) ||
    !isRecord(physical) ||
    !isRecord(assets)
  ) {
    throw new Error('Metadata pública incompleta.');
  }
  if (typeof physical.width !== 'number' || typeof physical.height !== 'number') {
    throw new Error('Referência física inválida.');
  }

  const preview = resolveAsset(assets, 'preview', id, catalogUrl);
  const baseColor = resolveAsset(assets, 'base_color', id, catalogUrl);
  if (!preview || !baseColor) throw new Error('Preview/Base Color obrigatórios.');
  const normal = resolveAsset(assets, 'normal', id, catalogUrl);
  const ao = resolveAsset(assets, 'ao', id, catalogUrl);
  const pbrReady = value.pbr_ready === true;
  if (pbrReady && (!normal || !ao)) throw new Error('Material PBR incompleto.');

  return Object.freeze({
    id,
    channel,
    name: readString(value, 'name'),
    collection: readString(value, 'collection'),
    color: Object.freeze({ name: readString(color, 'name'), family: readString(color, 'family') }),
    materialType: readString(value, 'material_type'),
    technologies: readStrings(value.technologies),
    functional: Object.freeze({
      petFriendly: readNullableBoolean(functional, 'pet_friendly'),
      waterRepellency: readNullableBoolean(functional, 'water_repellency'),
      easyClean: readNullableBoolean(functional, 'easy_clean'),
      indoorUse: readNullableBoolean(functional, 'indoor_use'),
      outdoorUse: readNullableBoolean(functional, 'outdoor_use'),
    }),
    appearance: Object.freeze({
      texture: readNullableString(appearance, 'texture'),
      touch: readNullableString(appearance, 'touch'),
      sheen: readNullableString(appearance, 'sheen'),
      visualCharacter: readStrings(appearance.visual_character),
    }),
    physicalReferenceCm: Object.freeze({ width: physical.width, height: physical.height }),
    assets: Object.freeze({ preview, baseColor, normal, ao }),
    pbrReady,
  });
}

export function parsePublicCatalog(
  value: unknown,
  catalogUrl = PUBLIC_MATERIAL_CATALOG_URL,
): PublicCatalog {
  if (
    !isRecord(value) ||
    value.schema !== 'karv.public-material-catalog/1' ||
    !Array.isArray(value.materials)
  ) {
    throw new Error('Contrato público da Biblioteca KARV incompatível.');
  }
  if (
    !Array.isArray(value.channels) ||
    !value.channels.includes('fabric') ||
    !value.channels.includes('karv_design')
  ) {
    throw new Error('Canais públicos da Biblioteca KARV incompletos.');
  }

  const materials: PublicMaterial[] = [];
  let rejectedCount = 0;
  for (const candidate of value.materials) {
    try {
      const parsed = parseMaterial(candidate, catalogUrl);
      if (parsed) materials.push(parsed);
      else rejectedCount += 1;
    } catch {
      rejectedCount += 1;
    }
  }

  if (materials.length === 0)
    throw new Error('Biblioteca KARV sem materiais públicos compatíveis.');
  return Object.freeze({
    channels: Object.freeze(['fabric', 'karv_design'] as const),
    materials: Object.freeze(materials),
    rejectedCount,
  });
}

export interface MaterialFilter {
  readonly channel: MaterialChannel;
  readonly colorFamily?: string;
  readonly materialType?: string;
}

export function filterMaterials(materials: readonly PublicMaterial[], filter: MaterialFilter) {
  return materials.filter(
    (material) =>
      material.channel === filter.channel &&
      (!filter.colorFamily || material.color.family === filter.colorFamily) &&
      (!filter.materialType || material.materialType === filter.materialType),
  );
}

export function listFacetValues(
  materials: readonly PublicMaterial[],
  field: 'color' | 'materialType',
) {
  const values = materials.map((material) =>
    field === 'color' ? material.color.family : material.materialType,
  );
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
