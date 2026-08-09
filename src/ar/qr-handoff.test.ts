import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/geometry/karv-chair/v2/base.manifest.json';
import surfaceMapJson from '../../contracts/surface-map.json';
import { ConfigSerializer } from '../configurator/config-serializer';
import { ConfigurationSession } from '../configurator/configuration-session';
import { parseCanonicalGeometryManifest } from '../domain/geometry-manifest';
import { parseSurfaceMap } from '../domain/surface-map';
import { createARHandoffUrl, createQRHandoff, hasARIntent } from './qr-handoff';

const manifest = parseCanonicalGeometryManifest(manifestJson);
const surfaceMap = parseSurfaceMap(surfaceMapJson, manifest);
const surfaceIds = surfaceMap.surfaces
  .filter((surface) => surface.classification === 'configurable')
  .map((surface) => surface.surfaceId);
const session = new ConfigurationSession(new ConfigSerializer(manifest, surfaceIds), null);

function snapshot(materialId: string | null) {
  return Object.freeze({
    assignments: Object.freeze(
      Object.fromEntries(
        surfaceIds.map((surfaceId, index) => [surfaceId, index === 0 ? materialId : null]),
      ),
    ),
  });
}

describe('QRHandoff', () => {
  it('usa o mesmo token F7 e adiciona somente a intenção AR', () => {
    const url = new URL(
      createARHandoffUrl('https://configurador.k-arv.com/', session, snapshot('fabric-kv-002')),
    );
    expect(url.searchParams.get('config')).toBeTruthy();
    expect(url.searchParams.get('intent')).toBe('ar');
    expect(hasARIntent(url.href)).toBe(true);
  });

  it('baseline remove configuração antiga antes do handoff', () => {
    const url = new URL(
      createARHandoffUrl(
        'https://configurador.k-arv.com/?config=estado-antigo&foo=1',
        session,
        snapshot(null),
      ),
    );
    expect(url.searchParams.has('config')).toBe(false);
    expect(url.searchParams.get('intent')).toBe('ar');
    expect(url.searchParams.get('foo')).toBe('1');
  });

  it('gera QR SVG local para uma configuração válida', async () => {
    const handoff = await createQRHandoff(
      'https://configurador.k-arv.com/',
      session,
      snapshot('fabric-kv-002'),
    );
    const transport = new URL(handoff.url);
    expect(transport.protocol).toBe('https:');
    expect(transport.origin).toBe('https://configurador.k-arv.com');
    expect(transport.searchParams.get('config')).toBeTruthy();
    expect(transport.searchParams.get('intent')).toBe('ar');
    expect(handoff.svg).toContain('<svg');
    expect(handoff.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
