// Isolado e fixado a model-viewer 4.3.1: a API pública não oferece dispose de Texture.
import { $correlatedObjects } from '@google/model-viewer/lib/features/scene-graph/three-dom-element.js';
import type { OwnedCustomTexture } from '../3d/custom-base-color';
import type { PbrTexturePort } from '../3d/model-viewer-adapter';

/** Apenas texturas criadas por esta função são liberadas; nunca texturas do GLB/catálogo. */
export async function createOwnedCustomTexture(
  blob: Blob,
  port: Pick<PbrTexturePort, 'createTexture'>,
): Promise<OwnedCustomTexture> {
  const mediaType =
    blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/webp'
      ? blob.type
      : null;
  if (!mediaType) throw new Error('Formato de textura custom não suportado.');

  const url = URL.createObjectURL(blob);
  try {
    const texture = await port.createTexture(url, mediaType);
    const correlated = (
      texture as unknown as {
        [$correlatedObjects]?: Set<{ dispose(): void; image?: { close?: () => void } }>;
      }
    )[$correlatedObjects];
    if (!correlated?.size) throw new Error('Runtime sem suporte a liberação de textura custom.');
    let disposed = false;
    return Object.freeze({
      texture,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const gpu of correlated) {
          gpu.dispose();
          const image = gpu.image as { close?: () => void } | undefined;
          image?.close?.();
        }
        URL.revokeObjectURL(url);
      },
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
