export const AR_SESSION_QUERY_PARAM = 'ar-session';

const SESSION_ID_PATTERN = /^KARV-AR-\d{8}T\d{6}Z-[A-F0-9]{8}$/;
const ACCESS_TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;

export interface ARSessionGeometry {
  readonly id: string;
  readonly version: number;
  readonly sha256: string;
}

interface CreateARSessionInput {
  readonly geometry: ARSessionGeometry;
  readonly customFiles: ReadonlyMap<string, File>;
  readonly endpoint?: string;
  readonly signal?: AbortSignal;
}

export interface LoadedARSession {
  readonly geometry: ARSessionGeometry;
  readonly expiresAt: string;
  readonly files: ReadonlyMap<string, File>;
}

interface ARSessionAssetDescriptor {
  readonly surfaceId: string;
  readonly originalName: string;
  readonly mediaType: string;
  readonly bytes: number;
}

function endpointOrDefault(endpoint?: string): string {
  return (
    endpoint ?? import.meta.env.VITE_KARV_AR_SESSION_ENDPOINT ?? '/.netlify/functions/ar-session'
  );
}

export function encodeARSessionCredential(sessionId: string, accessToken: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId) || !ACCESS_TOKEN_PATTERN.test(accessToken)) {
    throw new Error('Credencial de RA inválida.');
  }
  return `${sessionId}.${accessToken}`;
}

export function decodeARSessionCredential(
  credential: string,
): Readonly<{ sessionId: string; accessToken: string }> {
  const separator = credential.lastIndexOf('.');
  const sessionId = credential.slice(0, separator);
  const accessToken = credential.slice(separator + 1);
  if (!SESSION_ID_PATTERN.test(sessionId) || !ACCESS_TOKEN_PATTERN.test(accessToken)) {
    throw new Error('Credencial de RA inválida.');
  }
  return Object.freeze({ sessionId, accessToken });
}

export function readARSessionCredential(currentUrl: string): string | null {
  const fragment = new URL(currentUrl).hash.replace(/^#/u, '');
  const credential = new URLSearchParams(fragment).get(AR_SESSION_QUERY_PARAM);
  if (!credential) return null;
  decodeARSessionCredential(credential);
  return credential;
}

export async function createARSession({
  geometry,
  customFiles,
  endpoint,
  signal,
}: CreateARSessionInput): Promise<string | null> {
  if (customFiles.size === 0) return null;
  const target = endpointOrDefault(endpoint);
  const initialize = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'initialize' }),
    signal: signal ?? null,
  });
  if (!initialize.ok) throw new Error('Não foi possível iniciar a transferência das artes.');
  const session = (await initialize.json()) as {
    sessionId?: unknown;
    uploadToken?: unknown;
    accessToken?: unknown;
  };
  if (
    typeof session.sessionId !== 'string' ||
    typeof session.uploadToken !== 'string' ||
    typeof session.accessToken !== 'string'
  ) {
    throw new Error('Resposta inválida ao preparar a RA.');
  }

  const finalizedFiles: Array<ARSessionAssetDescriptor & { parts: number }> = [];
  for (const [surfaceId, file] of customFiles) {
    const parts = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
    for (let part = 0; part < parts; part++) {
      const chunk = file.slice(
        part * UPLOAD_CHUNK_BYTES,
        Math.min(file.size, (part + 1) * UPLOAD_CHUNK_BYTES),
        file.type,
      );
      const params = new URLSearchParams({
        sessionId: session.sessionId,
        uploadToken: session.uploadToken,
        surfaceId,
        part: String(part),
        parts: String(parts),
      });
      const upload = await fetch(`${target}?${params}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
        signal: signal ?? null,
      });
      if (!upload.ok) throw new Error(`Falha ao transferir ${file.name} para a RA.`);
    }
    finalizedFiles.push({
      surfaceId,
      originalName: file.name,
      mediaType: file.type,
      bytes: file.size,
      parts,
    });
  }
  const finalize = await fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'finalize',
      schema: 'karv.ar-session/1',
      sessionId: session.sessionId,
      uploadToken: session.uploadToken,
      geometry,
      files: finalizedFiles,
    }),
    signal: signal ?? null,
  });
  if (!finalize.ok) throw new Error('Não foi possível finalizar a transferência das artes.');
  return encodeARSessionCredential(session.sessionId, session.accessToken);
}

function isAssetDescriptor(value: unknown): value is ARSessionAssetDescriptor {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<ARSessionAssetDescriptor>;
  return (
    typeof asset.surfaceId === 'string' &&
    typeof asset.originalName === 'string' &&
    typeof asset.mediaType === 'string' &&
    typeof asset.bytes === 'number' &&
    Number.isSafeInteger(asset.bytes) &&
    asset.bytes > 0
  );
}

function isGeometry(value: unknown): value is ARSessionGeometry {
  if (!value || typeof value !== 'object') return false;
  const geometry = value as Partial<ARSessionGeometry>;
  return (
    typeof geometry.id === 'string' &&
    typeof geometry.version === 'number' &&
    Number.isInteger(geometry.version) &&
    typeof geometry.sha256 === 'string'
  );
}

export async function loadARSession(
  credential: string,
  endpoint?: string,
  signal?: AbortSignal,
): Promise<LoadedARSession> {
  const { sessionId, accessToken } = decodeARSessionCredential(credential);
  const target = endpointOrDefault(endpoint);
  const baseParams = new URLSearchParams({ sessionId, accessToken });
  const response = await fetch(`${target}?${baseParams}`, { signal: signal ?? null });
  if (!response.ok) throw new Error('A sessão de RA expirou ou não está disponível.');
  const manifest = (await response.json()) as {
    schema?: unknown;
    expiresAt?: unknown;
    geometry?: unknown;
    assets?: unknown;
  };
  if (
    manifest.schema !== 'karv.ar-session/1' ||
    typeof manifest.expiresAt !== 'string' ||
    !isGeometry(manifest.geometry) ||
    !Array.isArray(manifest.assets) ||
    !manifest.assets.every(isAssetDescriptor)
  ) {
    throw new Error('Resposta inválida da sessão de RA.');
  }

  const downloadedFiles = await Promise.all(
    manifest.assets.map(async (asset) => {
      const params = new URLSearchParams({ sessionId, accessToken, surfaceId: asset.surfaceId });
      const download = await fetch(`${target}?${params}`, { signal: signal ?? null });
      if (!download.ok) throw new Error(`Não foi possível recuperar ${asset.originalName}.`);
      const blob = await download.blob();
      if (blob.size !== asset.bytes || blob.type !== asset.mediaType) {
        throw new Error(`A arte ${asset.originalName} está incompleta.`);
      }
      return [
        asset.surfaceId,
        new File([blob], asset.originalName, { type: asset.mediaType, lastModified: 0 }),
      ] as const;
    }),
  );
  const files = new Map(downloadedFiles);
  return Object.freeze({
    geometry: Object.freeze(manifest.geometry),
    expiresAt: manifest.expiresAt,
    files,
  });
}
