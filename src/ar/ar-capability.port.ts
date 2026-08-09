export type ARSupport = 'supported' | 'unsupported' | 'unknown';
export type ARMode = 'webxr' | 'quick-look' | null;
export type ARDeviceKind = 'desktop' | 'android' | 'ios' | 'mobile-other';

export interface ARCapability {
  readonly support: ARSupport;
  readonly mode: ARMode;
  readonly device: ARDeviceKind;
  readonly reason: 'available' | 'platform-unsupported' | 'runtime-unavailable' | 'not-ready';
}

export interface ARCapabilityPort {
  detect(): Promise<ARCapability>;
}
