import { CANONICAL_GEOMETRY_ID, CANONICAL_GEOMETRY_VERSION } from '../domain/geometry-manifest';

const MATERIAL_LIBRARY_PROXY_PATH = '/karv-material-library/catalog.json';

export const PUBLIC_MATERIAL_CATALOG_URL =
  typeof globalThis.location?.origin === 'string' && /^https?:/u.test(globalThis.location.origin)
    ? `${globalThis.location.origin}${MATERIAL_LIBRARY_PROXY_PATH}`
    : 'https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/catalog.json';

export type MaterialChannel = 'fabric' | 'karv_design';

export interface PublicAssetIntegrity {
  readonly sha256: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bytes: number;
}

export interface PublicFaceAsset extends PublicAssetIntegrity {
  readonly uri: string;
  readonly mediaType: 'image/webp' | 'image/png';
}

export interface PublicFacePbrAssets {
  readonly baseColor: PublicFaceAsset;
  readonly normal: PublicFaceAsset;
  readonly ambientOcclusion: PublicFaceAsset;
}

export interface PublicPbrParameters {
  readonly status: 'preview' | 'production';
  readonly roughnessFactor: number;
  readonly metalness: 0;
  readonly normalConvention: 'opengl';
  readonly normalStrength: number;
  readonly aoStrength: number;
}

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
  readonly assetIntegrity: Readonly<{
    baseColor: PublicAssetIntegrity;
    normal: PublicAssetIntegrity;
    ao: PublicAssetIntegrity;
  }> | null;
  readonly pbr: PublicPbrParameters | null;
  readonly pbrReady: boolean;
  readonly faceSetMetadataUrl?: string | null;
  readonly faceAssets?: Readonly<Record<string, PublicFacePbrAssets>> | null;
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
  'asset_integrity',
  'pbr',
  'published',
  'ready_for_configurator',
  'pbr_ready',
  'compatibility',
  'face_set',
]);

const FACE_SET_KEYS = new Set([
  'seat',
  'backrest-front',
  'backrest-side',
  'backrest-rear',
  'side-outer',
  'side-inner',
  'side-rear',
  'side-top',
  'piping',
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

function readNumber(record: JsonRecord, key: string, min: number, max: number): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Campo numérico inválido: ${key}`);
  }
  return value;
}

function readPositiveInteger(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Campo inteiro inválido: ${key}`);
  }
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

function parseIntegrityEntry(value: unknown): PublicAssetIntegrity {
  if (!isRecord(value)) throw new Error('Integridade de asset inválida.');
  const sha256 = readString(value, 'sha256');
  if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new Error('SHA-256 público inválido.');
  return Object.freeze({
    sha256,
    widthPx: readPositiveInteger(value, 'width_px'),
    heightPx: readPositiveInteger(value, 'height_px'),
    bytes: readPositiveInteger(value, 'bytes'),
  });
}

function parseFaceAsset(
  value: unknown,
  expectedMediaType: PublicFaceAsset['mediaType'],
  metadataUrl: string,
): PublicFaceAsset {
  if (!isRecord(value)) throw new Error('Asset de face inválido.');
  const uri = readString(value, 'uri');
  const mediaType = readString(value, 'media_type');
  if (mediaType !== expectedMediaType || !uri.startsWith('./') || uri.includes('..')) {
    throw new Error('Formato ou URI de face inválido.');
  }
  const resolved = new URL(uri, metadataUrl);
  if (!resolved.href.startsWith(new URL('./', metadataUrl).href)) {
    throw new Error('Asset de face fora do namespace do tecido.');
  }
  return Object.freeze({ uri: resolved.href, mediaType, ...parseIntegrityEntry(value) });
}

