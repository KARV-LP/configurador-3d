import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { derivePdfUvAsset, pdfUvProfileFor } from './pdf-uv-profile';

const MAX_LOCAL_ART_BYTES = 24 * 1024 * 1024;
const PDF_SIGNATURE = '%PDF-';
const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Object.freeze([0xff, 0xd8, 0xff]);

type LocalArtKind = 'pdf' | 'png' | 'jpeg';

interface ValidatedLocalArt {
  readonly kind: LocalArtKind;
  readonly bytes: Uint8Array;
}

const ACCEPTED_EXTENSIONS: Readonly<Record<string, LocalArtKind>> = Object.freeze({
  '.pdf': 'pdf',
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
});

const MIME_BY_KIND: Readonly<Record<LocalArtKind, string>> = Object.freeze({
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
});

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível rasterizar o PDF.'))),
      'image/png',
    );
  });
}

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function fileExtension(fileName: string): string {
  const match = /\.[^.]+$/u.exec(fileName.toLowerCase());
  return match?.[0] ?? '';
}

async function validateLocalArt(file: File): Promise<ValidatedLocalArt> {
  const kind = ACCEPTED_EXTENSIONS[fileExtension(file.name)];
  if (!kind || file.type !== MIME_BY_KIND[kind]) {
    throw new Error('Use PDF, PNG, JPG ou JPEG com extensão e tipo de arquivo correspondentes.');
  }
  if (file.size === 0 || file.size > MAX_LOCAL_ART_BYTES) {
    throw new Error('A arte deve ter até 24 MB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validSignature =
    kind === 'pdf'
      ? new TextDecoder('ascii').decode(bytes.subarray(0, PDF_SIGNATURE.length)) === PDF_SIGNATURE
      : kind === 'png'
        ? hasSignature(bytes, PNG_SIGNATURE)
        : hasSignature(bytes, JPEG_SIGNATURE);
  if (!validSignature) {
    throw new Error('O conteúdo do arquivo não corresponde ao formato informado.');
  }
  return Object.freeze({ kind, bytes });
}

async function validateRasterImage(file: File): Promise<void> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error('Dimensões inválidas.');
  } catch (error) {
    throw new Error('Não foi possível decodificar esta imagem.', { cause: error });
  } finally {
    bitmap?.close();
  }
}

async function convertValidatedPdfToUv(
  bytes: Uint8Array,
  surfaceId: string,
): Promise<{ readonly asset: Blob; readonly profileId: string }> {
  const profile = pdfUvProfileFor(surfaceId);
  if (!profile) throw new Error('Esta face não possui um molde PDF canônico.');

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdfDocument = await loadingTask.promise;

  try {
    if (pdfDocument.numPages !== 1) {
      throw new Error('Use o molde oficial de uma página correspondente à face selecionada.');
    }

    const page = await pdfDocument.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scaleX = profile.canonicalRasterPx.width / baseViewport.width;
    const scaleY = profile.canonicalRasterPx.height / baseViewport.height;
    const relativeDifference = Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);
    if (relativeDifference > 0.005) {
      throw new Error('As proporções do PDF não correspondem ao molde oficial desta face.');
    }

    const viewport = page.getViewport({ scale: scaleX });
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = profile.canonicalRasterPx.width;
    canvas.height = profile.canonicalRasterPx.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas 2D indisponível para processar o PDF.');

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: 'rgba(255,255,255,0)',
    }).promise;

    const canonicalRaster = await canvasBlob(canvas);
    return Object.freeze({
      asset: await derivePdfUvAsset(canonicalRaster, profile),
      profileId: profile.id,
    });
  } finally {
    await loadingTask.destroy();
  }
}

export async function convertLocalPdfToUv(
  file: File,
  surfaceId: string,
): Promise<{ readonly asset: Blob; readonly profileId: string }> {
  const validated = await validateLocalArt(file);
  if (validated.kind !== 'pdf') throw new Error('Selecione um arquivo PDF válido.');
  return convertValidatedPdfToUv(validated.bytes, surfaceId);
}

export async function prepareLocalArtForSurface(
  file: File,
  surfaceId: string,
): Promise<{ readonly asset: Blob; readonly profileId: string }> {
  const validated = await validateLocalArt(file);
  if (validated.kind === 'pdf') {
    return convertValidatedPdfToUv(validated.bytes, surfaceId);
  }

  await validateRasterImage(file);
  return Object.freeze({
    asset: file,
    profileId: `karv-chair/v2/${surfaceId}/original-${validated.kind}-v1`,
  });
}
