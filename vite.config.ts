import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { specializeRuntimeGlb } from './scripts/runtime-glb';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const canonicalGlbSource = 'assets/geometry/karv-chair/v2/base.glb';
const surfaceMapSource = 'contracts/surface-map.json';

type RuntimeAsset =
  | Readonly<{
      kind: 'file';
      source: string;
      fileName: string;
      mediaType: string;
    }>
  | Readonly<{
      kind: 'generated';
      watch: readonly string[];
      fileName: string;
      mediaType: string;
      generate: () => Uint8Array;
    }>;

function buildSpecializedGlb(): Uint8Array {
  const glb = readFileSync(path.join(rootDirectory, canonicalGlbSource));
  const surfaceMap = JSON.parse(
    readFileSync(path.join(rootDirectory, surfaceMapSource), 'utf8'),
  ) as unknown;
  return specializeRuntimeGlb(glb, surfaceMap);
}

const runtimeAssets: readonly RuntimeAsset[] = [
  {
    kind: 'file',
    source: canonicalGlbSource,
    fileName: 'assets/geometry/karv-chair/v2/base.glb',
    mediaType: 'model/gltf-binary',
  },
  {
    kind: 'generated',
    watch: [canonicalGlbSource, surfaceMapSource],
    fileName: 'assets/runtime/karv-chair/v2/base.glb',
    mediaType: 'model/gltf-binary',
    generate: buildSpecializedGlb,
  },
  {
    kind: 'file',
    source: 'assets/geometry/karv-chair/v2/base.manifest.json',
    fileName: 'assets/geometry/karv-chair/v2/base.manifest.json',
    mediaType: 'application/json; charset=utf-8',
  },
  {
    kind: 'file',
    source: 'node_modules/three/examples/jsm/libs/draco/draco_decoder.js',
    fileName: 'vendor/draco/draco_decoder.js',
    mediaType: 'text/javascript; charset=utf-8',
  },
  {
    kind: 'file',
    source: 'node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js',
    fileName: 'vendor/draco/draco_wasm_wrapper.js',
    mediaType: 'text/javascript; charset=utf-8',
  },
  {
    kind: 'file',
    source: 'node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm',
    fileName: 'vendor/draco/draco_decoder.wasm',
    mediaType: 'application/wasm',
  },
];

function sourceFor(asset: RuntimeAsset): Uint8Array {
  return asset.kind === 'file'
    ? readFileSync(path.join(rootDirectory, asset.source))
    : asset.generate();
}

function watchedFiles(asset: RuntimeAsset): readonly string[] {
  return asset.kind === 'file' ? [asset.source] : asset.watch;
}

function localRuntimeAssets(): Plugin {
  return {
    name: 'karv-local-runtime-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split('?')[0];
        const asset = runtimeAssets.find(({ fileName }) => `/${fileName}` === requestPath);
        if (!asset) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', asset.mediaType);
        response.setHeader('Cache-Control', 'no-store');
        response.end(sourceFor(asset));
      });
    },
    buildStart() {
      for (const asset of runtimeAssets) {
        for (const source of watchedFiles(asset)) {
          this.addWatchFile(path.join(rootDirectory, source));
        }
      }
    },
    generateBundle() {
      for (const asset of runtimeAssets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: sourceFor(asset),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), localRuntimeAssets()],
  publicDir: false,
  build: {
    target: 'es2022',
    assetsDir: 'assets/app',
    sourcemap: false,
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react')) return 'react';
          if (
            id.includes('/node_modules/@google/model-viewer') ||
            id.includes('/node_modules/three') ||
            id.includes('/node_modules/lit')
          ) {
            return 'model-viewer';
          }
        },
      },
    },
  },
});