export function attachFabricFaceSet(material: PublicMaterial, value: unknown): PublicMaterial {
  const metadataUrl = material.faceSetMetadataUrl;
  if (!metadataUrl) return material;
  if (
    !isRecord(value) ||
    value.schema !== 'karv.fabric-face-set/1' ||
    value.fabric_id !== material.id ||
    value.face_count !== 9 ||
    value.map_count !== 27 ||
    !isRecord(value.faces)
  ) {
    throw new Error(`Face set inválido para ${material.id}.`);
  }
  if (
    Object.keys(value.faces).length !== FACE_SET_KEYS.size ||
    Object.keys(value.faces).some((key) => !FACE_SET_KEYS.has(key))
  ) {
    throw new Error(`Faces oficiais incompletas para ${material.id}.`);
  }

  const bySurface: Record<string, PublicFacePbrAssets> = {};
  for (const face of Object.values(value.faces)) {
    if (!isRecord(face) || !Array.isArray(face.surface_ids) || face.surface_ids.length === 0) {
      throw new Error(`Vínculo de superfície inválido para ${material.id}.`);
    }
    const baseColor = parseFaceAsset(face.base_color, 'image/webp', metadataUrl);
    const normal = parseFaceAsset(face.normal, 'image/png', metadataUrl);
    const ambientOcclusion = parseFaceAsset(face.ambient_occlusion, 'image/webp', metadataUrl);
    if (
      [normal, ambientOcclusion].some(
        (asset) => asset.widthPx !== baseColor.widthPx || asset.heightPx !== baseColor.heightPx,
      )
    ) {
      throw new Error(`Mapas desalinhados para ${material.id}.`);
    }
    const assets = Object.freeze({ baseColor, normal, ambientOcclusion });
    for (const surfaceId of face.surface_ids) {
      if (typeof surfaceId !== 'string' || bySurface[surfaceId]) {
        throw new Error(`Superfície duplicada ou inválida para ${material.id}.`);
      }
      bySurface[surfaceId] = assets;
    }
  }
  return Object.freeze({ ...material, faceAssets: Object.freeze(bySurface) });
}

function parseAssetIntegrity(value: unknown) {
  if (!isRecord(value)) throw new Error('Integridade PBR ausente.');
  return Object.freeze({
    baseColor: parseIntegrityEntry(value.base_color),
    normal: parseIntegrityEntry(value.normal),
    ao: parseIntegrityEntry(value.ao),
  });
}

function parsePbr(value: unknown): PublicPbrParameters {
  if (!isRecord(value)) throw new Error('Parâmetros PBR ausentes.');
  const status = value.status;
  if (status !== 'preview' && status !== 'production') throw new Error('Status PBR inválido.');
  if (value.metalness !== 0) throw new Error('Metalness de tecido deve ser zero.');
  if (value.normal_convention !== 'opengl') throw new Error('Convenção Normal incompatível.');
  return Object.freeze({
    status,
    roughnessFactor: readNumber(value, 'roughness_factor', 0, 1),
    metalness: 0,
    normalConvention: 'opengl',
    normalStrength: readNumber(value, 'normal_strength', 0, 2),
    aoStrength: readNumber(value, 'ao_strength', 0, 1),
  });
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
  if (
    typeof physical.width !== 'number' ||
    physical.width <= 0 ||
    typeof physical.height !== 'number' ||
    physical.height <= 0
  ) {
    throw new Error('Referência física inválida.');
  }

  const preview = resolveAsset(assets, 'preview', id, catalogUrl);
  const baseColor = resolveAsset(assets, 'base_color', id, catalogUrl);
  if (!preview || !baseColor) throw new Error('Preview/Base Color obrigatórios.');
  const normal = resolveAsset(assets, 'normal', id, catalogUrl);
  const ao = resolveAsset(assets, 'ao', id, catalogUrl);
  const faceSetMetadataUrl =
    value.face_set === undefined
      ? null
      : resolveAsset({ face_set: value.face_set }, 'face_set', id, catalogUrl);
  const pbrReady = value.pbr_ready === true;
  let pbr: PublicPbrParameters | null = null;
  let assetIntegrity: PublicMaterial['assetIntegrity'] = null;
  if (value.pbr !== undefined) pbr = parsePbr(value.pbr);
  if (value.asset_integrity !== undefined)
    assetIntegrity = parseAssetIntegrity(value.asset_integrity);
  if (pbrReady) {
    if (!normal || !ao || !pbr || pbr.status !== 'production' || !assetIntegrity) {
      throw new Error('Material PBR de produção incompleto.');
    }
  }

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
    assetIntegrity,
    pbr,
    pbrReady,
    faceSetMetadataUrl,
    faceAssets: null,
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
