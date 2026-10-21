import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'karv-customer-proposals';
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;
const MAX_PARTS = 4;
const ALLOWED_ART_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const ID_PATTERN = /^KARV-PROP-\d{8}T\d{6}Z-[A-F0-9]{8}$/;

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function proposalId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `KARV-PROP-${stamp}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function tokenHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeFileName(value) {
  return (
    value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .slice(0, 180) || 'arquivo'
  );
}

function validField(value) {
  return value === 'snapshot' || /^art:[a-z0-9-]{1,80}$/.test(value);
}

function readPayload(value) {
  if (JSON.stringify(value).length > 100_000) throw new Error('Payload inválido.');
  if (value?.schema !== 'karv.customer-proposal/1' || !Array.isArray(value.surfaces)) {
    throw new Error('Contrato da proposta inválido.');
  }
  if (!value.contact?.name || !value.contact?.whatsapp || !value.contact?.email) {
    throw new Error('Dados de contato obrigatórios ausentes.');
  }
  return value;
}

async function readSession(store, id, token) {
  if (!ID_PATTERN.test(id) || typeof token !== 'string') return null;
  const session = await store.get(`${id}/draft.json`, { type: 'json' });
  return session?.tokenHash === tokenHash(token) ? session : null;
}

async function notifyCommercial(proposal) {
  const webhook = process.env.KARV_PROPOSAL_WEBHOOK_URL;
  if (!webhook) return 'not-configured';
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(proposal),
    });
    return response.ok ? 'sent' : 'failed';
  } catch (error) {
    console.error('proposal-webhook-failed', error);
    return 'failed';
  }
}

async function initialize(store) {
  const id = proposalId();
  const token = randomBytes(16).toString('hex');
  await store.setJSON(
    `${id}/draft.json`,
    { tokenHash: tokenHash(token), createdAt: new Date().toISOString() },
    { metadata: { proposalId: id, kind: 'draft' }, onlyIfNew: true },
  );
  return json(201, { proposalId: id, uploadToken: token });
}

async function upload(request, store) {
  const url = new URL(request.url);
  const id = url.searchParams.get('proposalId') ?? '';
  const token = url.searchParams.get('uploadToken') ?? '';
  const field = url.searchParams.get('field') ?? '';
  const part = Number(url.searchParams.get('part'));
  const parts = Number(url.searchParams.get('parts'));
  if (!(await readSession(store, id, token))) return json(403, { error: 'Sessão inválida.' });
  if (
    !validField(field) ||
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
  if (chunk.byteLength > MAX_CHUNK_BYTES) return json(413, { error: 'Parte muito grande.' });
  await store.set(`${id}/chunks/${field}/${part}`, chunk, {
    metadata: { proposalId: id, field, part, parts },
  });
  return json(201, { stored: true });
}

async function finalize(body, store) {
  const id = body?.proposalId ?? '';
  const token = body?.uploadToken ?? '';
  if (!(await readSession(store, id, token))) return json(403, { error: 'Sessão inválida.' });
  const payload = readPayload(body.payload);
  if (!Array.isArray(body.files) || body.files.length < 1 || body.files.length > 11) {
    return json(400, { error: 'Lista de arquivos inválida.' });
  }
  const expectedFields = new Set([
    'snapshot',
    ...payload.surfaces
      .filter((surface) => surface.source === 'custom-art')
      .map((surface) => surface.customFileField),
  ]);
  const receivedFields = new Set(body.files.map((file) => file.field));
  if (
    expectedFields.size !== receivedFields.size ||
    [...expectedFields].some((field) => !receivedFields.has(field))
  ) {
    return json(400, { error: 'Arquivos da proposta não correspondem às superfícies.' });
  }
  const totalBytes = body.files.reduce((total, file) => total + Number(file.bytes), 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES) {
    return json(413, { error: 'Proposta excede o limite operacional.' });
  }

  const storedFiles = [];
  for (const descriptor of body.files) {
    if (
      !validField(descriptor.field) ||
      !Number.isInteger(descriptor.parts) ||
      descriptor.parts < 1 ||
      descriptor.parts > MAX_PARTS ||
      !Number.isSafeInteger(descriptor.bytes) ||
      descriptor.bytes < 0 ||
      descriptor.bytes > MAX_FILE_BYTES
    ) {
      return json(400, { error: 'Metadados de arquivo inválidos.' });
    }
    const allowedType =
      descriptor.field === 'snapshot'
        ? descriptor.mediaType === 'image/png'
        : ALLOWED_ART_TYPES.has(descriptor.mediaType);
    if (!allowedType) return json(400, { error: 'Tipo de arquivo inválido.' });

    const chunks = [];
    for (let part = 0; part < descriptor.parts; part++) {
      const chunk = await store.get(`${id}/chunks/${descriptor.field}/${part}`, {
        type: 'arrayBuffer',
      });
      if (!chunk) return json(400, { error: 'Envio de arquivo incompleto.' });
      chunks.push(chunk);
    }
    const file = new Blob(chunks, { type: descriptor.mediaType });
    if (file.size !== descriptor.bytes)
      return json(400, { error: 'Tamanho de arquivo divergente.' });
    const fileName =
      descriptor.field === 'snapshot'
        ? 'snapshot.png'
        : `${descriptor.surfaceId}-${safeFileName(descriptor.originalName)}`;
    const key = `${id}/files/${fileName}`;
    await store.set(key, file, {
      metadata: {
        proposalId: id,
        field: descriptor.field,
        surfaceId: descriptor.surfaceId,
        originalName: descriptor.originalName,
        mediaType: descriptor.mediaType,
      },
    });
    storedFiles.push({ ...descriptor, key });
  }

  const receivedAt = new Date().toISOString();
  const manifest = { ...payload, proposalId: id, receivedAt, storedFiles };
  await store.setJSON(`${id}/manifest.json`, manifest, {
    metadata: { proposalId: id, kind: 'manifest' },
    onlyIfNew: true,
  });
  const notification = await notifyCommercial({
    proposalId: id,
    receivedAt,
    contact: payload.contact,
    manifestKey: `${id}/manifest.json`,
  });
  return json(201, { proposalId: id, notification });
}

export default async (request) => {
  const store = getStore(STORE_NAME);
  try {
    if (request.method === 'PUT') return await upload(request, store);
    if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' });
    const body = await request.json();
    if (body?.action === 'initialize') return await initialize(store);
    if (body?.action === 'finalize') return await finalize(body, store);
    return json(400, { error: 'Ação inválida.' });
  } catch (error) {
    console.error('proposal-submit-failed', error);
    return json(500, { error: 'Não foi possível registrar a proposta.' });
  }
};
