export interface PdfUvTemplateWindow {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PdfUvProfile {
  readonly id: string;
  readonly geometryId: 'karv-chair';
  readonly geometryVersion: 2;
  readonly surfaceId:
    'seat' | 'backrest-front' | 'backrest-side' | 'backrest-rear' | 'side-outer' | 'side-inner';
  readonly contourMm: Readonly<{ width: number; height: number }>;
  readonly canonicalRasterPx: Readonly<{ width: number; height: number }>;
  readonly rotationDegrees: 0 | 90 | 180 | 270;
  readonly flipU: boolean;
  readonly flipV: boolean;
  readonly templateWindowPx: PdfUvTemplateWindow;
  readonly outputPx: Readonly<{ width: number; height: number }>;
  readonly uniformScale: 1;
  readonly orientation: string;
  readonly usefulArea: 'pdf-contour';
}

const profiles = [
  {
    id: 'karv-chair/v2/seat/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'seat',
    contourMm: { width: 600, height: 800 },
    canonicalRasterPx: { width: 3548, height: 2367 },
    rotationDegrees: 90,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 0, y: 196, width: 2367, height: 3156 },
    outputPx: { width: 2367, height: 3156 },
    uniformScale: 1,
    orientation: '90deg-clockwise; shared edge toward backrest-front',
    usefulArea: 'pdf-contour',
  },
  {
    id: 'karv-chair/v2/backrest-front/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'backrest-front',
    contourMm: { width: 600, height: 400 },
    canonicalRasterPx: { width: 3074, height: 4096 },
    rotationDegrees: 90,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 0, y: 171, width: 4096, height: 2731 },
    outputPx: { width: 4096, height: 2731 },
    uniformScale: 1,
    orientation: '90deg-clockwise; shared edge toward seat',
    usefulArea: 'pdf-contour',
  },
  {
    id: 'karv-chair/v2/backrest-side/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'backrest-side',
    contourMm: { width: 209.24, height: 212.112 },
    canonicalRasterPx: { width: 1233, height: 1253 },
    rotationDegrees: 0,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 0, y: 1, width: 1233, height: 1250 },
    outputPx: { width: 1233, height: 1250 },
    uniformScale: 1,
    orientation: 'canonical; top preserved',
    usefulArea: 'pdf-contour',
  },
  {
    id: 'karv-chair/v2/backrest-rear/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'backrest-rear',
    contourMm: { width: 600, height: 800 },
    canonicalRasterPx: { width: 3074, height: 4096 },
    rotationDegrees: 0,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 1, y: 0, width: 3072, height: 4096 },
    outputPx: { width: 3072, height: 4096 },
    uniformScale: 1,
    orientation: 'canonical; outer edge aligned with side-outer',
    usefulArea: 'pdf-contour',
  },
  {
    id: 'karv-chair/v2/side-outer/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'side-outer',
    contourMm: { width: 744.1, height: 476.088 },
    canonicalRasterPx: { width: 4096, height: 2582 },
    rotationDegrees: 0,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 30, y: 0, width: 4036, height: 2582 },
    outputPx: { width: 4036, height: 2582 },
    uniformScale: 1,
    orientation: 'canonical; rear edge aligned with backrest-rear',
    usefulArea: 'pdf-contour',
  },
  {
    id: 'karv-chair/v2/side-inner/pdf-clamp-v1',
    geometryId: 'karv-chair',
    geometryVersion: 2,
    surfaceId: 'side-inner',
    contourMm: { width: 499.299, height: 180.458 },
    canonicalRasterPx: { width: 2949, height: 1047 },
    rotationDegrees: 0,
    flipU: false,
    flipV: false,
    templateWindowPx: { x: 26, y: 0, width: 2897, height: 1047 },
    outputPx: { width: 2897, height: 1047 },
    uniformScale: 1,
    orientation: 'canonical; lower edge aligned with seat',
    usefulArea: 'pdf-contour',
  },
] as const satisfies readonly PdfUvProfile[];

export const KARV_PDF_UV_PROFILES = Object.freeze(profiles);

export function pdfUvProfileFor(
  surfaceId: string,
  rasterPx?: Readonly<{ width: number; height: number }>,
): PdfUvProfile | null {
  const profile =
    KARV_PDF_UV_PROFILES.find((candidate) => candidate.surfaceId === surfaceId) ?? null;
  if (!profile || !rasterPx) return profile;
  return profile.canonicalRasterPx.width === rasterPx.width &&
    profile.canonicalRasterPx.height === rasterPx.height
    ? profile
    : null;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao derivar WebP PDF → UV.'))),
      'image/webp',
      0.92,
    );
  });
}

export async function derivePdfUvAsset(blob: Blob, profile: PdfUvProfile): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    if (
      bitmap.width !== profile.canonicalRasterPx.width ||
      bitmap.height !== profile.canonicalRasterPx.height
    ) {
      throw new Error(`Raster divergente do template canônico PDF → UV: ${profile.surfaceId}.`);
    }

    const rotated = document.createElement('canvas');
    const quarterTurn = profile.rotationDegrees === 90 || profile.rotationDegrees === 270;
    rotated.width = quarterTurn ? bitmap.height : bitmap.width;
    rotated.height = quarterTurn ? bitmap.width : bitmap.height;
    const rotatedContext = rotated.getContext('2d');
    if (!rotatedContext) throw new Error('Canvas 2D indisponível para perfil PDF → UV.');

    rotatedContext.save();
    if (profile.rotationDegrees === 90) {
      rotatedContext.translate(rotated.width, 0);
      rotatedContext.rotate(Math.PI / 2);
    } else if (profile.rotationDegrees === 180) {
      rotatedContext.translate(rotated.width, rotated.height);
      rotatedContext.rotate(Math.PI);
    } else if (profile.rotationDegrees === 270) {
      rotatedContext.translate(0, rotated.height);
      rotatedContext.rotate(-Math.PI / 2);
    }
    rotatedContext.drawImage(bitmap, 0, 0);
    rotatedContext.restore();

    const output = document.createElement('canvas');
    output.width = profile.outputPx.width;
    output.height = profile.outputPx.height;
    const context = output.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível para derivação PDF → UV.');

    const scaleX = profile.outputPx.width / profile.templateWindowPx.width;
    const scaleY = profile.outputPx.height / profile.templateWindowPx.height;
    if (Math.abs(scaleX - scaleY) > 0.000001 || scaleX !== profile.uniformScale) {
      throw new Error(`Perfil PDF → UV não uniforme: ${profile.surfaceId}.`);
    }

    context.save();
    context.translate(profile.flipU ? output.width : 0, profile.flipV ? output.height : 0);
    context.scale(profile.flipU ? -1 : 1, profile.flipV ? -1 : 1);
    context.drawImage(
      rotated,
      profile.templateWindowPx.x,
      profile.templateWindowPx.y,
      profile.templateWindowPx.width,
      profile.templateWindowPx.height,
      0,
      0,
      output.width,
      output.height,
    );
    context.restore();
    return await canvasBlob(output);
  } finally {
    bitmap.close();
  }
}
