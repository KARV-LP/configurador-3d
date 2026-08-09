export const RUNTIME_MATERIAL_PREFIX = 'karv-runtime:';

export function runtimeMaterialName(surfaceId: string): string {
  return `${RUNTIME_MATERIAL_PREFIX}${surfaceId}`;
}
