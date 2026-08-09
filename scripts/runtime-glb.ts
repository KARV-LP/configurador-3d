import { specializeGltfMaterials } from '../src/domain/runtime-gltf-materials.ts';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;

interface Chunk {
  readonly type: number;
  readonly data: Uint8Array;
}

function readChunks(glb: Uint8Array): Chunk[] {
  if (glb.byteLength < 20) throw new Error('GLB runtime truncado.');
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== GLB_VERSION) {
    throw new Error('GLB runtime inválido.');
  }
  if (view.getUint32(8, true) !== glb.byteLength) {
    throw new Error('GLB runtime com tamanho inconsistente.');
  }
  const chunks: Chunk[] = [];
  let offset = 12;
  while (offset < glb.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + length;
    if (end > glb.byteLength) throw new Error('Chunk GLB runtime truncado.');
    chunks.push({ type, data: glb.slice(start, end) });
    offset = end;
  }
  return chunks;
}

function paddedJson(value: unknown): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const length = Math.ceil(encoded.length / 4) * 4;
  const result = new Uint8Array(length);
  result.fill(0x20);
  result.set(encoded);
  return result;
}

export function specializeRuntimeGlb(glb: Uint8Array, surfaceMap: unknown): Uint8Array {
  const chunks = readChunks(glb);
  const jsonIndex = chunks.findIndex((chunk) => chunk.type === JSON_CHUNK);
  if (jsonIndex < 0) throw new Error('GLB runtime sem chunk JSON.');
  const jsonText = new TextDecoder().decode(chunks[jsonIndex]?.data).trimEnd();
  const specialized = specializeGltfMaterials(JSON.parse(jsonText), surfaceMap);
  chunks[jsonIndex] = { type: JSON_CHUNK, data: paddedJson(specialized) };

  const totalLength = 12 + chunks.reduce((total, chunk) => total + 8 + chunk.data.length, 0);
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  let offset = 12;
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.length, true);
    view.setUint32(offset + 4, chunk.type, true);
    output.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length;
  }
  return output;
}
