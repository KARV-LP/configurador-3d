import type { SurfaceMap } from '../domain/surface-map';
import { textureTransformForSurface, type ProductionPbrMaterial } from '../materials/pbr-material';
import { ModelViewerAdapter, type ModelViewerElementApi } from '../3d/model-viewer-adapter';
import { SurfaceRegistry } from '../3d/surface-registry';
import { prepareCustomProposal } from './custom-proposal-coordinator';
import { browserCustomAssetIO } from './custom-asset-loader';
import { createOwnedCustomTexture } from './model-viewer-custom-texture';
import { resolveCustomProposal } from './proposal-resolver';
import proposal from '../../contracts/examples/proposal.sid-tattoo-p4.json';

const FALLBACK_SURFACES = ['side-rear', 'side-top', 'piping-seat', 'piping-backrest'] as const;

/**
 * Adaptador estritamente de revisão visual F11.3.
 * Só é carregado quando VITE_F11_REVIEW_PROPOSAL=sid-tattoo-p4.
 * Não cria rota/página de proposta e não participa do build normal de produção.
 */
export async function applySidTattooP4VisualReview(
  viewer: ModelViewerElementApi,
  surfaceMap: SurfaceMap,
  fallback: ProductionPbrMaterial,
): Promise<() => void> {
  const registry = new SurfaceRegistry(surfaceMap);
  const adapter = new ModelViewerAdapter(viewer);
  const resolved = resolveCustomProposal(proposal, surfaceMap);
  const owned = [] as Array<{ dispose(): void }>;
  const custom = await prepareCustomProposal(resolved, browserCustomAssetIO, async (blob) => {
    const texture = await createOwnedCustomTexture(blob, adapter);
    owned.push(texture);
    return texture;
  });

  const expected = new Map<string, unknown>();

  try {
    for (const surfaceId of FALLBACK_SURFACES) {
      const surface = registry.get(surfaceId);
      if (!surface?.textureFrame) throw new Error(`Frame UV ausente: ${surfaceId}`);
      const transform = textureTransformForSurface(surface.textureFrame, fallback);
      const [baseColor, normal, ambientOcclusion] = await Promise.all([
        adapter.createTexture(fallback.baseColor.uri),
        adapter.createTexture(fallback.normal.uri),
        adapter.createTexture(fallback.ambientOcclusion.uri),
      ]);
      const materialName = registry.runtimeMaterialName(surface);
      adapter.setTextures(
        materialName,
        Object.freeze({
          baseColor: Object.freeze({ texture: baseColor, transform }),
          normal: Object.freeze({ texture: normal, transform }),
          ambientOcclusion: Object.freeze({ texture: ambientOcclusion, transform }),
        }),
      );
      adapter.setPbrFactors(materialName, fallback.roughnessFactor, fallback.metalness);
      expected.set(surfaceId, adapter.getTextures(materialName).baseColor?.texture ?? null);
    }

    for (const assignment of resolved.assignments) {
      const surface = assignment.surface;
      const source = custom[surface.surfaceId];
      if (!source) throw new Error(`Revestimento custom ausente: ${surface.surfaceId}`);
      const customTexture = await source.create();
      const materialName = registry.runtimeMaterialName(surface);
      const current = adapter.getTextures(materialName);
      const transform =
        current.baseColor?.transform ??
        Object.freeze({
          scale: Object.freeze({ u: 1, v: 1 }),
          offset: Object.freeze({ u: 0, v: 0 }),
          rotationRadians: 0,
        });
      adapter.setTextures(
        materialName,
        Object.freeze({
          ...current,
          baseColor: Object.freeze({ texture: customTexture.texture, transform }),
        }),
      );
      expected.set(surface.surfaceId, adapter.getTextures(materialName).baseColor?.texture ?? null);
    }

    window.__karvF11Review = Object.freeze({
      snapshot: () =>
        Object.freeze(
          Object.fromEntries(
            [...expected].map(([surfaceId, texture]) => {
              const surface = registry.get(surfaceId);
              const current = surface
                ? (adapter.getTextures(registry.runtimeMaterialName(surface)).baseColor?.texture ??
                  null)
                : null;
              return [
                surfaceId,
                Object.freeze({ present: current !== null, stable: current === texture }),
              ];
            }),
          ),
        ),
    });
    document.body.dataset.f11Proposal = 'sid-tattoo-p4';
    document.body.dispatchEvent(new CustomEvent('karv:f11-review-ready'));
  } catch (error) {
    for (const texture of owned.splice(0)) texture.dispose();
    throw error;
  }

  return () => {
    delete document.body.dataset.f11Proposal;
    delete window.__karvF11Review;
    for (const texture of owned.splice(0)) texture.dispose();
  };
}

declare global {
  interface Window {
    __karvF11Review?: Readonly<{
      snapshot(): Readonly<Record<string, Readonly<{ present: boolean; stable: boolean }>>>;
    }>;
  }
}
