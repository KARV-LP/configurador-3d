import type { ConfigurationSnapshot } from '../domain/configuration';

export interface ArHandoffPort {
  serialize(configuration: ConfigurationSnapshot): string;
}
