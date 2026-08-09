import { useEffect, useRef, useState } from 'react';
import { registerModelViewer } from './model-viewer-runtime';

export type ViewerState = 'registering' | 'loading' | 'ready' | 'error';

interface ChairViewerProps {
  readonly modelUrl: string;
  readonly onStateChange: (state: ViewerState) => void;
}

export function ChairViewer({ modelUrl, onStateChange }: ChairViewerProps) {
  const viewerRef = useRef<HTMLElement | null>(null);
  const [registered, setRegistered] = useState(false);

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
    const viewer = viewerRef.current;
    if (!registered || !viewer) return;

    const handleLoad = () => onStateChange('ready');
    const handleError = () => onStateChange('error');
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);

    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [onStateChange, registered]);

  if (!registered) {
    return <div className="viewer-placeholder" aria-hidden="true" />;
  }

  return (
    <model-viewer
      ref={viewerRef}
      className="chair-viewer"
      src={modelUrl}
      alt="Poltrona KARV em visualização tridimensional"
      camera-controls
      disable-zoom
      interaction-prompt="none"
      camera-orbit="0deg 75deg 1.6m"
      min-camera-orbit="-180deg 35deg 0.9m"
      max-camera-orbit="180deg 90deg 3m"
      camera-target="0.266837m 0.388910m 0m"
      field-of-view="30deg"
      shadow-intensity="1"
      shadow-softness="0.9"
      exposure="1.05"
      loading="eager"
      reveal="auto"
    />
  );
}
