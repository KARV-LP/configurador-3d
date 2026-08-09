import type { ARCapability } from './ar-capability.port';
import { ARCompatibility, type BrowserSignals } from './ar-compatibility';

export type ARPresentationStatus =
  'not-presenting' | 'session-started' | 'object-placed' | 'failed';

export interface CameraSnapshot {
  readonly orbit: string;
  readonly target: string;
  readonly fieldOfView: string;
}

interface CameraOrbitSnapshot {
  readonly radius: number;
  toString(): string;
}

interface CameraTargetSnapshot {
  toString(): string;
}

export interface ARViewerRuntime extends HTMLElement {
  readonly canActivateAR?: boolean;
  activateAR(): Promise<void> | void;
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  getCameraOrbit(): CameraOrbitSnapshot;
  getCameraTarget(): CameraTargetSnapshot;
  getFieldOfView(): number;
  jumpCameraToGoal(): void;
}

export type ARStatusListener = (status: ARPresentationStatus) => void;

export class ARController {
  private readonly compatibility: ARCompatibility;

  constructor(
    private readonly viewer: ARViewerRuntime,
    signals?: BrowserSignals,
  ) {
    this.compatibility = new ARCompatibility(viewer, signals);
  }

  detectCapability(): Promise<ARCapability> {
    return this.compatibility.detect();
  }

  activate(): Promise<void> {
    if (!this.viewer.canActivateAR) {
      return Promise.reject(new Error('RA indisponível neste dispositivo.'));
    }

    // activateAR precisa ser chamado sincronamente a partir do gesto do usuário.
    // Capturamos o retorno antes de qualquer await para preservar essa exigência.
    const activation = this.viewer.activateAR();
    return Promise.resolve(activation);
  }

  enterHandoffSideView(): CameraSnapshot {
    const snapshot = this.captureCamera();
    const orbit = this.viewer.getCameraOrbit();
    this.viewer.cameraOrbit = `90deg 75deg ${orbit.radius}m`;
    this.viewer.cameraTarget = snapshot.target;
    this.viewer.fieldOfView = snapshot.fieldOfView;
    this.viewer.jumpCameraToGoal();
    return snapshot;
  }

  restoreCamera(snapshot: CameraSnapshot): void {
    this.viewer.cameraOrbit = snapshot.orbit;
    this.viewer.cameraTarget = snapshot.target;
    this.viewer.fieldOfView = snapshot.fieldOfView;
    this.viewer.jumpCameraToGoal();
  }

  onStatus(listener: ARStatusListener): () => void {
    const handler = (event: Event) => {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      if (
        status === 'not-presenting' ||
        status === 'session-started' ||
        status === 'object-placed' ||
        status === 'failed'
      ) {
        listener(status);
      }
    };

    this.viewer.addEventListener('ar-status', handler);
    return () => this.viewer.removeEventListener('ar-status', handler);
  }

  private captureCamera(): CameraSnapshot {
    return Object.freeze({
      orbit: this.viewer.getCameraOrbit().toString(),
      target: this.viewer.getCameraTarget().toString(),
      fieldOfView: `${this.viewer.getFieldOfView()}deg`,
    });
  }
}
