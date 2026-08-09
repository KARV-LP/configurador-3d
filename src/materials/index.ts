export interface PublicMaterialSummary {
  readonly id: string;
  readonly name: string;
}

export interface MaterialCatalogPort {
  listPublished(): Promise<readonly PublicMaterialSummary[]>;
}
