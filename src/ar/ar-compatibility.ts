import type { ARCapability, ARCapabilityPort, ARDeviceKind, ARMode } from './ar-capability.port';

export interface ARRuntimeSource {
  readonly canActivateAR?: boolean;
}

export interface BrowserSignals {
  readonly userAgent: string;
  readonly platform: string;
  readonly maxTouchPoints: number;
}

export function browserSignals(): BrowserSignals {
  return Object.freeze({
    userAgent: globalThis.navigator?.userAgent ?? '',
    platform: globalThis.navigator?.platform ?? '',
    maxTouchPoints: globalThis.navigator?.maxTouchPoints ?? 0,
  });
}

export function detectARDevice(signals: BrowserSignals): ARDeviceKind {
  const userAgent = signals.userAgent.toLowerCase();
  const platform = signals.platform.toLowerCase();

  if (userAgent.includes('android')) return 'android';

  const explicitIOS = /iphone|ipad|ipod/u.test(userAgent);
  const iPadDesktopUA = platform.includes('mac') && signals.maxTouchPoints > 1;
  if (explicitIOS || iPadDesktopUA) return 'ios';

  if (/mobile|tablet/u.test(userAgent) || signals.maxTouchPoints > 1) return 'mobile-other';
  return 'desktop';
}

function modeForDevice(device: ARDeviceKind): ARMode {
  if (device === 'android') return 'webxr';
  if (device === 'ios') return 'quick-look';
  return null;
}

export class ARCompatibility implements ARCapabilityPort {
  constructor(
    private readonly runtime: ARRuntimeSource,
    private readonly signals: BrowserSignals = browserSignals(),
  ) {}

  async detect(): Promise<ARCapability> {
    const device = detectARDevice(this.signals);
    const mode = modeForDevice(device);

    if (device === 'desktop' || device === 'mobile-other') {
      return Object.freeze({
        support: 'unsupported',
        mode,
        device,
        reason: 'platform-unsupported',
      });
    }

    if (typeof this.runtime.canActivateAR !== 'boolean') {
      return Object.freeze({ support: 'unknown', mode, device, reason: 'not-ready' });
    }

    if (!this.runtime.canActivateAR) {
      return Object.freeze({ support: 'unsupported', mode, device, reason: 'runtime-unavailable' });
    }

    return Object.freeze({ support: 'supported', mode, device, reason: 'available' });
  }
}
