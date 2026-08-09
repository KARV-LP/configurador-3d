import type { CameraContract, CameraOrbit } from '../domain/surface-map';

export interface CameraAttributes {
  readonly cameraOrbit: string;
  readonly minCameraOrbit: string;
  readonly maxCameraOrbit: string;
  readonly cameraTarget: string;
  readonly fieldOfView: string;
  readonly disableZoom: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class CameraController {
  constructor(readonly contract: CameraContract) {}

  clampOrbit(orbit: CameraOrbit): CameraOrbit {
    const { limits } = this.contract;
    return Object.freeze({
      azimuthDeg: clamp(orbit.azimuthDeg, limits.minAzimuthDeg, limits.maxAzimuthDeg),
      polarDeg: clamp(orbit.polarDeg, limits.minPolarDeg, limits.maxPolarDeg),
      radiusM: clamp(orbit.radiusM, limits.minRadiusM, limits.maxRadiusM),
    });
  }

  attributes(): CameraAttributes {
    const { contract } = this;
    return Object.freeze({
      cameraOrbit: this.formatOrbit(contract.defaultOrbit),
      minCameraOrbit: this.formatOrbit({
        azimuthDeg: contract.limits.minAzimuthDeg,
        polarDeg: contract.limits.minPolarDeg,
        radiusM: contract.limits.minRadiusM,
      }),
      maxCameraOrbit: this.formatOrbit({
        azimuthDeg: contract.limits.maxAzimuthDeg,
        polarDeg: contract.limits.maxPolarDeg,
        radiusM: contract.limits.maxRadiusM,
      }),
      cameraTarget: `${contract.targetM[0]}m ${contract.targetM[1]}m ${contract.targetM[2]}m`,
      fieldOfView: `${contract.fieldOfViewDeg}deg`,
      disableZoom: !contract.zoomEnabled,
    });
  }

  formatOrbit(orbit: CameraOrbit): string {
    return `${orbit.azimuthDeg}deg ${orbit.polarDeg}deg ${orbit.radiusM}m`;
  }
}
