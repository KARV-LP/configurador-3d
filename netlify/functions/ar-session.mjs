import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'karv-ar-sessions';
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 144 * 1024 * 1024;
const MAX_PARTS = 6;
const ALLOWED_ART_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const SURFACE_IDS = new Set([
  'seat',
  'backrest-front',
  'backrest-side',
  'backrest-rear',
  'side-outer',
  'side-inner',
]);
const ID_PATTERN = /^KARV-AR-\d{8}T\d{6}Z-[A-F0-9]{8}$/;
const TOKEN_PATTERN = /^[a-f0-9]{32,64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function sessionId(now) {
  const stamp = new Date(now)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `KARV-AR-${stamp}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function tokenHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeFileName(value) {
  return (
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .slice(0, 180) || 'arte'
  );
}

function validGeometry(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    /^[a-z][a-z0-9-]*$/.test(value.id) &&
    Number.isInteger(value.version) &&
    value.version > 0 &&
    typeof value.sha256 === 'string' &&
    SHA256_PATTERN.test(value.sha256)
  );
}

function validSessionIdentity(id, token) {
  return ID_PATTERN.test(id) && typeof token === 'string' && TOKEN_PATTERN.test(token);
}

async function readAuthorized(store, key, id, token, now) {
  if (!validSessionIdentity(id, token)) return null;
  const session = await store.get(key, { type: 'json' });
  if (!session || session.tokenHash !== tokenHash(token)) return null;
  if (Date.parse(session.expiresAt) <= now) {
    await deleteSession(store, id);
    return null;
  }
  return session;
}

async function deleteSession(store, id) {
  const { blobs } = await store.list({ prefix: `sessions/${id}/` });
  await Promise.all(blobs.map(({ key }) => store.delete(key)));
}

async function initialize(store, now) {
  const id = sessionId(now);
  const uploadToken = randomBytes(16).toString('hex');
  const accessToken = randomBytes(24).toString('hex');
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  await store.setJSON(
    `sessions/${id}/draft.json`,
    {
      tokenHash: tokenHash(uploadToken),
      accessTokenHash: tokenHash(accessToken),
      createdAt: new Date(now).toISOString(),
      expiresAt,
    },
    { metadata: { sessionId: id, kind: 'draft', expiresAt }, onlyIfNew: true },
  );
  return json(201, { sessionId: id, uploadToken, accessToken, expiresAt });
}

async function upload(request, store, now) {
  const url = new URL(request.url);
  const id = url.searchParams.get('sessionId') ?? '';
  const token = url.searchParams.get('uploadToken') ?? '';
  const surfaceId = url.searchParams.get('surfaceId') ?? '';
  const part = Number(url.searchParams.get('part'));
  const parts = Number(url.searchParams.get('parts'));
  const draft = await readAuthorized(store, `sessions/${id}/draft.json`, id, token, now);
  if (!draft) return json(403, { error: 'Sessão de RA inválida ou expirada.' });
  if (
    !SURFACE_IDS.has(surfaceId) ||
    !Number.isInteger(part) ||
    !Number.isInteger(parts) ||
    part < 0 ||
    parts < 1 ||
    parts > MAX_PARTS ||
    part >= parts
  ) {
    return json(400, { error: 'Parte de arquivo inválida.' });
  }
  const chunk = await request.arrayBuffer();
  if (chunk.byteLength < 1 || chunk.byteLength > MAX_CHUNK_BYTES) {
    return json(413, { error: 'Parte de arquivo fora do limite.' });
  }
  await store.set(`sessions/${id}/chunks/${surfaceId}/${part}`, chunk, {
    metadata: { sessionId: id, surfaceId, part, parts, expiresAt: draft.expiresAt },
  });
  return json(201, { stored: true });
}

function validateFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > SURFACE_IDS.size) {
    throw new Error('Lista de artes inválida.');
  }
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    if (
      !SURFACE_IDS.has(file?.surfaceId) ||
      seen.has(file.surfaceId) ||
      typeof file.originalName !== 'string' ||
      file.originalName.length < 1 ||
      file.originalName.length > 255 ||
      !ALLOWED_ART_TYPES.has(file.mediaType) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      file.bytes > MAX_FILE_BYTES ||
      !Number.isInteger(file.parts) ||
      file.parts < 1 ||
      file.parts > MAX_PARTS
    ) {
      throw new Error('Metadados de arte inválidos.');
    }
    seen.add(file.surfaceId);
    total += file.bytes;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error('Sessão de RA excede o limite operacional.');
}

async function hasValidSignature(file, mediaType) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signature =
    mediaType === 'application/pdf'
      ? [0x25, 0x50, 0x44, 0x46, 0x2d]
      : mediaType === 'image/png'
        ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        : [0xff, 0xd8, 0xff];
  return signature.every((value, index) => bytes[index] === value);
}

async function finalize(body, store, now) {
  const id = body?.sessionId ?? '';
  const uploadToken = body?.uploadToken ?? '';
  const draft = await readAuthorized(store, `sessions/${id}/draft.json`, id, uploadToken, now);
  if (!draft) return json(403, { error: 'Sessão de RA inválida ou expirada.' });
  if (body?.schema !== 'karv.ar-session/1' || !validGeometry(body.geometry)) {
    return json(400, { error: 'Contrato da sessão de RA inválido.' });
  }
  try {
    validateFiles(body.files);
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Lista inválida.' });
  }

  const assets = [];
  for (const descriptor of body.files) {
    const chunks = [];
    for (let part = 0; part < descriptor.parts; part++) {
      const chunkKey = `sessions/${id}/chunks/${descriptor.surfaceId}/${part}`;
      const chunk = await store.get(chunkKey, { type: 'arrayBuffer' });
      if (!chunk) return json(400, { error: 'Envio de arte incompleto.' });
      chunks.push(chunk);
    }
    const file = new Blob(chunks, { type: descriptor.mediaType });
    if (file.size !== descriptor.bytes) {
      return json(400, { error: 'Tamanho de arte divergente.' });
    }
    if (!(await hasValidSignature(file, descriptor.mediaType))) {
      return json(400, { error: 'Conteúdo da arte não corresponde ao formato informado.' });
    }
    const key = `sessions/${id}/files/${descriptor.surfaceId}`;
    await store.set(key, file, {
      metadata: {
        sessionId: id,
        surfaceId: descriptor.surfaceId,
        originalName: descriptor.originalName,
        mediaType: descriptor.mediaType,
        expiresAt: draft.expiresAt,
      },
    });
    assets.push({
      surfaceId: descriptor.surfaceId,
      originalName: safeFileName(descriptor.originalName),
      mediaType: descriptor.mediaType,
      bytes: descriptor.bytes,
    });
  }

  const manifest = {
    schema: 'karv.ar-session/1',
    tokenHash: draft.accessTokenHash,
    createdAt: draft.createdAt,
    expiresAt: draft.expiresAt,
    geometry: body.geometry,
    assets,
  };
  await store.setJSON(`sessions/${id}/manifest.json`, manifest, {
    metadata: { sessionId: id, kind: 'manifest', expiresAt: draft.expiresAt },
    onlyIfNew: true,
  });
  const { blobs } = await store.list({ prefix: `sessions/${id}/chunks/` });
  await Promise.all([
    ...blobs.map(({ key }) => store.delete(key)),
    store.delete(`sessions/${id}/draft.json`),
  ]);
  return json(201, { sessionId: id, expiresAt: draft.expiresAt });
}

async function readSession(request, store, now) {
  const url = new URL(request.url);
  const id = url.searchParams.get('sessionId') ?? '';
  const token = url.searchParams.get('accessToken') ?? '';
  const manifest = await readAuthorized(store, `sessions/${id}/manifest.json`, id, token, now);
  if (!manifest) return json(404, { error: 'Sessão de RA não encontrada ou expirada.' });
  const surfaceId = url.searchParams.get('surfaceId');
  if (!surfaceId) {
    return json(200, {
      schema: manifest.schema,
      expiresAt: manifest.expiresAt,
      geometry: manifest.geometry,
      assets: manifest.assets,
    });
  }
  const asset = manifest.assets.find((candidate) => candidate.surfaceId === surfaceId);
  if (!asset) return json(404, { error: 'Arte não encontrada nesta sessão.' });
  const file = await store.get(`sessions/${id}/files/${surfaceId}`, { type: 'arrayBuffer' });
  if (!file) return json(404, { error: 'Arte não encontrada nesta sessão.' });
  return new Response(file, {
    status: 200,
    headers: {
      'content-type': asset.mediaType,
      'content-length': String(file.byteLength),
      'cache-control': 'private, max-age=60',
      'content-disposition': `inline; filename="${encodeURIComponent(asset.originalName)}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function cleanupExpiredSessions(store = getStore(STORE_NAME), now = Date.now()) {
  const { blobs } = await store.list({ prefix: 'sessions/' });
  const candidates = new Set(
    blobs
      .map(({ key }) => key.match(/^sessions\/(KARV-AR-[^/]+)\/(?:draft|manifest)\.json$/)?.[1])
      .filter(Boolean),
  );
  let deleted = 0;
  for (const id of candidates) {
    const manifest =
      (await store.get(`sessions/${id}/manifest.json`, { type: 'json' })) ??
      (await store.get(`sessions/${id}/draft.json`, { type: 'json' }));
    if (manifest && Date.parse(manifest.expiresAt) <= now) {
      await deleteSession(store, id);
      deleted++;
    }
  }
  return deleted;
}

export function createARSessionHandler(store, now = () => Date.now()) {
  return async (request) => {
    try {
      if (request.method === 'GET') return await readSession(request, store, now());
      if (request.method === 'PUT') return await upload(request, store, now());
      if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
      const body = await request.json();
      if (body?.action === 'initialize') return await initialize(store, now());
      if (body?.action === 'finalize') return await finalize(body, store, now());
      return json(400, { error: 'Ação inválida.' });
    } catch (error) {
      console.error('ar-session-failed', error);
      return json(500, { error: 'Não foi possível preparar a sessão de RA.' });
    }
  };
}

export default (request) => createARSessionHandler(getStore(STORE_NAME))(request);
