export type Rgba = readonly [number, number, number, number];

export interface MaterialAppearance {
  readonly baseColorFactor: Rgba;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
}

export interface RuntimeMaterialDefinition {
  readonly id: string;
  readonly publicName: string;
  readonly appearance: MaterialAppearance;
}

export const DIAGNOSTIC_MATERIALS = Object.freeze({
  sand: Object.freeze({
    id: 'karv.diagnostic.sand',
    publicName: 'Areia',
    appearance: Object.freeze({
      baseColorFactor: Object.freeze([0.74, 0.63, 0.51, 1]) as Rgba,
      metallicFactor: 0,
      roughnessFactor: 0.86,
    }),
  }),
  graphite: Object.freeze({
    id: 'karv.diagnostic.graphite',
    publicName: 'Grafite',
    appearance: Object.freeze({
      baseColorFactor: Object.freeze([0.22, 0.23, 0.24, 1]) as Rgba,
      metallicFactor: 0,
      roughnessFactor: 0.9,
    }),
  }),
} satisfies Record<string, RuntimeMaterialDefinition>);
