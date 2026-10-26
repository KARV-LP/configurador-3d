import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const OFFICIAL_FABRIC_FACES = Object.freeze([
  Object.freeze({ source: 'Assento.webp', key: 'seat', surfaceIds: Object.freeze(['seat']) }),
  Object.freeze({
    source: 'ENCOSTO_FRONTAL.webp',
    key: 'backrest-front',
    surfaceIds: Object.freeze(['backrest-front']),
  }),
  Object.freeze({
    source: 'ENCOSTO_LATERAL.webp',
    key: 'backrest-side',
    surfaceIds: Object.freeze(['backrest-side']),
  }),
  Object.freeze({
    source: 'ENCOSTO_TRASEIRO.webp',
    key: 'backrest-rear',
    surfaceIds: Object.freeze(['backrest-rear']),
  }),
  Object.freeze({
    source: 'LATERAL_EXTERNA.webp',
    key: 'side-outer',
    surfaceIds: Object.freeze(['side-outer']),
  }),
  Object.freeze({
    source: 'LATERAL_INTERNA.webp',
    key: 'side-inner',
    surfaceIds: Object.freeze(['side-inner']),
  }),
  Object.freeze({
    source: 'LATERAL_REAR.webp',
    key: 'side-rear',
    surfaceIds: Object.freeze(['side-rear']),
  }),
  Object.freeze({
    source: 'LATERAL_TOP.webp',
    key: 'side-top',
    surfaceIds: Object.freeze(['side-top']),
  }),
  Object.freeze({
    source: 'LATERAL_TOP.webp',
    key: 'piping',
    surfaceIds: Object.freeze(['piping-seat', 'piping-backrest']),
  }),
]);

const EXPECTED_SOURCE_NAMES = new Set(OFFICIAL_FABRIC_FACES.map(({ source }) => source));
const NORMAL_STRENGTH = 2.25;
const AO_STRENGTH = 0.65;

function assertFabricId(value) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/u.test(value)) {
    throw new Error(
      `ID de tecido inválido: "${value}". Use letras minúsculas, números e hífens (ex.: karv-linho-001).`,
    );
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function imageAsset(filePath, relativeUri, expectedFormat) {
  const bytes = await readFile(filePath);
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new Error(`Imagem gerada inválida: ${relativeUri}`);
  }
  return Object.freeze({
    uri: relativeUri,
    media_type: `image/${expectedFormat}`,
    sha256: sha256(bytes),
    width_px: metadata.width,
    height_px: metadata.height,
    bytes: bytes.byteLength,
  });
}

function luminance(raw, channels, pixel) {
  const index = pixel * channels;
  return raw[index] * 0.2126 + raw[index + 1] * 0.7152 + raw[index + 2] * 0.0722;
}

function sampleLuminance(raw, width, height, channels, x, y) {
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  return luminance(raw, channels, clampedY * width + clampedX) / 255;
}

function generatedMaps(raw, width, height, channels) {
  const normal = Buffer.alloc(width * height * 4);
  const ao = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const left = sampleLuminance(raw, width, height, channels, x - 1, y);
      const right = sampleLuminance(raw, width, height, channels, x + 1, y);
      const top = sampleLuminance(raw, width, height, channels, x, y - 1);
      const bottom = sampleLuminance(raw, width, height, channels, x, y + 1);
      const dx = (right - left) * NORMAL_STRENGTH;
      const dy = (bottom - top) * NORMAL_STRENGTH;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const output = pixel * 4;
      normal[output] = Math.round((-dx * inverseLength * 0.5 + 0.5) * 255);
      normal[output + 1] = Math.round((-dy * inverseLength * 0.5 + 0.5) * 255);
      normal[output + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
      normal[output + 3] = channels === 4 ? raw[pixel * channels + 3] : 255;

      const center = sampleLuminance(raw, width, height, channels, x, y);
      const neighbors = (left + right + top + bottom) / 4;
      const occlusion = Math.max(0, neighbors - center);
      const value = Math.round(Math.max(0, Math.min(1, 1 - occlusion * AO_STRENGTH)) * 255);
      ao[output] = value;
      ao[output + 1] = value;
      ao[output + 2] = value;
      ao[output + 3] = channels === 4 ? raw[pixel * channels + 3] : 255;
    }
  }

  return { normal, ao };
}

