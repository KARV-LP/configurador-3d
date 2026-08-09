import { describe, expect, it } from 'vitest';
import { ARCompatibility, detectARDevice, type BrowserSignals } from './ar-compatibility';

const desktop: BrowserSignals = Object.freeze({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
  platform: 'Linux x86_64',
  maxTouchPoints: 0,
});

const android: BrowserSignals = Object.freeze({
  userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/151 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
});

const iphone: BrowserSignals = Object.freeze({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
});

const ipadDesktopUa: BrowserSignals = Object.freeze({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/19.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
});

describe('ARCompatibility', () => {
  it('classifica desktop como fallback, sem inventar modo AR', async () => {
    expect(detectARDevice(desktop)).toBe('desktop');
    await expect(new ARCompatibility({ canActivateAR: true }, desktop).detect()).resolves.toEqual({
      support: 'unsupported',
      mode: null,
      device: 'desktop',
      reason: 'platform-unsupported',
    });
  });

  it('usa WebXR no Android somente quando o runtime confirma capacidade', async () => {
    await expect(new ARCompatibility({ canActivateAR: true }, android).detect()).resolves.toEqual({
      support: 'supported',
      mode: 'webxr',
      device: 'android',
      reason: 'available',
    });

    await expect(new ARCompatibility({ canActivateAR: false }, android).detect()).resolves.toEqual({
      support: 'unsupported',
      mode: 'webxr',
      device: 'android',
      reason: 'runtime-unavailable',
    });
  });

  it('usa Quick Look em iPhone e reconhece iPad com user-agent desktop', async () => {
    expect(detectARDevice(ipadDesktopUa)).toBe('ios');
    await expect(new ARCompatibility({ canActivateAR: true }, iphone).detect()).resolves.toEqual({
      support: 'supported',
      mode: 'quick-look',
      device: 'ios',
      reason: 'available',
    });
  });

  it('mantém estado unknown antes do runtime publicar canActivateAR', async () => {
    await expect(new ARCompatibility({}, android).detect()).resolves.toEqual({
      support: 'unknown',
      mode: 'webxr',
      device: 'android',
      reason: 'not-ready',
    });
  });
});
