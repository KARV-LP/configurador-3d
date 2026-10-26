import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ARController, type ARViewerRuntime } from '../ar/ar-controller';
import { ConfigurationStore } from '../configurator/configuration-store';
import type { SurfaceMap } from '../domain/surface-map';
import { CameraController } from './camera-controller';
import { Core3DController, type SelectionListener } from './core-3d-controller';
import { MaterialController } from './material-controller';
import { ModelViewerAdapter, type ModelViewerElementApi } from './model-viewer-adapter';
import { registerModelViewer } from './model-viewer-runtime';
import { PbrMaterialController } from './pbr-material-controller';
import { SelectionController } from './selection-controller';
import { SurfaceRegistry } from './surface-registry';

export type ViewerState = 'registering' | 'loading' | 'ready' | 'error';

interface ChairViewerProps {
  readonly modelUrl: string;
  readonly surfaceMap: SurfaceMap;
  readonly onStateChange: (state: ViewerState) => void;
  readonly onModelLoaded: () => void;
  readonly onCoreReady: (core: Core3DController | null) => void;
  readonly onARReady: (controller: ARController | null) => void;
  readonly onSelectionChange: SelectionListener;
}

interface PointerStart {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

const TAP_DISTANCE_PX = 8;
const VISUAL_GRAVITY_OFFSET_Y_M = -0.052;
const STUDIO_DEFAULT_POLAR_DEG = 72;
const STUDIO_MIN_POLAR_DEG = 55;
const STUDIO_MAX_POLAR_DEG = 78;
const ORBIT_SENSITIVITY = '0.65';
// Distância calibrada para manter a poltrona em no máximo ~55% do ambiente
// visível na maior aproximação, preservando amplo respiro para o painel móvel.
const STUDIO_MIN_RADIUS_M = 3.2;
const STUDIO_MAX_RADIUS_M = 4.2;
const STUDIO_DEFAULT_RADIUS_M = 3.4;
const STUDIO_MAX_HORIZONTAL_PAN_M = 0.72;
const CAMERA_TARGET_EPSILON_M = 0.000001;

function createStudioCamera(surfaceMap: SurfaceMap) {
  const base = surfaceMap.camera;
  return new CameraController({
    ...base,
    targetM: [
      base.targetM[0],
      base.targetM[1] + VISUAL_GRAVITY_OFFSET_Y_M,
      base.targetM[2],
    ] as const,
    defaultOrbit: {
      ...base.defaultOrbit,
      polarDeg: STUDIO_DEFAULT_POLAR_DEG,
      radiusM: STUDIO_DEFAULT_RADIUS_M,
    },
    limits: {
      ...base.limits,
      minPolarDeg: STUDIO_MIN_POLAR_DEG,
      maxPolarDeg: STUDIO_MAX_POLAR_DEG,
      minRadiusM: STUDIO_MIN_RADIUS_M,
      maxRadiusM: STUDIO_MAX_RADIUS_M,
    },
    zoomEnabled: true,
  }).attributes();
}

export function ChairViewer({
  modelUrl,
  surfaceMap,
  onStateChange,
  onModelLoaded,
  onCoreReady,
  onARReady,
  onSelectionChange,
}: ChairViewerProps) {
  const viewerRef = useRef<HTMLElement | null>(null);
  const coreRef = useRef<Core3DController | null>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);
  const [registered, setRegistered] = useState(false);
  const camera = useMemo(() => createStudioCamera(surfaceMap), [surfaceMap]);

  useEffect(() => {
    let active = true;
    onStateChange('registering');

    void registerModelViewer()
      .then(() => {
        if (active) {
          setRegistered(true);
          onStateChange('loading');
        }
      })
      .catch(() => {
        if (active) onStateChange('error');
      });

    return () => {
      active = false;
    };
  }, [onStateChange]);