async function validateSources(inputDirectory) {
  const entries = await readdir(inputDirectory, { withFileTypes: true });
  const webpFiles = entries.filter(
    (entry) => entry.isFile() && path.extname(entry.name) === '.webp',
  );
  const present = new Set(webpFiles.map(({ name }) => name));
  const missing = [...EXPECTED_SOURCE_NAMES].filter((source) => !present.has(source));
  const unexpected = webpFiles
    .map(({ name }) => name)
    .filter((name) => !EXPECTED_SOURCE_NAMES.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `ausentes: ${missing.join(', ')}` : null,
      unexpected.length > 0 ? `não reconhecidos: ${unexpected.join(', ')}` : null,
    ].filter(Boolean);
    throw new Error(`Conjunto obrigatório de Base Colors inválido (${details.join('; ')}).`);
  }
}

async function processFace(inputDirectory, stagingDirectory, face) {
  const sourcePath = path.join(inputDirectory, face.source);
  const sourceBytes = await readFile(sourcePath);
  const sourceMetadata = await sharp(sourceBytes, { failOn: 'error' }).metadata();
  if (sourceMetadata.format !== 'webp' || !sourceMetadata.width || !sourceMetadata.height) {
    throw new Error(`${face.source} não é uma Base Color WebP válida.`);
  }

  const { data, info } = await sharp(sourceBytes, { failOn: 'error' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== sourceMetadata.width || info.height !== sourceMetadata.height) {
    throw new Error(`${face.source} mudou de dimensões durante a leitura.`);
  }

  const faceDirectory = path.join(stagingDirectory, face.key);
  await mkdir(faceDirectory, { recursive: true });
  const baseColorPath = path.join(faceDirectory, 'base-color.webp');
  const normalPath = path.join(faceDirectory, 'normal.png');
  const aoPath = path.join(faceDirectory, 'ao.webp');
  await copyFile(sourcePath, baseColorPath);

  const maps = generatedMaps(data, info.width, info.height, info.channels);
  await sharp(maps.normal, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(normalPath);
  await sharp(maps.ao, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100, smartSubsample: false })
    .toFile(aoPath);

  const [baseColor, normal, ambientOcclusion] = await Promise.all([
    imageAsset(baseColorPath, `./${face.key}/base-color.webp`, 'webp'),
    imageAsset(normalPath, `./${face.key}/normal.png`, 'png'),
    imageAsset(aoPath, `./${face.key}/ao.webp`, 'webp'),
  ]);
  if (
    baseColor.sha256 !== sha256(sourceBytes) ||
    [normal, ambientOcclusion].some(
      (asset) => asset.width_px !== baseColor.width_px || asset.height_px !== baseColor.height_px,
    )
  ) {
    throw new Error(`Falha de integridade ou alinhamento na face ${face.source}.`);
  }

  return Object.freeze({
    source_filename: face.source,
    ...(face.key === 'piping' ? { derivation: 'byte-copy-from-side-top' } : {}),
    surface_ids: face.surfaceIds,
    base_color: baseColor,
    normal,
    ambient_occlusion: ambientOcclusion,
  });
}

export async function processKarvFabric({ inputDirectory, outputDirectory, fabricId }) {
  assertFabricId(fabricId);
  const input = path.resolve(inputDirectory);
  const output = path.resolve(outputDirectory);
  if (input === output || output === path.parse(output).root) {
    throw new Error('Diretório de saída inseguro para a pipeline de tecidos.');
  }
  if (!(await stat(input)).isDirectory()) throw new Error(`Entrada não é um diretório: ${input}`);
  await validateSources(input);

  const staging = `${output}.tmp-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  try {
    const processedFaces = await Promise.all(
      OFFICIAL_FABRIC_FACES.map((face) => processFace(input, staging, face)),
    );
    const faces = Object.fromEntries(
      OFFICIAL_FABRIC_FACES.map((face, index) => [face.key, processedFaces[index]]),
    );

    const thumbnailPath = path.join(staging, 'thumbnail.webp');
    const thumbnailSource = await readFile(path.join(input, 'Assento.webp'));
    await sharp(thumbnailSource, { failOn: 'error' })
      .resize(512, 512, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 88, alphaQuality: 100, smartSubsample: false })
      .toFile(thumbnailPath);
    const thumbnail = await imageAsset(thumbnailPath, './thumbnail.webp', 'webp');

    const metadata = {
      schema: 'karv.fabric-face-set/1',
      fabric_id: fabricId,
      face_count: OFFICIAL_FABRIC_FACES.length,
      map_count: OFFICIAL_FABRIC_FACES.length * 3,
      thumbnail: { source_face: 'seat', ...thumbnail },
      generation: {
        normal_convention: 'opengl',
        normal_strength: NORMAL_STRENGTH,
        ao_strength: AO_STRENGTH,
      },
      faces,
    };
    await writeFile(path.join(staging, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    return metadata;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}
