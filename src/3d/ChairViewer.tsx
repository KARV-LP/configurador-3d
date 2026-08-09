import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SurfaceMap } from '../domain/surface-map';
import { ConfigurationStore } from '../configurator/configuration-store';
import { CameraController } from './camera-controller';
import { Core3DController, type SelectionListener } from './core-3d-controller';
import { MaterialController } from './material-controller';
import { ModelViewerAdapter, type ModelViewerElementApi } from './model-viewer-adapter';
import { registerModelViewer } from './model-viewer-runtime';
import { SelectionController } from './selection-controller';
import { SurfaceRegistry } from './surface-registry';

export type ViewerState = 'registering' | 'loading' | 'ready' | 'error';

interface ChairViewerProps {
  readonly modelUrl: string;
  readonly surfaceMap: SurfaceMap;
  readonly onStateChange: (state: ViewerState) => void;
  readonly onCoreReady: (core: Core3DController | null) => void;
  readonly onSelectionChange: SelectionListener;
}

interface PointerStart {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

const TAP_DISTANCE_PX = 8;

export function ChairViewer({
  modelUrl,
  surfaceMap,
  onStateChange,
  onCoreReady,
  onSelectionChange,
}: ChairViewerProps) {
  const viewerRef = useRef<HTMLElement | null>(null);
  const coreRef = useRef<Core3DController | null>(null);
  const pointerStartRef = useRef<PointerStart | null>(null);
  const [registered, setRegistered] = useState(false);
  const camera = new CameraController(surfaceMap.camera).attributes();

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
    const viewer = viewerRef.current as ModelViewerElementApi | null;
    if (!registered || !viewer) return;

    const disposeCore = () => {
      coreRef.current?.dispose();
      coreRef.current = null;
      onCoreReady(null);
    };

    const initializeCore = () => {
      try {
        disposeCore();
        const registry = new SurfaceRegistry(surfaceMap);
        const adapter = new ModelViewerAdapter(viewer);
        const materials = new MaterialController(registry, adapter);
        materials.initialize();
        const configuration = new ConfigurationStore(
          registry.configurableSurfaces.map((surface) => surface.surfaceId),
        );
        const selection = new SelectionController(registry, adapter);
        const core = new Core3DController(selection, materials, configuration, onSelectionChange);
        coreRef.current = core;
        onCoreReady(core);
        onStateChange('ready');
      } catch {
        disposeCore();
        onStateChange('error');
      }
    };

    const handleLoad = () => initializeCore();
    const handleError = () => {
      disposeCore();
      onStateChange('error');
    };

    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    if (viewer.loaded) initializeCore();

    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
      disposeCore();
    };
  }, [onCoreReady, onSelectionChange, onStateChange, registered, surfaceMap]);

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
      camera-controls
      disable-zoom={camera.disableZoom}
      interaction-prompt="none"
      camera-orbit={camera.cameraOrbit}
      min-camera-orbit={camera.minCameraOrbit}
      max-camera-orbit={camera.maxCameraOrbit}
      camera-target={camera.cameraTarget}
      field-of-view={camera.fieldOfView}
      shadow-intensity="1"
      shadow-softness="0.9"
      exposure="1.05"
      loading="eager"
      reveal="auto"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
