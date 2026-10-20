/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../contracts/examples/proposal.example.json';
import type { CustomRevestimento } from './custom-revestimento';
import { loadCustomAsset, type CustomAssetIO } from './custom-asset-loader';

const bytes = new Uint8Array(readFileSync('assets/proposals/demo-custom/v1/seat.webp'));
const custom = () => structuredClone(fixture.revestimentos[0]) as CustomRevestimento;
function io(body = bytes, mime = 'image/webp', status = 200): CustomAssetIO {
  return {
    read: vi.fn(
      async () => new Response(new Uint8Array(body), { status, headers: { 'content-type': mime } }),
    ),
    decode: vi.fn(async () => ({ width: 128, height: 128, close: vi.fn() })),
  };
}
describe('F11 asset bytes', () => {
  it('valida bytes reais da fixture e fecha decoder', async () => {
    const reader = io();
    const close = vi.fn();
    reader.decode = vi.fn(async () => ({ width: 128, height: 128, close }));
    const result = await loadCustomAsset(custom(), 'demo-custom', reader);
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    expect(close).toHaveBeenCalledOnce();
    expect(reader.read).toHaveBeenCalledWith('/proposal-assets/demo-custom/v1/seat.webp');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(custom().base_color.sha256);
  });
  it.each([
    'sha',
    'length',
    'mime',
    'resolution',
    'http',
    'corrupt',
    'decode',
    'oversize',
    'identity',
    'surface',
    'version',
    'query',
  ])('rejeita %s antes de aplicar', async (kind) => {
    const c = structuredClone(custom());
    let reader = io();
    // Campos readonly pertencem ao contrato: montar variantes, sem alterar contrato produtivo.
    const asset = { ...c.base_color };
    let value = { ...c, base_color: asset };
    if (kind === 'sha') asset.sha256 = '0'.repeat(64);
    if (kind === 'length') asset.byte_length += 1;
    if (kind === 'mime') reader = io(bytes, 'image/png');
    if (kind === 'resolution') asset.width_px = 64;
    if (kind === 'http') reader = io(bytes, 'image/webp', 404);
    if (kind === 'corrupt') {
      const bad = new Uint8Array(bytes);
      bad[0] = 0;
      asset.sha256 = createHash('sha256').update(bad).digest('hex');
      reader = io(bad);
    }
    if (kind === 'decode')
      reader.decode = async () => {
        throw new Error('decoder rejeitou');
      };
    if (kind === 'oversize') asset.byte_length = 16777217;
    if (kind === 'identity') value = { ...value, proposal_id: 'other' };
    if (kind === 'surface') value = { ...value, surface_id: 'backrest-front' };
    if (kind === 'version') value = { ...value, asset_version: 2 };
    if (kind === 'query') asset.uri += '?token=secret';
    await expect(loadCustomAsset(value, 'demo-custom', reader)).rejects.toThrow();
  });
  it('limita stream mesmo sem Content-Length', async () => {
    const reader = io(new Uint8Array(1000));
    await expect(loadCustomAsset(custom(), 'demo-custom', reader)).rejects.toThrow('Limite');
  });
  it('não confia em Content-Length mentiroso', async () => {
    const reader = io();
    reader.read = async () =>
      new Response(bytes, { headers: { 'content-type': 'image/webp', 'content-length': '999' } });
    await expect(loadCustomAsset(custom(), 'demo-custom', reader)).rejects.toThrow('HTTP');
  });
});
