import type { CanonicalGeometryManifest } from './geometry-manifest';

export type SurfaceClassification = 'configurable' | 'fixed';

export interface SurfaceBinding {
  readonly meshName: string;
  readonly materialName: string;
  readonly primitiveIndex: number;
  readonly requiresMaterialInstance: boolean;
}

export interface TextureFrame {
  readonly uvSet: number;
  readonly uvName: string;
  readonly rotationDegrees: 0 | 90 | 180 | 270;
  readonly flipU: boolean;
  readonly flipV: boolean;
  readonly metersPerUvUnit: number;
  readonly calibrationMethod: 'area-ratio' | 'manual';
  readonly calibrationStatus: 'derived' | 'visual-approved';
}

export interface SurfaceDescriptor {
  readonly surfaceId: string;
  readonly publicName: string;
  readonly publicGroup: string;
  readonly classification: SurfaceClassification;
  readonly binding: SurfaceBinding;
  readonly textureFrame?: TextureFrame;
}

export interface CameraOrbit {
  readonly azimuthDeg: number;
  readonly polarDeg: number;
  readonly radiusM: number;
}

export interface CameraLimits {
  readonly minAzimuthDeg: number;
  readonly maxAzimuthDeg: number;
  readonly minPolarDeg: number;
  readonly maxPolarDeg: number;
  readonly minRadiusM: number;
  readonly maxRadiusM: number;
}

export interface CameraContract {
  readonly targetM: readonly [number, number, number];
  readonly defaultOrbit: CameraOrbit;
  readonly limits: CameraLimits;
  readonly fieldOfViewDeg: number;
  readonly zoomEnabled: boolean;
  readonly autoRotate: boolean;
}

export interface SurfaceMap {
  readonly schemaVersion: 1;
  readonly geometry: {
    readonly id: string;
    readonly version: number;
    readonly sha256: string;
  };
  readonly camera: CameraContract;
  readonly surfaces: readonly SurfaceDescriptor[];
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Surface map inválido: ${label}.`);
  }
  return value as JsonRecord;
}

function stringValue(source: JsonRecord, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Surface map inválido: ${key}.`);
  }
  return value;
}

function numberValue(source: JsonRecord, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Surface map inválido: ${key}.`);
  }
  return value;
}

function booleanValue(source: JsonRecord, key: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Surface map inválido: ${key}.`);
  }
  return value;
}

function integerValue(source: JsonRecord, key: string): number {
  const value = numberValue(source, key);
  if (!Number.isInteger(value)) {
    throw new Error(`Surface map inválido: ${key}.`);
  }
  return value;
}

function vector3(value: unknown): readonly [number, number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))
  ) {
    throw new Error('Surface map inválido: target_m.');
  }
  return Object.freeze([value[0], value[1], value[2]]) as readonly [number, number, number];
}

function parseTextureFrame(value: unknown): TextureFrame {
  const source = record(value, 'texture_frame');
  const rotation = integerValue(source, 'rotation_degrees');
  if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
    throw new Error('Surface map inválido: rotation_degrees.');
  }
  const calibrationMethod = stringValue(source, 'calibration_method');
  if (calibrationMethod !== 'area-ratio' && calibrationMethod !== 'manual') {
    throw new Error('Surface map inválido: calibration_method.');
  }
  const calibrationStatus = stringValue(source, 'calibration_status');
  if (calibrationStatus !== 'derived' && calibrationStatus !== 'visual-approved') {
    throw new Error('Surface map inválido: calibration_status.');
  }

  return Object.freeze({
    uvSet: integerValue(source, 'uv_set'),
    uvName: stringValue(source, 'uv_name'),
    rotationDegrees: rotation,
    flipU: booleanValue(source, 'flip_u'),
    flipV: booleanValue(source, 'flip_v'),
    metersPerUvUnit: numberValue(source, 'meters_per_uv_unit'),
    calibrationMethod,
    calibrationStatus,
  });
}

