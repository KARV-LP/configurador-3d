import type { CanonicalGeometryManifest } from '../domain/geometry-manifest';
import type { CoreConfigurationSnapshot } from './configuration-store';

export const CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const CONFIGURATION_SCHEMA_ID =
  'https://schemas.k-arv.com/configurador-3d/v1/configuration.schema.json';
export const CONFIGURATION_QUERY_PARAM = 'config';

const MAX_SERIALIZED_BYTES = 16_384;
const MAX_TOKEN_LENGTH = 24_000;
const CANONICAL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const MATERIAL_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const ROOT_KEYS = new Set([
  '$schema',
  'schema_version',
  'configuration_id',
  'geometry',
  'assignments',
  'created_at',
]);
const GEOMETRY_KEYS = new Set(['id', 'version', 'sha256']);

export type ConfigurationValidationCode =
  | 'empty-configuration'
  | 'invalid-payload'
  | 'unsupported-schema'
  | 'incompatible-geometry'
  | 'unknown-surface'
  | 'invalid-material-id'
  | 'corrupted-token';

export class ConfigurationValidationError extends Error {
  constructor(
    readonly code: ConfigurationValidationCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ConfigurationValidationError';
  }
}

export interface SerializedConfigurationV1 {
  readonly $schema?: string;
  readonly schema_version: typeof CONFIGURATION_SCHEMA_VERSION;
  readonly configuration_id?: string;
  readonly geometry: Readonly<{
    id: string;
    version: number;
    sha256: string;
  }>;
  readonly assignments: Readonly<Record<string, string>>;
  readonly created_at?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(code: ConfigurationValidationCode, message: string): never {
  throw new ConfigurationValidationError(code, message);
}

function assertOnlyKeys(record: JsonRecord, allowed: ReadonlySet<string>, label: string): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    fail('invalid-payload', `${label} contém campos fora do contrato público.`);
  }
}

function orderedAssignments(
  assignments: Readonly<Record<string, string | null>>,
): Readonly<Record<string, string>> {
  const entries = Object.entries(assignments)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.freeze(Object.fromEntries(entries));
}

function encodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeUtf8(token: string): string {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/u.test(token)) {
    fail('corrupted-token', 'Token de configuração inválido.');
  }
  if (token.length % 4 === 1) fail('corrupted-token', 'Token de configuração truncado.');

  try {
    const base64 = token.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new ConfigurationValidationError('corrupted-token', 'Token de configuração corrompido.', {
      cause: error,
    });
  }
}

export class ConfigSerializer {
  private readonly knownSurfaceIds: ReadonlySet<string>;

  constructor(
    private readonly geometry: CanonicalGeometryManifest,
    surfaceIds: readonly string[],
  ) {
    this.knownSurfaceIds = new Set(surfaceIds);
  }

  toPayload(snapshot: CoreConfigurationSnapshot): SerializedConfigurationV1 {
    const assignments = orderedAssignments(snapshot.assignments);
    if (Object.keys(assignments).length === 0) {
      fail('empty-configuration', 'Não há áreas configuradas para serializar.');
    }

    return Object.freeze({
      $schema: CONFIGURATION_SCHEMA_ID,
      schema_version: CONFIGURATION_SCHEMA_VERSION,
      geometry: Object.freeze({
        id: this.geometry.geometryId,
        version: this.geometry.geometryVersion,
        sha256: this.geometry.sha256,
      }),
      assignments,
    });
  }

  serialize(snapshot: CoreConfigurationSnapshot): string {
    return JSON.stringify(this.toPayload(snapshot));
  }

  encode(snapshot: CoreConfigurationSnapshot): string {
    const serialized = this.serialize(snapshot);
    if (new TextEncoder().encode(serialized).byteLength > MAX_SERIALIZED_BYTES) {
      fail('invalid-payload', 'Configuração excede o limite do formato compartilhável.');
    }
    return encodeUtf8(serialized);
  }

