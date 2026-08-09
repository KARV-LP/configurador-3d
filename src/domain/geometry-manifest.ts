export const CANONICAL_GEOMETRY_ID = 'karv-chair';
export const CANONICAL_GEOMETRY_VERSION = 2;

export interface CanonicalGeometryManifest {
  readonly schema: 'karv.geometry.manifest/1';
  readonly geometryId: typeof CANONICAL_GEOMETRY_ID;
  readonly geometryVersion: typeof CANONICAL_GEOMETRY_VERSION;
  readonly assetFile: 'base.glb';
  readonly byteLength: number;
  readonly sha256: string;
  readonly requiredExtensions: readonly string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Manifesto canônico inválido: ${key}.`);
  }
  return value;
}

function readPositiveInteger(record: JsonRecord, key: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Manifesto canônico inválido: ${key}.`);
  }
  return Number(value);
}

export function parseCanonicalGeometryManifest(value: unknown): CanonicalGeometryManifest {
  if (!isRecord(value) || !isRecord(value.asset)) {
    throw new Error('Manifesto canônico inválido.');
  }

  const schema = readString(value, 'schema');
  const geometryId = readString(value, 'geometry_id');
  const geometryVersion = readPositiveInteger(value, 'geometry_version');
  const assetFile = readString(value.asset, 'file');
  const byteLength = readPositiveInteger(value.asset, 'byte_length');
  const sha256 = readString(value.asset, 'sha256');
  const extensions = value.asset.required_extensions;

  if (schema !== 'karv.geometry.manifest/1') {
    throw new Error('Versão do manifesto canônico incompatível.');
  }
  if (geometryId !== CANONICAL_GEOMETRY_ID || geometryVersion !== CANONICAL_GEOMETRY_VERSION) {
    throw new Error('Geometria canônica incompatível.');
  }
  if (assetFile !== 'base.glb' || !/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new Error('Asset canônico inválido.');
  }
  if (!Array.isArray(extensions) || !extensions.includes('KHR_draco_mesh_compression')) {
    throw new Error('Extensão de compressão canônica ausente.');
  }

  return Object.freeze({
    schema,
    geometryId,
    geometryVersion,
    assetFile,
    byteLength,
    sha256,
    requiredExtensions: Object.freeze(extensions.map(String)),
  });
}
