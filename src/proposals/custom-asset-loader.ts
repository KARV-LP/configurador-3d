import type { CustomRevestimento } from './custom-revestimento';

export const MAX_CUSTOM_ASSET_BYTES = 16 * 1024 * 1024;
export const MAX_CUSTOM_IMAGE_PIXELS = 16 * 1024 * 1024;
export interface ValidatedCustomAsset {
  readonly blob: Blob;
  readonly cacheKey: string;
}
export interface CustomAssetIO {
  read(uri: string): Promise<Response>;
  decode(blob: Blob): Promise<{ width: number; height: number; close(): void }>;
}

export const browserCustomAssetIO: CustomAssetIO = {
  async read(uri) {
    const expected = new URL(uri, location.origin);
    const response = await fetch(expected, {
      mode: 'same-origin',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response.url !== expected.href || response.redirected)
      throw new Error('Origem do asset inválida.');
    return response;
  },
  decode: (blob) => createImageBitmap(blob),
};

/** Não armazena resultados rejeitados. O buffer validado é a única fonte para a textura. */
export async function loadCustomAsset(
  custom: CustomRevestimento,
  proposalId: string,
  io: CustomAssetIO = browserCustomAssetIO,
): Promise<ValidatedCustomAsset> {
  const asset = custom.base_color;
  const expected = `/proposal-assets/${proposalId}/v${custom.asset_version}/${custom.surface_id}.webp`;
  if (
    !/^[a-z][a-z0-9-]{0,79}$/u.test(proposalId) ||
    !/^[a-z][a-z0-9-]{0,79}$/u.test(custom.surface_id) ||
    !Number.isSafeInteger(custom.asset_version) ||
    custom.asset_version < 1 ||
    custom.proposal_id !== proposalId ||
    custom.validation_status !== 'approved' ||
    asset.uri !== expected ||
    asset.media_type !== 'image/webp' ||
    !Number.isSafeInteger(asset.byte_length) ||
    asset.byte_length < 1 ||
    asset.byte_length > MAX_CUSTOM_ASSET_BYTES ||
    !Number.isSafeInteger(asset.width_px) ||
    asset.width_px < 1 ||
    !Number.isSafeInteger(asset.height_px) ||
    asset.height_px < 1 ||
    asset.width_px * asset.height_px > MAX_CUSTOM_IMAGE_PIXELS
  ) {
    throw new Error('Identidade ou limites do asset custom inválidos.');
  }
  const response = await io.read(expected);
  if (response.status !== 200 || response.redirected || !response.body)
    throw new Error('Leitura do asset falhou.');
  if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'image/webp') {
    throw new Error('MIME do asset inválido.');
  }
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) !== asset.byte_length)) {
    throw new Error('byte_length HTTP divergente.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > asset.byte_length || total > MAX_CUSTOM_ASSET_BYTES) {
        throw new Error('Limite de bytes do asset excedido.');
      }
      chunks.push(new Uint8Array(next.value));
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (total !== asset.byte_length) throw new Error('byte_length real divergente.');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const sha256 = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (sha256 !== asset.sha256) throw new Error('SHA-256 do asset divergente.');
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (
    total < 12 ||
    ascii(0, 4) !== 'RIFF' ||
    ascii(8, 12) !== 'WEBP' ||
    new DataView(bytes.buffer).getUint32(4, true) + 8 !== total
  ) {
    throw new Error('Conteúdo WebP inválido.');
  }
  const blob = new Blob([bytes], { type: 'image/webp' });
  const image = await io.decode(blob);
  try {
    if (image.width !== asset.width_px || image.height !== asset.height_px) {
      throw new Error('Resolução real divergente.');
    }
  } finally {
    image.close();
  }
  return Object.freeze({ blob, cacheKey: `${expected}:${sha256}` });
}
