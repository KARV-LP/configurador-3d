import {
  parseCanonicalGeometryManifest,
  type CanonicalGeometryManifest,
} from '../domain/geometry-manifest';
import { canonicalManifestUrl, canonicalModelUrl } from './runtime-paths';

export interface CanonicalGeometry {
  readonly manifest: CanonicalGeometryManifest;
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

  return {
    manifest: parseCanonicalGeometryManifest(await response.json()),
    modelUrl: canonicalModelUrl,
  };
}
