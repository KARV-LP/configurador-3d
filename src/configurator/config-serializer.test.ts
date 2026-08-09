import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import configurationSchema from '../../schemas/configuration.schema.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import {
  ConfigSerializer,
  ConfigurationValidationError,
  type SerializedConfigurationV1,
} from './config-serializer';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const surfaceMap = parseSurfaceMap(surfaceMapJson, manifest);
const surfaceIds = surfaceMap.surfaces
  .filter((surface) => surface.classification === 'configurable')
  .map((surface) => surface.surfaceId);
const serializer = new ConfigSerializer(manifest, surfaceIds);

function snapshot(materialId = 'fabric-kv-002') {
  return Object.freeze({
    assignments: Object.freeze(
      Object.fromEntries(surfaceIds.map((surfaceId, index) => [surfaceId, index < 2 ? materialId : null])),
    ),
  });
}

function codeOf(action: () => unknown) {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof ConfigurationValidationError ? error.code : 'unexpected';
  }
}

describe('ConfigSerializer', () => {
  it('gera payload mínimo compatível com o schema F0 e faz round-trip determinístico', () => {
    const payload = serializer.toPayload(snapshot());
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(configurationSchema);

    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true);
    expect(payload.geometry).toEqual({
      id: manifest.geometryId,
      version: manifest.geometryVersion,
      sha256: manifest.sha256,
    });
    expect(payload).not.toHaveProperty('name');
    expect(payload).not.toHaveProperty('supplier');

    const token = serializer.encode(snapshot());
    expect(serializer.decode(token)).toEqual(payload);
    expect(serializer.encode(snapshot())).toBe(token);
  });

  it('não serializa configuração vazia', () => {
    const empty = Object.freeze({
      assignments: Object.freeze(Object.fromEntries(surfaceIds.map((surfaceId) => [surfaceId, null]))),
    });
    expect(codeOf(() => serializer.encode(empty))).toBe('empty-configuration');
  });

  it('rejeita schema futuro sem migração implícita', () => {
    const payload = serializer.toPayload(snapshot()) as unknown as Record<string, unknown>;
    expect(codeOf(() => serializer.parse({ ...payload, schema_version: 2 }))).toBe(
      'unsupported-schema',
    );
  });

  it('rejeita geometria incompatível mesmo com payload estruturalmente válido', () => {
    const payload = serializer.toPayload(snapshot());
    const incompatible: SerializedConfigurationV1 = {
      ...payload,
      geometry: { ...payload.geometry, version: payload.geometry.version + 1 },
    };
    expect(codeOf(() => serializer.parse(incompatible))).toBe('incompatible-geometry');
  });

  it('rejeita superfície desconhecida e metadata fora do contrato', () => {
    const payload = serializer.toPayload(snapshot());
    expect(
      codeOf(() =>
        serializer.parse({
          ...payload,
          assignments: { ...payload.assignments, 'surface-ghost': 'fabric-kv-002' },
        }),
      ),
    ).toBe('unknown-surface');
    expect(codeOf(() => serializer.parse({ ...payload, supplier: 'privado' }))).toBe(
      'invalid-payload',
    );
  });

  it('rejeita token corrompido', () => {
    expect(codeOf(() => serializer.decode('%%%'))).toBe('corrupted-token');
  });
});
