import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChairViewer, type ViewerState } from '../3d/ChairViewer';
import type { Core3DController } from '../3d/core-3d-controller';
import { loadCanonicalGeometry, type CanonicalGeometry } from '../3d/load-canonical-geometry';
import type { SelectionResult } from '../3d/selection-controller';
import type { CoreConfigurationSnapshot } from '../configurator/configuration-store';
import { MaterialLibraryClient } from '../materials/material-library-client';
import type { PublicMaterial } from '../materials/public-catalog';
import { DIAGNOSTIC_MATERIALS } from '../materials/runtime-material';
import { MaterialLibraryPanel, type LibraryState } from '../ui/MaterialLibraryPanel';
import { ViewerStatus } from '../ui/ViewerStatus';

const NO_SELECTION: SelectionResult = Object.freeze({ kind: 'none' });

export function App() {
  const [geometry, setGeometry] = useState<CanonicalGeometry | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('registering');
  const [core, setCore] = useState<Core3DController | null>(null);
  const [selection, setSelection] = useState<SelectionResult>(NO_SELECTION);
  const [configuration, setConfiguration] = useState<CoreConfigurationSnapshot | null>(null);
  const [library, setLibrary] = useState<LibraryState>({ status: 'loading' });
  const [selectedMaterial, setSelectedMaterial] = useState<PublicMaterial | null>(null);
  const libraryClient = useMemo(() => new MaterialLibraryClient(), []);
  const handleViewerState = useCallback((state: ViewerState) => setViewerState(state), []);

  const handleCoreReady = useCallback((nextCore: Core3DController | null) => {
    setCore(nextCore);
    setConfiguration(nextCore?.getConfiguration() ?? null);
    if (!nextCore) setSelection(NO_SELECTION);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCanonicalGeometry(controller.signal)
      .then(setGeometry)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setViewerState('error');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void libraryClient
      .load(controller.signal)
      .then(({ catalog, source }) =>
        setLibrary({
          status: 'ready',
          materials: catalog.materials,
          source,
          rejectedCount: catalog.rejectedCount,
        }),
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setLibrary({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [libraryClient]);

  const handleSelectionChange = useCallback(
    (nextSelection: SelectionResult) => setSelection(nextSelection),
    [],
  );
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

  const resetAll = () => {
    if (!core) return;
    core.resetAll();
    setConfiguration(core.getConfiguration());
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
          <p className="eyebrow">KARV · BIBLIOTECA F3</p>
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

        <aside className="core-panel" aria-label="Estado mínimo do Core 3D">
          <p className="core-panel__phase">Core F2 preservado</p>
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
              onClick={() => {
                if (core?.applySelected(DIAGNOSTIC_MATERIALS.sand)) refreshConfiguration();
              }}
            >
              Aplicar areia na peça
            </button>
            <button
              type="button"
              disabled={!core}
              onClick={() => {
                core?.applyAll(DIAGNOSTIC_MATERIALS.sand);
                refreshConfiguration();
              }}
            >
              Aplicar areia em todas
            </button>
            <button type="button" disabled={!core} onClick={resetAll}>
              Reset geral
            </button>
          </div>
        </aside>

        <MaterialLibraryPanel
          library={library}
          selected={selectedMaterial}
          onSelect={setSelectedMaterial}
        />
      </section>

      <footer className="app-footer">
        <p>
          {selectedMaterial
            ? `${selectedMaterial.name} selecionado · aplicação PBR entra na F4.`
            : 'Cor → Material → Tecido · catálogo oficial validado.'}
        </p>
      </footer>
    </main>
  );
}
