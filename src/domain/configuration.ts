export type SurfaceId = string;
export type MaterialId = string;

export interface GeometryReference {
  readonly id: string;
  readonly version: number;
  readonly sha256: string;
}

export interface ConfigurationSnapshot {
  readonly schemaVersion: number;
  readonly geometry: GeometryReference;
  readonly assignments: Readonly<Record<SurfaceId, MaterialId>>;
}
