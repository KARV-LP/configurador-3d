export interface MaterialSummary {
  readonly materialId: string;
  readonly publicName: string;
}

export interface MaterialCatalogPort {
  listPublished(): Promise<readonly MaterialSummary[]>;
}
