export interface ConfigurationSnapshot {
  readonly geometryId: string;
  readonly geometryVersion: number;
  readonly assignments: Readonly<Record<string, string>>;
}

export interface ConfigurationStorePort {
  read(): ConfigurationSnapshot;
  replace(snapshot: ConfigurationSnapshot): void;
}
