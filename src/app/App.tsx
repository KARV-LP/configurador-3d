import { useCallback, useEffect, useState } from 'react';
import { ChairViewer, type ViewerState } from '../3d/ChairViewer';
import { loadCanonicalGeometry, type CanonicalGeometry } from '../3d/load-canonical-geometry';
import { ViewerStatus } from '../ui/ViewerStatus';

export function App() {
  const [geometry, setGeometry] = useState<CanonicalGeometry | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('registering');
  const handleViewerState = useCallback((state: ViewerState) => setViewerState(state), []);

  useEffect(() => {
    const controller = new AbortController();

    void loadCanonicalGeometry(controller.signal)
      .then(setGeometry)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setViewerState('error');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">KARV · FUNDAÇÃO F1</p>
          <h1>Configurador 3D</h1>
        </div>
        <p className="geometry-version">Geometria v2</p>
      </header>

      <section className="studio" aria-label="Visualização da poltrona KARV">
        <div className="studio-glow" aria-hidden="true" />
        {geometry ? (
          <ChairViewer modelUrl={geometry.modelUrl} onStateChange={handleViewerState} />
        ) : (
          <div className="viewer-placeholder" aria-hidden="true" />
        )}
        <ViewerStatus state={viewerState} />
      </section>

      <footer className="app-footer">
        <p>Base técnica canônica · interação de produto entra nas próximas fases.</p>
      </footer>
    </main>
  );
}
