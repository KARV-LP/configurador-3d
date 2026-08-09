import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { CONFIGURATION_QUERY_PARAM, ConfigSerializer } from './config-serializer';
import {
  CONFIGURATION_STORAGE_KEY,
  ConfigurationSession,
  type ConfigurationStorage,
} from './configuration-session';

class MemoryStorage implements ConfigurationStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const manifest = parseCanonicalGeometryManifest(manifestJson);
const surfaceMap = parseSurfaceMap(surfaceMapJson, manifest);
const surfaceIds = surfaceMap.surfaces
  .filter((surface) => surface.classification === 'configurable')
  .map((surface) => surface.surfaceId);
const serializer = new ConfigSerializer(manifest, surfaceIds);

function snapshot(materialId: string) {
  return Object.freeze({
    assignments: Object.freeze(
      Object.fromEntries(surfaceIds.map((surfaceId, index) => [surfaceId, index === 0 ? materialId : null])),
    ),
  });
}

describe('ConfigurationSession', () => {
  it('persiste e recupera configuração em nova sessão sem URL explícita', () => {
    const storage = new MemoryStorage();
    const session = new ConfigurationSession(serializer, storage);
    const token = session.persist(snapshot('fabric-kv-002'));

    expect(token).not.toBeNull();
    const candidate = session.resolve('https://example.test/configurador');
    expect(candidate.kind).toBe('valid');
    if (candidate.kind === 'valid') {
      expect(candidate.source).toBe('storage');
      expect(candidate.payload.assignments).toMatchObject({ [surfaceIds[0] ?? 'seat']: 'fabric-kv-002' });
    }
  });

  it('URL explícita tem precedência sobre storage', () => {
    const storage = new MemoryStorage();
    const session = new ConfigurationSession(serializer, storage);
    session.persist(snapshot('fabric-kv-003'));
    const urlToken = serializer.encode(snapshot('fabric-kv-002'));
    const candidate = session.resolve(
      `https://example.test/configurador?${CONFIGURATION_QUERY_PARAM}=${urlToken}`,
    );

    expect(candidate.kind).toBe('valid');
    if (candidate.kind === 'valid') {
      expect(candidate.source).toBe('url');
      expect(Object.values(candidate.payload.assignments)).toContain('fabric-kv-002');
    }
  });

  it('link explícito corrompido não cai silenciosamente em storage válido', () => {
    const storage = new MemoryStorage();
    const session = new ConfigurationSession(serializer, storage);
    session.persist(snapshot('fabric-kv-002'));

    const candidate = session.resolve('https://example.test/configurador?config=%25%25%25');
    expect(candidate.kind).toBe('invalid');
    if (candidate.kind === 'invalid') expect(candidate.source).toBe('url');
    expect(storage.getItem(CONFIGURATION_STORAGE_KEY)).not.toBeNull();
  });

  it('remove storage corrompido e sincroniza URL compartilhada', () => {
    const storage = new MemoryStorage();
    storage.setItem(CONFIGURATION_STORAGE_KEY, '%%%');
    const session = new ConfigurationSession(serializer, storage);

    expect(session.resolve('https://example.test/configurador').kind).toBe('invalid');
    expect(storage.getItem(CONFIGURATION_STORAGE_KEY)).toBeNull();

    const configured = snapshot('fabric-kv-002');
    const shareUrl = session.createShareUrl('https://example.test/configurador?ref=karv#produto', configured);
    const parsed = new URL(shareUrl);
    expect(parsed.searchParams.get('ref')).toBe('karv');
    expect(parsed.searchParams.get(CONFIGURATION_QUERY_PARAM)).toBe(serializer.encode(configured));
    expect(parsed.hash).toBe('');

    const cleared = session.syncExistingShareUrl(shareUrl, null);
    expect(cleared).not.toBeNull();
    expect(new URL(cleared ?? shareUrl).searchParams.has(CONFIGURATION_QUERY_PARAM)).toBe(false);
  });
});
