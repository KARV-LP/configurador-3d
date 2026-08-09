function withBasePath(relativePath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${relativePath.replace(/^\/+/, '')}`;
}

export const canonicalManifestUrl = withBasePath(
  'assets/geometry/karv-chair/v2/base.manifest.json',
);
export const canonicalModelUrl = withBasePath('assets/geometry/karv-chair/v2/base.glb');
export const dracoDecoderUrl = withBasePath('vendor/draco/');
