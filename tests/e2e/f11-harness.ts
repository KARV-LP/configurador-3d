// Harness servido somente pelo dev server do Playwright; não é uma rota do produto.
import { loadCanonicalGeometry } from '../../src/3d/load-canonical-geometry';
import { registerModelViewer } from '../../src/3d/model-viewer-runtime';
import { SurfaceRegistry } from '../../src/3d/surface-registry';
import { ModelViewerAdapter, type ModelViewerElementApi } from '../../src/3d/model-viewer-adapter';
import { PbrMaterialController } from '../../src/3d/pbr-material-controller';
import { MaterialController } from '../../src/3d/material-controller';
import { SelectionController } from '../../src/3d/selection-controller';
import { Core3DController } from '../../src/3d/core-3d-controller';
import { ConfigurationStore } from '../../src/configurator/configuration-store';
import { ConfigSerializer } from '../../src/configurator/config-serializer';
import { CustomProposalCoordinator } from '../../src/proposals/custom-proposal-coordinator';
import { browserCustomAssetIO } from '../../src/proposals/custom-asset-loader';
import { createOwnedCustomTexture } from '../../src/proposals/model-viewer-custom-texture';
import fixture from '../../contracts/examples/proposal.example.json';

await registerModelViewer();
const geometry = await loadCanonicalGeometry();
const viewer = document.createElement('model-viewer') as ModelViewerElementApi;
viewer.style.cssText = 'display:block;width:800px;height:650px';
viewer.setAttribute('src', geometry.modelUrl);
viewer.setAttribute('camera-orbit', '0deg 60deg 1.6m');
viewer.setAttribute('camera-target', geometry.surfaceMap.camera.targetM.join('m ') + 'm');
viewer.setAttribute('interaction-prompt', 'none');
viewer.setAttribute('shadow-intensity', '1');
viewer.setAttribute('reveal', 'auto');
viewer.setAttribute('loading', 'eager');
const loaded = new Promise<void>((resolve, reject) => {
  viewer.addEventListener('load', () => resolve(), { once: true });
  viewer.addEventListener('error', () => reject(new Error('GLB falhou')), { once: true });
});
document.body.append(viewer);
await loaded;
const registry = new SurfaceRegistry(geometry.surfaceMap);
const adapter = new ModelViewerAdapter(viewer);
const pbr = new PbrMaterialController(registry, adapter);
pbr.initialize();
const materials = new MaterialController(registry, adapter);
materials.initialize();
const store = new ConfigurationStore(registry.configurableSurfaces.map((s) => s.surfaceId));
store.assign('seat', 'fabric-kv-002');
const core = new Core3DController(
  new SelectionController(registry, adapter),
  materials,
  store,
  () => undefined,
  pbr,
);
let creates = 0;
let releases = 0;
const session = new CustomProposalCoordinator(
  core,
  geometry.surfaceMap,
  browserCustomAssetIO,
  async (blob) => {
    const owned = await createOwnedCustomTexture(blob, adapter);
    creates++;
    return {
      texture: owned.texture,
      dispose() {
        owned.dispose();
        releases++;
      },
    };
  },
);
const baseline = registry.configurableSurfaces.map((s) => ({
  surface: s,
  textures: adapter.getTextures(registry.runtimeMaterialName(s)),
  appearance: adapter.getAppearance(registry.runtimeMaterialName(s)),
}));
const serializer = new ConfigSerializer(
  geometry.manifest,
  registry.configurableSurfaces.map((s) => s.surfaceId),
);
const harness = {
  apply: (value: unknown = fixture) => session.apply(value),
  reset: () => session.reset(),
  dispose: () => session.dispose(),
  snapshot: () => ({
    state: session.read(),
    cache: core.customTextureStats(),
    creates,
    releases,
    f7: serializer.serialize(store.read()),
    surfaces: baseline.map(({ surface, textures, appearance }) => {
      const now = adapter.getTextures(registry.runtimeMaterialName(surface));
      return {
        id: surface.surfaceId,
        baseChanged: now.baseColor?.texture !== textures.baseColor?.texture,
        normalSame: now.normal?.texture === textures.normal?.texture,
        aoSame: now.ambientOcclusion?.texture === textures.ambientOcclusion?.texture,
        appearanceSame:
          JSON.stringify(adapter.getAppearance(registry.runtimeMaterialName(surface))) ===
          JSON.stringify(appearance),
        transform: now.baseColor?.transform ?? null,
      };
    }),
  }),
};
declare global {
  interface Window {
    f11: typeof harness;
  }
}
window.f11 = harness;
document.body.dataset.ready = 'true';
