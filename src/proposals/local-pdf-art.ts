import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { derivePdfUvAsset, pdfUvProfileFor } from './pdf-uv-profile';

const MAX_LOCAL_PDF_BYTES = 24 * 1024 * 1024;
const PDF_SIGNATURE = '%PDF-';

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível rasterizar o PDF.'))),
      'image/png',
    );
  });
}

async function validatePdf(file: File): Promise<Uint8Array> {
  if (file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo PDF válido.');
  }
  if (file.size === 0 || file.size > MAX_LOCAL_PDF_BYTES) {
    throw new Error('O PDF deve ter até 24 MB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder('ascii').decode(bytes.subarray(0, PDF_SIGNATURE.length));
  if (signature !== PDF_SIGNATURE) {
    throw new Error('O arquivo não possui uma assinatura PDF válida.');
  }
  return bytes;
}

export async function convertLocalPdfToUv(
  file: File,
  surfaceId: string,
): Promise<{ readonly asset: Blob; readonly profileId: string }> {
  const profile = pdfUvProfileFor(surfaceId);
  if (!profile) throw new Error('Esta face não possui um molde PDF canônico.');

  const bytes = await validatePdf(file);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const document = await pdfjs.getDocument({ data: bytes }).promise;

  try {
    if (document.numPages !== 1) {
      throw new Error('Use o molde oficial de uma página correspondente à face selecionada.');
    }

    const page = await document.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scaleX = profile.canonicalRasterPx.width / baseViewport.width;
    const scaleY = profile.canonicalRasterPx.height / baseViewport.height;
    const relativeDifference = Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);
    if (relativeDifference > 0.005) {
      throw new Error('As proporções do PDF não correspondem ao molde oficial desta face.');
    }

    const viewport = page.getViewport({ scale: scaleX });
    const canvas = document.createElement('canvas');
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
    await document.destroy();
  }
}
