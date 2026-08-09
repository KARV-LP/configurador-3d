import type { ConfigurationSnapshot } from '../domain/configuration';

export interface ConfigurationStorePort {
  read(): ConfigurationSnapshot;
  replace(next: ConfigurationSnapshot): void;
}
