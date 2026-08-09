export const CANONICAL_GEOMETRY = {
  id: 'karv-chair',
  version: 2,
  sha256: '878a8b89aa330da1dc7a4be00a5de6c0321ab1273c90c414ed1f22fc851df1bf',
  assetUrl: new URL('../../assets/geometry/karv-chair/v2/base.glb', import.meta.url).href,
  alt: 'Poltrona KARV configurável em três dimensões',
} as const;

export type GeometryId = typeof CANONICAL_GEOMETRY.id;