function parseSurface(value: unknown): SurfaceDescriptor {
  const source = record(value, 'surface');
  const classification = stringValue(source, 'classification');
  if (classification !== 'configurable' && classification !== 'fixed') {
    throw new Error('Surface map inválido: classification.');
  }
  const bindingSource = record(source.binding, 'binding');
  const descriptor = {
    surfaceId: stringValue(source, 'surface_id'),
    publicName: stringValue(source, 'public_name'),
    publicGroup: stringValue(source, 'public_group'),
    classification,
    binding: Object.freeze({
      meshName: stringValue(bindingSource, 'mesh_name'),
      materialName: stringValue(bindingSource, 'material_name'),
      primitiveIndex: integerValue(bindingSource, 'primitive_index'),
      requiresMaterialInstance: booleanValue(bindingSource, 'requires_material_instance'),
    }),
  } as const;

  if (classification === 'configurable') {
    return Object.freeze({ ...descriptor, textureFrame: parseTextureFrame(source.texture_frame) });
  }
  if (source.texture_frame !== undefined) {
    throw new Error('Surface map inválido: superfície fixa não pode definir texture_frame.');
  }
  return Object.freeze(descriptor);
}

function parseCamera(value: unknown): CameraContract {
  const source = record(value, 'camera');
  const orbit = record(source.default_orbit, 'default_orbit');
  const limits = record(source.limits, 'limits');
  return Object.freeze({
    targetM: vector3(source.target_m),
    defaultOrbit: Object.freeze({
      azimuthDeg: numberValue(orbit, 'azimuth_deg'),
      polarDeg: numberValue(orbit, 'polar_deg'),
      radiusM: numberValue(orbit, 'radius_m'),
    }),
    limits: Object.freeze({
      minAzimuthDeg: numberValue(limits, 'min_azimuth_deg'),
      maxAzimuthDeg: numberValue(limits, 'max_azimuth_deg'),
      minPolarDeg: numberValue(limits, 'min_polar_deg'),
      maxPolarDeg: numberValue(limits, 'max_polar_deg'),
      minRadiusM: numberValue(limits, 'min_radius_m'),
      maxRadiusM: numberValue(limits, 'max_radius_m'),
    }),
    fieldOfViewDeg: numberValue(source, 'field_of_view_deg'),
    zoomEnabled: booleanValue(source, 'zoom_enabled'),
    autoRotate: booleanValue(source, 'auto_rotate'),
  });
}

export function parseSurfaceMap(value: unknown, manifest: CanonicalGeometryManifest): SurfaceMap {
  const source = record(value, 'root');
  const schemaVersion = integerValue(source, 'schema_version');
  if (schemaVersion !== 1) {
    throw new Error('Versão de surface map incompatível.');
  }
  const geometry = record(source.geometry, 'geometry');
  const geometryId = stringValue(geometry, 'id');
  const geometryVersion = integerValue(geometry, 'version');
  const sha256 = stringValue(geometry, 'sha256');
  if (
    geometryId !== manifest.geometryId ||
    geometryVersion !== manifest.geometryVersion ||
    sha256 !== manifest.sha256
  ) {
    throw new Error('Surface map incompatível com a geometria canônica.');
  }
  if (!Array.isArray(source.surfaces) || source.surfaces.length === 0) {
    throw new Error('Surface map sem superfícies.');
  }
  const surfaces = source.surfaces.map(parseSurface);
  const ids = new Set(surfaces.map((surface) => surface.surfaceId));
  if (ids.size !== surfaces.length) {
    throw new Error('Surface map contém surface_id duplicado.');
  }

  return Object.freeze({
    schemaVersion: 1,
    geometry: Object.freeze({ id: geometryId, version: geometryVersion, sha256 }),
    camera: parseCamera(source.camera),
    surfaces: Object.freeze(surfaces),
  });
}
