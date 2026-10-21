import { $correlatedObjects } from '@google/model-viewer/lib/features/scene-graph/three-dom-element.js';
import { describe, expect, it, vi } from 'vitest';
import {
  ModelViewerAdapter,
  type ModelViewerElementApi,
  type RuntimeTextureHandle,
} from './model-viewer-adapter';

const IDENTITY_TRANSFORM = Object.freeze({
  scale: Object.freeze({ u: 1, v: 1 }),
  offset: Object.freeze({ u: 0, v: 0 }),
  rotationRadians: 0,
});

describe('ModelViewerAdapter UV channel', () => {
  it('aplica o canal UV da arte na textura GPU antes do binding', () => {
    const gpuTexture = { channel: 0 };
    const sampler = {
      scale: null,
      offset: null,
      rotation: null,
      setScale: vi.fn(),
      setOffset: vi.fn(),
      setRotation: vi.fn(),
    };
    const texture = {
      sampler,
      [$correlatedObjects]: new Set([gpuTexture]),
    } satisfies RuntimeTextureHandle;
    const textureInfo = {
      texture: null as RuntimeTextureHandle | null,
      setTexture(next: RuntimeTextureHandle | null) {
        this.texture = next;
      },
    };
    const material = {
      name: 'assento',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
        baseColorTexture: textureInfo,
        setBaseColorFactor: vi.fn(),
        setMetallicFactor: vi.fn(),
        setRoughnessFactor: vi.fn(),
      },
      normalTexture: null,
      occlusionTexture: null,
    };
    const viewer = {
      model: { getMaterialByName: () => material },
    } as unknown as ModelViewerElementApi;

    new ModelViewerAdapter(viewer).setTextures('assento', {
      baseColor: { texture, transform: IDENTITY_TRANSFORM, uvSet: 2 },
      normal: null,
      ambientOcclusion: null,
    });

    expect(gpuTexture.channel).toBe(2);
    expect(textureInfo.texture).toBe(texture);
  });
});
