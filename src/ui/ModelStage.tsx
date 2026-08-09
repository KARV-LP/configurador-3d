import { useEffect, useRef, useState } from 'react';
import { VIEWER_CONTRACT } from '../3d/viewer-contract';
import { CANONICAL_GEOMETRY } from '../domain/geometry';

type ViewerState = 'loading' | 'ready' | 'error';

const STATUS_LABELS: Record<ViewerState, string> = {
  loading: 'Carregando 3D',
  ready: '3D pronto',
  error: 'Falha no 3D',
};

export function ModelStage() {
  const viewerRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<ViewerState>('loading');

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;

    const handleLoad = () => setState('ready');
    const handleError = () => setState('error');

    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    viewer.setAttribute('src', CANONICAL_GEOMETRY.assetUrl);

    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <section className="model-stage" aria-label="Viewport 3D da poltrona KARV">
      <model-viewer
        ref={viewerRef}
        data-testid="karv-viewer"
        alt={CANONICAL_GEOMETRY.alt}
        camera-controls
        disable-zoom
        camera-orbit={VIEWER_CONTRACT.cameraOrbit}
        min-camera-orbit={VIEWER_CONTRACT.minCameraOrbit}
        max-camera-orbit={VIEWER_CONTRACT.maxCameraOrbit}
        camera-target={VIEWER_CONTRACT.cameraTarget}
        field-of-view={VIEWER_CONTRACT.fieldOfView}
        exposure={VIEWER_CONTRACT.exposure}
        shadow-intensity={VIEWER_CONTRACT.shadowIntensity}
        shadow-softness={VIEWER_CONTRACT.shadowSoftness}
        interaction-prompt="none"
      />
      <p className="viewer-status" data-viewer-status data-state={state} role="status">
        {STATUS_LABELS[state]}
      </p>
    </section>
  );
}
