import type { RuntimeTextureHandle } from './model-viewer-adapter';

export interface OwnedCustomTexture {
  readonly texture: RuntimeTextureHandle;
  dispose(): void;
}
/** Entrada preparada F11; não implementa ProductionPbrMaterial/PublicMaterial. */
export interface CustomBaseColorSource {
  readonly cacheKey: string;
  create(): Promise<OwnedCustomTexture>;
}