  deserialize(serialized: string): SerializedConfigurationV1 {
    if (new TextEncoder().encode(serialized).byteLength > MAX_SERIALIZED_BYTES) {
      fail('invalid-payload', 'Payload de configuração excede o limite permitido.');
    }
    try {
      return this.parse(JSON.parse(serialized));
    } catch (error) {
      if (error instanceof ConfigurationValidationError) throw error;
      throw new ConfigurationValidationError('invalid-payload', 'JSON de configuração inválido.', {
        cause: error,
      });
    }
  }

  decode(token: string): SerializedConfigurationV1 {
    return this.deserialize(decodeUtf8(token));
  }

  parse(value: unknown): SerializedConfigurationV1 {
    if (!isRecord(value)) fail('invalid-payload', 'Configuração deve ser um objeto JSON.');
    assertOnlyKeys(value, ROOT_KEYS, 'Configuração');

    if (value.schema_version !== CONFIGURATION_SCHEMA_VERSION) {
      fail('unsupported-schema', 'Versão do schema de configuração não suportada.');
    }
    if (value.$schema !== undefined && typeof value.$schema !== 'string') {
      fail('invalid-payload', '$schema deve ser uma string.');
    }
    if (
      value.configuration_id !== undefined &&
      (typeof value.configuration_id !== 'string' || !UUID.test(value.configuration_id))
    ) {
      fail('invalid-payload', 'configuration_id inválido.');
    }
    if (
      value.created_at !== undefined &&
      (typeof value.created_at !== 'string' ||
        !RFC3339.test(value.created_at) ||
        Number.isNaN(Date.parse(value.created_at)))
    ) {
      fail('invalid-payload', 'created_at inválido.');
    }

    if (!isRecord(value.geometry)) fail('invalid-payload', 'Referência de geometria ausente.');
    assertOnlyKeys(value.geometry, GEOMETRY_KEYS, 'Geometria');
    const geometryId = value.geometry.id;
    const geometryVersion = value.geometry.version;
    const geometrySha256 = value.geometry.sha256;
    if (
      typeof geometryId !== 'string' ||
      !CANONICAL_ID.test(geometryId) ||
      !Number.isInteger(geometryVersion) ||
      Number(geometryVersion) < 1 ||
      typeof geometrySha256 !== 'string' ||
      !SHA256.test(geometrySha256)
    ) {
      fail('invalid-payload', 'Referência de geometria inválida.');
    }
    if (
      geometryId !== this.geometry.geometryId ||
      geometryVersion !== this.geometry.geometryVersion ||
      geometrySha256 !== this.geometry.sha256
    ) {
      fail('incompatible-geometry', 'Configuração pertence a outra geometria KARV.');
    }

    if (!isRecord(value.assignments) || Object.keys(value.assignments).length === 0) {
      fail('invalid-payload', 'Configuração deve possuir ao menos uma atribuição.');
    }

    const assignments: Record<string, string> = {};
    for (const [surfaceId, materialId] of Object.entries(value.assignments).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!CANONICAL_ID.test(surfaceId) || !this.knownSurfaceIds.has(surfaceId)) {
        fail('unknown-surface', `Superfície incompatível: ${surfaceId}`);
      }
      if (typeof materialId !== 'string' || !MATERIAL_ID.test(materialId)) {
        fail('invalid-material-id', `ID de material inválido em ${surfaceId}.`);
      }
      assignments[surfaceId] = materialId;
    }

    return Object.freeze({
      ...(typeof value.$schema === 'string' ? { $schema: value.$schema } : {}),
      schema_version: CONFIGURATION_SCHEMA_VERSION,
      ...(typeof value.configuration_id === 'string'
        ? { configuration_id: value.configuration_id }
        : {}),
      geometry: Object.freeze({
        id: geometryId,
        version: Number(geometryVersion),
        sha256: geometrySha256,
      }),
      assignments: Object.freeze(assignments),
      ...(typeof value.created_at === 'string' ? { created_at: value.created_at } : {}),
    });
  }
}
