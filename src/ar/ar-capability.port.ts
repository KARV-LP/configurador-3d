export type ARSupport = 'supported' | 'unsupported' | 'unknown';

export interface ARCapabilityPort {
  detect(): Promise<ARSupport>;
}
