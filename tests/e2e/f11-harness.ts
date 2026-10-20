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
import {
  textureTransformForSurface,
  type ProductionPbrMaterial,
} from '../../src/materials/pbr-material';
import { CustomProposalCoordinator } from '../../src/proposals/custom-proposal-coordinator';
import { browserCustomAssetIO } from '../../src/proposals/custom-asset-loader';
import { createOwnedCustomTexture } from '../../src/proposals/model-viewer-custom-texture';
import fixture from '../../contracts/examples/proposal.example.json';
import hybridFixture from '../../contracts/examples/proposal.sid-tattoo-p4.json';

const hybridMode = new URLSearchParams(location.search).get('proposal') === 'hybrid';
const fallbackSurfaceIds = ['side-rear', 'side-top', 'piping-seat', 'piping-backrest'] as const;
const libraryAssetRoot =
  'https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/assets/fabric-kv-002';
const officialFallback: ProductionPbrMaterial = Object.freeze({
  id: 'fabric-kv-002',
  publicName: 'Croma Musgo Pet Friendly',
  physical: Object.freeze({ widthM: 1.2, heightM: 0.6 }),
  baseColor: Object.freeze({
    uri: `${libraryAssetRoot}/base-color.webp`,
    mediaType: 'image/webp',
    sha256: '3d35f033862c3b074fe1d95ac0b49f7a571e6bf92f8ad13227695b451f428ce4',
    widthPx: 2048,
    heightPx: 1024,
    bytes: 512800,
  }),
  normal: Object.freeze({
    uri: `${libraryAssetRoot}/normal.webp`,
    mediaType: 'image/webp',
    sha256: 'ca5c973c4b418070b570eaecfe373bdb4cc444f3e5cd6ce7fe9e67e602e26763',
    widthPx: 2048,
    heightPx: 1024,
    bytes: 1524084,
  }),
  ambientOcclusion: Object.freeze({
    uri: `${libraryAssetRoot}/ao.webp`,
    mediaType: 'image/webp',
    sha256: 'f75af19f92e6aa54c049f41b72f0ca6fb2410a473f22e6ebbdf8d7f9033d84c7',
    widthPx: 2048,
    heightPx: 1024,
    bytes: 328640,
  }),
  roughnessFactor: 0.88,
  metalness: 0,
  normalConvention: 'opengl',
  normalStrength: 1,
  aoStrength: 1,
});

await registerModelViewer();
const geometry = await loadCanonicalGeometry();
const viewer = document.createElement('model-viewer') as ModelViewerElementApi;
viewer.style.cssText = 'display:block;width:900px;height:700px';
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
const canonical = registry.configurableSurfaces.map((surface) => ({
  surface,
  textures: adapter.getTextures(registry.runtimeMaterialName(surface)),
  appearance: adapter.getAppearance(registry.runtimeMaterialName(surface)),
}));

if (hybridMode) {
  for (const surfaceId of fallbackSurfaceIds) {
    const surface = registry.get(surfaceId);
    if (!surface?.textureFrame) throw new Error(`Frame UV ausente: ${surfaceId}`);
    const transform = textureTransformForSurface(surface.textureFrame, officialFallback);
    const [baseColor, normal, ambientOcclusion] = await Promise.all([
      adapter.createTexture(officialFallback.baseColor.uri),
      adapter.createTexture(officialFallback.normal.uri),
      adapter.createTexture(officialFallback.ambientOcclusion.uri),
    ]);
    const binding = (texture: typeof baseColor) => Object.freeze({ texture, transform });
    const materialName = registry.runtimeMaterialName(surface);
    adapter.setTextures(
      materialName,
      Object.freeze({
        baseColor: binding(baseColor),
        normal: binding(normal),
        ambientOcclusion: binding(ambientOcclusion),
      }),
    );
    adapter.setPbrFactors(
      materialName,
      officialFallback.roughnessFactor,
      officialFallback.metalness,
    );
  }
}

const pbr = new PbrMaterialController(registry, adapter);
pbr.initialize();
const materials = new MaterialController(registry, adapter);
materials.initialize();
const store = new ConfigurationStore(registry.configurableSurfaces.map((s) => s.surfaceId));
if (hybridMode) {
  for (const surfaceId of fallbackSurfaceIds) store.assign(surfaceId, officialFallback.id);
} else {
  store.assign('seat', 'fabric-kv-002');
}
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
const baseline = registry.configurableSurfaces.map((surface) => ({
  surface,
  textures: adapter.getTextures(registry.runtimeMaterialName(surface)),
  appearance: adapter.getAppearance(registry.runtimeMaterialName(surface)),
}));
const serializer = new ConfigSerializer(
  geometry.manifest,
  registry.configurableSurfaces.map((s) => s.surfaceId),
);
const harness = {
  apply: (value: unknown = hybridMode ? hybridFixture : fixture) => session.apply(value),
  reset: () => session.reset(),
  dispose: () => session.dispose(),
  snapshot: () => {
    const assignments = store.read().assignments;
    return {
      hybridMode,
      state: session.read(),
      cache: core.customTextureStats(),
      creates,
      releases,
      f7: serializer.serialize(store.read()),
      surfaces: baseline.map(({ surface, textures, appearance }, index) => {
        const now = adapter.getTextures(registry.runtimeMaterialName(surface));
        return {
          id: surface.surfaceId,
          assignment: assignments[surface.surfaceId],
          baseChanged: now.baseColor?.texture !== textures.baseColor?.texture,
          canonicalChanged:
            now.baseColor?.texture !== canonical[index]?.textures.baseColor?.texture,
          normalSame: now.normal?.texture === textures.normal?.texture,
          aoSame: now.ambientOcclusion?.texture === textures.ambientOcclusion?.texture,
          appearanceSame:
            JSON.stringify(adapter.getAppearance(registry.runtimeMaterialName(surface))) ===
            JSON.stringify(appearance),
          roughness: adapter.getAppearance(registry.runtimeMaterialName(surface)).roughnessFactor,
          transform: now.baseColor?.transform ?? null,
        };
      }),
    };
  },
};
declare global {
  interface Window {
    f11: typeof harness;
  }
}
window.f11 = harness;
document.body.dataset.ready = 'true';
