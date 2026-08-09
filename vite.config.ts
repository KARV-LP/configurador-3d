import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const runtimeAssets = [
  {
    source: 'assets/geometry/karv-chair/v2/base.glb',
    fileName: 'assets/geometry/karv-chair/v2/base.glb',
    mediaType: 'model/gltf-binary',
  },
  {
    source: 'assets/geometry/karv-chair/v2/base.manifest.json',
    fileName: 'assets/geometry/karv-chair/v2/base.manifest.json',
    mediaType: 'application/json; charset=utf-8',
  },
  {
    source: 'node_modules/three/examples/jsm/libs/draco/draco_decoder.js',
    fileName: 'vendor/draco/draco_decoder.js',
    mediaType: 'text/javascript; charset=utf-8',
  },
  {
    source: 'node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js',
    fileName: 'vendor/draco/draco_wasm_wrapper.js',
    mediaType: 'text/javascript; charset=utf-8',
  },
  {
    source: 'node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm',
    fileName: 'vendor/draco/draco_decoder.wasm',
    mediaType: 'application/wasm',
  },
] as const;

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
        response.end(readFileSync(path.join(rootDirectory, asset.source)));
      });
    },
    buildStart() {
      for (const asset of runtimeAssets) {
        this.addWatchFile(path.join(rootDirectory, asset.source));
      }
    },
    generateBundle() {
      for (const asset of runtimeAssets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: readFileSync(path.join(rootDirectory, asset.source)),
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
