import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { OFFICIAL_FABRIC_FACES, processKarvFabric } from './karv-fabric-pipeline.mjs';

const temporaryDirectories = [];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'karv-fabric-'));
  temporaryDirectories.push(root);
  const input = path.join(root, 'input');
  const output = path.join(root, 'output');
  await mkdir(input);
  const pixels = Buffer.from([
    32, 64, 96, 255, 64, 96, 128, 192, 96, 128, 160, 128, 128, 160, 192, 255,
  ]);
  const source = await sharp(pixels, { raw: { width: 2, height: 2, channels: 4 } })
    .webp({ lossless: true })
    .toBuffer();
  await Promise.all(
    [...new Set(OFFICIAL_FABRIC_FACES.map(({ source: fileName }) => fileName))].map((fileName) =>
      writeFile(path.join(input, fileName), source),
    ),
  );
  return { input, output, source };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }),
      ),
  );
});

describe('pipeline KARV TECIDOS', () => {
  it('preserva cada Base Color, gera 27 mapas alinhados e cria thumbnail/metadata', async () => {
    const { input, output, source } = await fixture();
    const metadata = await processKarvFabric({
      inputDirectory: input,
      outputDirectory: output,
      fabricId: 'karv-teste-001',
    });

    expect(metadata.face_count).toBe(9);
    expect(metadata.map_count).toBe(27);
    expect(metadata.faces.piping).toMatchObject({
      source_filename: 'LATERAL_TOP.webp',
      derivation: 'byte-copy-from-side-top',
    });
    expect(metadata.thumbnail).toMatchObject({
      width_px: 512,
      height_px: 512,
      source_face: 'seat',
    });
    for (const face of OFFICIAL_FABRIC_FACES) {
      expect(await readFile(path.join(output, face.key, 'base-color.webp'))).toEqual(source);
      expect(metadata.faces[face.key].base_color).toMatchObject({ width_px: 2, height_px: 2 });
      expect(metadata.faces[face.key].normal).toMatchObject({
        media_type: 'image/png',
        width_px: 2,
        height_px: 2,
      });
      expect(metadata.faces[face.key].ambient_occlusion).toMatchObject({
        media_type: 'image/webp',
        width_px: 2,
        height_px: 2,
      });
    }
    expect(JSON.parse(await readFile(path.join(output, 'metadata.json'), 'utf8'))).toEqual(
      metadata,
    );
  });

  it('falha claramente sem qualquer uma das nove faces e não publica saída parcial', async () => {
    const { input, output } = await fixture();
    await rm(path.join(input, 'LATERAL_TOP.webp'));

    await expect(
      processKarvFabric({
        inputDirectory: input,
        outputDirectory: output,
        fabricId: 'karv-teste-001',
      }),
    ).rejects.toThrow('ausentes: LATERAL_TOP.webp');
    await expect(readFile(path.join(output, 'metadata.json'))).rejects.toThrow();
  });
});
