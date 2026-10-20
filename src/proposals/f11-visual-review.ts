import type { Core3DController } from '../3d/core-3d-controller';
import { ModelViewerAdapter, type ModelViewerElementApi } from '../3d/model-viewer-adapter';
import { SurfaceRegistry } from '../3d/surface-registry';
import type { SurfaceMap } from '../domain/surface-map';
import { browserCustomAssetIO } from './custom-asset-loader';
import { prepareCustomProposal } from './custom-proposal-coordinator';
import { createOwnedCustomTexture } from './model-viewer-custom-texture';
import { resolveCustomProposal } from './proposal-resolver';
import proposal from '../../contracts/examples/proposal.sid-tattoo-p4.json';

/**
 * Adaptador estritamente de revisão visual F11.3.
 * Só é carregado quando review=sid-tattoo-p4 ou pelo ambiente de preview.
 * Não cria rota/página de proposta e não participa do boot sem review.
 */
export async function applySidTattooP4VisualReview(
  viewer: ModelViewerElementApi,
  surfaceMap: SurfaceMap,
  core: Core3DController,
): Promise<() => void> {
  const registry = new SurfaceRegistry(surfaceMap);
  const adapter = new ModelViewerAdapter(viewer);
  const resolved = resolveCustomProposal(proposal, surfaceMap);
  const custom = await prepareCustomProposal(resolved, browserCustomAssetIO, (blob) =>
    createOwnedCustomTexture(blob, adapter),
  );

  await core.replaceCustomConfiguration(custom);
  const expected = new Map<string, unknown>();
  for (const assignment of resolved.assignments) {
    const materialName = registry.runtimeMaterialName(assignment.surface);
    expected.set(
      assignment.surface.surfaceId,
      adapter.getTextures(materialName).baseColor?.texture ?? null,
    );
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

  return () => {
    delete document.body.dataset.f11Proposal;
    delete window.__karvF11Review;
    void core.replaceCustomConfiguration({});
  };
}

declare global {
  interface Window {
    __karvF11Review?: Readonly<{
      snapshot(): Readonly<Record<string, Readonly<{ present: boolean; stable: boolean }>>>;
    }>;
  }
}
