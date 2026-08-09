import { describe, expect, it, vi } from 'vitest';
import { ARController, type ARViewerRuntime } from './ar-controller';
import type { BrowserSignals } from './ar-compatibility';

class FakeARViewer extends EventTarget {
  canActivateAR = true;
  cameraOrbit = '12deg 70deg 1.75m';
  cameraTarget = '0.2m 0.4m 0m';
  fieldOfView = '31deg';
  readonly activateSpy = vi.fn(() => Promise.resolve());
  readonly jumpSpy = vi.fn();

  activateAR(): Promise<void> {
    return this.activateSpy();
  }

  getCameraOrbit() {
    const current = this.cameraOrbit;
    const radius = Number(current.split(' ')[2]?.replace('m', '') ?? 1.75);
    return { radius, toString: () => current };
  }

  getCameraTarget() {
    const current = this.cameraTarget;
    return { toString: () => current };
  }

  getFieldOfView(): number {
    return Number(this.fieldOfView.replace('deg', ''));
  }

  jumpCameraToGoal(): void {
    this.jumpSpy();
  }
}

function runtime(viewer: FakeARViewer): ARViewerRuntime {
  return viewer as unknown as ARViewerRuntime;
}

const android: BrowserSignals = Object.freeze({
  userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/151 Mobile',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
});

describe('ARController', () => {
  it('ativa AR no mesmo turno da chamada antes de aguardar a promise', () => {
    const viewer = new FakeARViewer();
    const controller = new ARController(runtime(viewer), android);

    const activation = controller.activate();
    expect(viewer.activateSpy).toHaveBeenCalledTimes(1);
    return expect(activation).resolves.toBeUndefined();
  });

  it('bloqueia ativação quando canActivateAR é falso', async () => {
    const viewer = new FakeARViewer();
    viewer.canActivateAR = false;
    const controller = new ARController(runtime(viewer), android);

    await expect(controller.activate()).rejects.toThrow('RA indisponível');
    expect(viewer.activateSpy).not.toHaveBeenCalled();
  });

  it('entra em vista lateral e restaura câmera exatamente', () => {
    const viewer = new FakeARViewer();
    const controller = new ARController(runtime(viewer), android);
    const snapshot = controller.enterHandoffSideView();

    expect(snapshot).toEqual({
      orbit: '12deg 70deg 1.75m',
      target: '0.2m 0.4m 0m',
      fieldOfView: '31deg',
    });
    expect(viewer.cameraOrbit).toBe('90deg 75deg 1.75m');
    expect(viewer.cameraTarget).toBe('0.2m 0.4m 0m');
    expect(viewer.fieldOfView).toBe('31deg');

    controller.restoreCamera(snapshot);
    expect(viewer.cameraOrbit).toBe('12deg 70deg 1.75m');
    expect(viewer.cameraTarget).toBe('0.2m 0.4m 0m');
    expect(viewer.fieldOfView).toBe('31deg');
    expect(viewer.jumpSpy).toHaveBeenCalledTimes(2);
  });

  it('normaliza apenas estados AR conhecidos', () => {
    const viewer = new FakeARViewer();
    const controller = new ARController(runtime(viewer), android);
    const statuses: string[] = [];
    const dispose = controller.onStatus((status) => statuses.push(status));

    viewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'session-started' } }));
    viewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'unexpected' } }));
    viewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'object-placed' } }));
    dispose();
    viewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'failed' } }));

    expect(statuses).toEqual(['session-started', 'object-placed']);
  });
});