  useEffect(() => {
    const viewer = viewerRef.current as (ModelViewerElementApi & ARViewerRuntime) | null;
    if (!registered || !viewer) return;
    const baseTarget = {
      x: surfaceMap.camera.targetM[0],
      y: surfaceMap.camera.targetM[1] + VISUAL_GRAVITY_OFFSET_Y_M,
      z: surfaceMap.camera.targetM[2],
    };
    let acceptedTarget = { ...baseTarget };

    const constrainPanToHorizontalAxis = () => {
      const current = viewer.getCameraTarget();
      const deltaX = current.x - acceptedTarget.x;
      const deltaY = current.y - acceptedTarget.y;
      const deltaZ = current.z - acceptedTarget.z;
      if (Math.hypot(deltaX, deltaY, deltaZ) <= CAMERA_TARGET_EPSILON_M) return;

      const theta = viewer.getCameraOrbit().theta;
      const horizontalAxisX = -Math.cos(theta);
      const horizontalAxisZ = Math.sin(theta);
      const horizontalDelta = deltaX * horizontalAxisX + deltaZ * horizontalAxisZ;
      let nextX = acceptedTarget.x + horizontalAxisX * horizontalDelta;
      let nextZ = acceptedTarget.z + horizontalAxisZ * horizontalDelta;
      const offsetX = nextX - baseTarget.x;
      const offsetZ = nextZ - baseTarget.z;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance > STUDIO_MAX_HORIZONTAL_PAN_M) {
        const scale = STUDIO_MAX_HORIZONTAL_PAN_M / distance;
        nextX = baseTarget.x + offsetX * scale;
        nextZ = baseTarget.z + offsetZ * scale;
      }

      acceptedTarget = { x: nextX, y: baseTarget.y, z: nextZ };
      const correction = Math.hypot(
        current.x - acceptedTarget.x,
        current.y - acceptedTarget.y,
        current.z - acceptedTarget.z,
      );
      if (correction <= CAMERA_TARGET_EPSILON_M) return;
      viewer.cameraTarget = `${acceptedTarget.x}m ${acceptedTarget.y}m ${acceptedTarget.z}m`;
      viewer.jumpCameraToGoal();
    };

    const disposeRuntime = () => {
      coreRef.current?.dispose();
      coreRef.current = null;
      onCoreReady(null);
      onARReady(null);
    };

    const initializeCore = () => {
      onModelLoaded();
      try {
        disposeRuntime();
        const registry = new SurfaceRegistry(surfaceMap);
        const adapter = new ModelViewerAdapter(viewer);
        const materials = new MaterialController(registry, adapter);
        materials.initialize();
        const pbr = new PbrMaterialController(registry, adapter);
        pbr.initialize();
        const configuration = new ConfigurationStore(
          registry.configurableSurfaces.map((surface) => surface.surfaceId),
        );
        const selection = new SelectionController(registry, adapter);
        const core = new Core3DController(
          selection,
          materials,
          configuration,
          onSelectionChange,
          pbr,
        );
        coreRef.current = core;
        onCoreReady(core);
        onARReady(new ARController(viewer));
        onStateChange('ready');
      } catch {
        disposeRuntime();
        onStateChange('error');
      }
    };

    const handleLoad = () => initializeCore();
    const handleError = () => {
      disposeRuntime();
      onStateChange('error');
    };

    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    viewer.addEventListener('camera-change', constrainPanToHorizontalAxis);
    if (viewer.loaded) initializeCore();

    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
      viewer.removeEventListener('camera-change', constrainPanToHorizontalAxis);
      disposeRuntime();
    };
  }, [
    onARReady,
    onCoreReady,
    onModelLoaded,
    onSelectionChange,
    onStateChange,
    registered,
    surfaceMap,
  ]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    pointerStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
    if (distance <= TAP_DISTANCE_PX) {
      coreRef.current?.selectAt(event.clientX, event.clientY);
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  if (!registered) {
    return <div className="viewer-placeholder" aria-hidden="true" />;
  }

  return (
    <model-viewer
      ref={viewerRef}
      className="chair-viewer"
      data-testid="karv-viewer"
      src={modelUrl}
      alt="Poltrona KARV em visualização tridimensional"
      ar
      ar-modes="webxr quick-look"
      ar-scale="fixed"
      ar-placement="floor"
      xr-environment
      camera-controls
      disable-zoom={camera.disableZoom}
      orbit-sensitivity={ORBIT_SENSITIVITY}
      interaction-prompt="none"
      camera-orbit={camera.cameraOrbit}
      min-camera-orbit={camera.minCameraOrbit}
      max-camera-orbit={camera.maxCameraOrbit}
      camera-target={camera.cameraTarget}
      field-of-view={camera.fieldOfView}
      shadow-intensity="1.65"
      shadow-softness="0.5"
      exposure="0.98"
      loading="eager"
      reveal="auto"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
