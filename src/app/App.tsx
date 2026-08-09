import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChairViewer, type ViewerState } from '../3d/ChairViewer';
import type { Core3DController } from '../3d/core-3d-controller';
import { loadCanonicalGeometry, type CanonicalGeometry } from '../3d/load-canonical-geometry';
import type { SelectionResult } from '../3d/selection-controller';
import type { CoreConfigurationSnapshot } from '../configurator/configuration-store';
import { DIAGNOSTIC_MATERIALS } from '../materials/runtime-material';
import { ViewerStatus } from '../ui/ViewerStatus';

const NO_SELECTION: SelectionResult = Object.freeze({ kind: 'none' });

export function App() {
  const [geometry, setGeometry] = useState<CanonicalGeometry | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('registering');
  const [core, setCore] = useState<Core3DController | null>(null);
  const [selection, setSelection] = useState<SelectionResult>(NO_SELECTION);
  const [configuration, setConfiguration] = useState<CoreConfigurationSnapshot | null>(null);
  const handleViewerState = useCallback((state: ViewerState) => setViewerState(state), []);

  const handleCoreReady = useCallback((nextCore: Core3DController | null) => {
    setCore(nextCore);
    setConfiguration(nextCore?.getConfiguration() ?? null);
    if (!nextCore) setSelection(NO_SELECTION);
  }, []);

  const handleSelectionChange = useCallback((nextSelection: SelectionResult) => {
    setSelection(nextSelection);
  }, []);

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

  const assignedCount = useMemo(
    () => Object.values(configuration?.assignments ?? {}).filter(Boolean).length,
    [configuration],
  );
  const totalConfigurable = geometry?.surfaceMap.surfaces.filter(
    (surface) => surface.classification === 'configurable',
  ).length;
  const canApplyToPiece = selection.kind === 'configurable' && core !== null;

  const refreshConfiguration = useCallback(() => {
    if (core) setConfiguration(core.getConfiguration());
  }, [core]);

  const applySelected = (
    material: (typeof DIAGNOSTIC_MATERIALS)[keyof typeof DIAGNOSTIC_MATERIALS],
  ) => {
    if (core?.applySelected(material)) refreshConfiguration();
  };

  const applyAll = () => {
    if (!core) return;
    core.applyAll(DIAGNOSTIC_MATERIALS.sand);
    refreshConfiguration();
  };

  const resetSelected = () => {
    if (core?.resetSelected()) refreshConfiguration();
  };

  const resetAll = () => {
    if (!core) return;
    core.resetAll();
    refreshConfiguration();
  };

  const selectionLabel =
    selection.kind === 'none'
      ? 'Toque em uma área estofada'
      : selection.kind === 'fixed'
        ? `${selection.publicName} é uma parte fixa`
        : `Selecionado: ${selection.publicName}`;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">KARV · CORE F2</p>
          <h1>Configurador 3D</h1>
        </div>
        <p className="geometry-version">Geometria v2</p>
      </header>

      <section className="studio" aria-label="Visualização da poltrona KARV">
        <div className="studio-glow" aria-hidden="true" />
        {geometry ? (
          <ChairViewer
            modelUrl={geometry.modelUrl}
            surfaceMap={geometry.surfaceMap}
            onStateChange={handleViewerState}
            onCoreReady={handleCoreReady}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="viewer-placeholder" aria-hidden="true" />
        )}
        <ViewerStatus state={viewerState} />

        <aside className="core-panel" aria-label="Controles mínimos do Core 3D">
          <p className="core-panel__phase">Validação F2</p>
          <p className="core-panel__selection" data-testid="selection-status">
            {selectionLabel}
          </p>
          <p className="core-panel__count" data-testid="assigned-count">
            {assignedCount}/{totalConfigurable ?? 0} superfícies com material de teste
          </p>
          <div className="core-panel__actions">
            <button
              type="button"
              disabled={!canApplyToPiece}
              onClick={() => applySelected(DIAGNOSTIC_MATERIALS.sand)}
            >
              Aplicar areia na peça
            </button>
            <button
              type="button"
              disabled={!canApplyToPiece}
              onClick={() => applySelected(DIAGNOSTIC_MATERIALS.graphite)}
            >
              Aplicar grafite na peça
            </button>
            <button type="button" disabled={!core} onClick={applyAll}>
              Aplicar areia em todas
            </button>
            <button type="button" disabled={!canApplyToPiece} onClick={resetSelected}>
              Reset peça
            </button>
            <button type="button" disabled={!core} onClick={resetAll}>
              Reset geral
            </button>
          </div>
        </aside>
      </section>

      <footer className="app-footer">
        <p>Core desacoplado · seleção, estado, aplicação e reset por API interna.</p>
      </footer>
    </main>
  );
}
