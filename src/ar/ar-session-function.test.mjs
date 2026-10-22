import { describe, expect, it } from 'vitest';
import { createARSessionHandler } from '../../netlify/functions/ar-session.mjs';

class MemoryStore {
  entries = new Map();

  async set(key, value) {
    this.entries.set(key, value);
    return { modified: true };
  }

  async setJSON(key, value, options = {}) {
    if (options.onlyIfNew && this.entries.has(key)) return { modified: false };
    this.entries.set(key, structuredClone(value));
    return { modified: true };
  }

  async get(key, { type } = {}) {
    const value = this.entries.get(key);
    if (value === undefined) return null;
    if (type === 'json') return structuredClone(value);
    if (type === 'arrayBuffer') {
      if (value instanceof Blob) return value.arrayBuffer();
      if (value instanceof ArrayBuffer) return value.slice(0);
    }
    return value;
  }

  async list({ prefix = '' } = {}) {
    return {
      blobs: [...this.entries.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key, etag: 'test' })),
      directories: [],
    };
  }

  async delete(key) {
    this.entries.delete(key);
  }
}

const geometry = {
  id: 'karv-chair',
  version: 2,
  sha256: 'a'.repeat(64),
};

describe('AR session function', () => {
  it('armazena, autoriza e expira os arquivos originais por superfície', async () => {
    const store = new MemoryStore();
    let now = Date.parse('2026-10-22T12:00:00Z');
    const handler = createARSessionHandler(store, () => now);
    const initialized = await handler(
      new Request('https://example.test/.netlify/functions/ar-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      }),
    );
    expect(initialized.status).toBe(201);
    const credentials = await initialized.json();
    const file = new TextEncoder().encode('%PDF-test').buffer;
    const uploadParams = new URLSearchParams({
      sessionId: credentials.sessionId,
      uploadToken: credentials.uploadToken,
      surfaceId: 'seat',
      part: '0',
      parts: '1',
    });
    const uploaded = await handler(
      new Request(`https://example.test/.netlify/functions/ar-session?${uploadParams}`, {
        method: 'PUT',
        body: file,
      }),
    );
    expect(uploaded.status).toBe(201);

    const finalized = await handler(
      new Request('https://example.test/.netlify/functions/ar-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          schema: 'karv.ar-session/1',
          sessionId: credentials.sessionId,
          uploadToken: credentials.uploadToken,
          geometry,
          files: [
            {
              surfaceId: 'seat',
              originalName: 'arte.pdf',
              mediaType: 'application/pdf',
              bytes: file.byteLength,
              parts: 1,
            },
          ],
        }),
      }),
    );
    expect(finalized.status).toBe(201);

    const accessParams = new URLSearchParams({
      sessionId: credentials.sessionId,
      accessToken: credentials.accessToken,
    });
    const manifest = await handler(
      new Request(`https://example.test/.netlify/functions/ar-session?${accessParams}`),
    );
    expect(manifest.status).toBe(200);
    await expect(manifest.json()).resolves.toMatchObject({
      schema: 'karv.ar-session/1',
      geometry,
      assets: [{ surfaceId: 'seat', originalName: 'arte.pdf' }],
    });

    accessParams.set('surfaceId', 'seat');
    const downloaded = await handler(
      new Request(`https://example.test/.netlify/functions/ar-session?${accessParams}`),
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('application/pdf');
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(new Uint8Array(file));

    now += 60 * 60 * 1000 + 1;
    const expired = await handler(
      new Request(`https://example.test/.netlify/functions/ar-session?${accessParams}`),
    );
    expect(expired.status).toBe(404);
    expect(store.entries.size).toBe(0);
  });

  it('não entrega uma sessão usando token incorreto', async () => {
    const store = new MemoryStore();
    const handler = createARSessionHandler(store, () => Date.parse('2026-10-22T12:00:00Z'));
    const response = await handler(
      new Request(
        'https://example.test/.netlify/functions/ar-session?sessionId=KARV-AR-20261022T120000Z-ABCDEF12&accessToken=' +
          '0'.repeat(48),
      ),
    );
    expect(response.status).toBe(404);
  });
});
