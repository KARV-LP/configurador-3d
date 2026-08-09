import surfaceMapJson from '../../contracts/surface-map.json';
import {
  parseCanonicalGeometryManifest,
  type CanonicalGeometryManifest,
} from '../domain/geometry-manifest';
import { parseSurfaceMap, type SurfaceMap } from '../domain/surface-map';
import { canonicalManifestUrl, runtimeModelUrl } from './runtime-paths';

export interface CanonicalGeometry {
  readonly manifest: CanonicalGeometryManifest;
  readonly surfaceMap: SurfaceMap;
  readonly modelUrl: string;
}

export async function loadCanonicalGeometry(signal?: AbortSignal): Promise<CanonicalGeometry> {
  const response = await fetch(canonicalManifestUrl, {
    cache: 'no-cache',
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error('Não foi possível carregar o manifesto da poltrona.');
  }

  const manifest = parseCanonicalGeometryManifest(await response.json());
  return {
    manifest,
    surfaceMap: parseSurfaceMap(surfaceMapJson, manifest),
    modelUrl: runtimeModelUrl,
  };
}
