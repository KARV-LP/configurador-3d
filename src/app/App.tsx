import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ARCapability } from '../ar/ar-capability.port';
import {
  ARController,
  type ARPresentationStatus,
  type CameraSnapshot,
} from '../ar/ar-controller';
import { createARHandoffUrl, createQRHandoff, hasARIntent, type QRHandoffPayload } from '../ar/qr-handoff';
import { ChairViewer, type ViewerState } from '../3d/ChairViewer';
import type { Core3DController } from '../3d/core-3d-controller';
import { loadCanonicalGeometry, type CanonicalGeometry } from '../3d/load-canonical-geometry';
import type { SelectionResult } from '../3d/selection-controller';
import { ConfigSerializer } from '../configurator/config-serializer';
import { resolveConfigurationMaterials } from '../configurator/configuration-restorer';
import {
  ConfigurationSession,
  type ConfigurationStorage,
} from '../configurator/configuration-session';
import type { CoreConfigurationSnapshot } from '../configurator/configuration-store';
import { MaterialLibraryClient } from '../materials/material-library-client';
import { toProductionPbrMaterial } from '../materials/pbr-material';
import type { PublicMaterial } from '../materials/public-catalog';
import { ARExperiencePanel, type ARExperienceKind } from '../ui/ARExperiencePanel';
import {
  MaterialLibraryPanel,
  type LibraryState,
  type MaterialApplyState,
} from '../ui/MaterialLibraryPanel';
import {
  ConfigurationSummary,
  type ConfigurationSummaryItem,
  type ShareConfigurationState,
} from '../ui/ConfigurationSummary';
import { ViewerStatus } from '../ui/ViewerStatus';

const NO_SELECTION: SelectionResult = Object.freeze({ kind: 'none' });
type HydrationState = 'waiting' | 'restoring' | 'ready';
type ConfigurationNotice = 'restored' | 'invalid' | null;

type ARPanelState =
  | { readonly kind: 'desktop-qr'; readonly handoff: QRHandoffPayload | null }
  | { readonly kind: 'unsupported' | 'error'; readonly handoffUrl: string | null }
  | null;

interface ARUiSnapshot {
  readonly materialsOpen: boolean;
  readonly summaryOpen: boolean;
  readonly camera: CameraSnapshot;
}

function getBrowserStorage(): ConfigurationStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function App() {
  const [geometry, setGeometry] = useState<CanonicalGeometry | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('registering');
  const [core, setCore] = useState<Core3DController | null>(null);
  const [selection, setSelection] = useState<SelectionResult>(NO_SELECTION);
  const [configuration, setConfiguration] = useState<CoreConfigurationSnapshot | null>(null);
  const [library, setLibrary] = useState<LibraryState>({ status: 'loading' });
  const [selectedMaterial, setSelectedMaterial] = useState<PublicMaterial | null>(null);
  const [applyState, setApplyState] = useState<MaterialApplyState>('idle');
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [hydrationState, setHydrationState] = useState<HydrationState>('waiting');
  const [configurationNotice, setConfigurationNotice] = useState<ConfigurationNotice>(null);
  const [shareState, setShareState] = useState<ShareConfigurationState>('idle');
  const [arController, setARController] = useState<ARController | null>(null);
  const [arCapability, setARCapability] = useState<ARCapability | null>(null);
  const [arStatus, setARStatus] = useState<ARPresentationStatus>('not-presenting');
  const [arPanel, setARPanel] = useState<ARPanelState>(null);
  const [arIntentDismissed, setARIntentDismissed] = useState(false);
  const [arIntentRequested] = useState(() => hasARIntent(window.location.href));
  const arControllerRef = useRef<ARController | null>(null);
  const arUiSnapshotRef = useRef<ARUiSnapshot | null>(null);
  const arHandoffRequestRef = useRef(0);
  const libraryClient = useMemo(() => new MaterialLibraryClient(), []);
  const selectedPbr = useMemo(
    () => (selectedMaterial ? toProductionPbrMaterial(selectedMaterial) : null),
    [selectedMaterial],
  );

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

  useEffect(() => {
    const controller = new AbortController();
    void libraryClient
      .load(controller.signal)
      .then(({ catalog, source }) => {
        setLibrary({
          status: 'ready',
          materials: catalog.materials,
          source,
          rejectedCount: catalog.rejectedCount,
        });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLibrary({ status: 'unavailable' });
        }
      });
    return () => controller.abort();
  }, [libraryClient]);

  const configurationSession = useMemo(() => {
    if (!geometry) return null;
    const surfaceIds = geometry.surfaceMap.surfaces
      .filter((surface) => surface.classification === 'configurable')
      .map((surface) => surface.surfaceId);
    return new ConfigurationSession(
      new ConfigSerializer(geometry.manifest, surfaceIds),
      getBrowserStorage(),
    );
  }, [geometry]);

  const handleCoreReady = useCallback((nextCore: Core3DController | null) => {
    setCore(nextCore);
    setConfiguration(nextCore?.getConfiguration() ?? null);
    setHydrationState('waiting');
    setShareState('idle');
    if (!nextCore) setSelection(NO_SELECTION);
  }, []);

  const handleARReady = useCallback((nextController: ARController | null) => {
    arControllerRef.current = nextController;
    setARController(nextController);
    setARCapability(null);
    setARStatus('not-presenting');

    if (!nextController) return;
    void nextController.detectCapability().then((capability) => {
      if (arControllerRef.current === nextController) setARCapability(capability);
    });
  }, []);

  useEffect(() => {
    if (!arController) return;
    return arController.onStatus(setARStatus);
  }, [arController]);

  const handleSelectionChange = useCallback((nextSelection: SelectionResult) => {
    setSelection(nextSelection);
    setApplyState('idle');
    if (nextSelection.kind === 'configurable') {
      setSummaryOpen(false);
      window.setTimeout(() => setMaterialsOpen(true), 0);
    }
  }, []);

  useEffect(() => {
    if (
      hydrationState !== 'waiting' ||
      !core ||
      !configurationSession ||
      library.status !== 'ready'
    ) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        const candidate = configurationSession.resolve(window.location.href);
        if (candidate.kind === 'valid') {
          try {
            const resolved = resolveConfigurationMaterials(candidate.payload, library.materials);
            await core.restorePbrConfiguration(resolved);
            if (!active) return;
            setConfiguration(core.getConfiguration());
            setConfigurationNotice(candidate.source === 'url' ? 'restored' : null);
          } catch {
            if (!active) return;
            configurationSession.clear();
            setConfiguration(core.getConfiguration());
            setConfigurationNotice('invalid');
          }
        } else if (candidate.kind === 'invalid') {
          configurationSession.clear();
          setConfiguration(core.getConfiguration());
          setConfigurationNotice('invalid');
        } else {
          setConfigurationNotice(null);
        }

        if (active) setHydrationState('ready');
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [configurationSession, core, hydrationState, library]);

  useEffect(() => {
    if (hydrationState !== 'ready' || !configurationSession || !configuration) return;
    const token = configurationSession.persist(configuration);
    const syncedUrl = configurationSession.syncExistingShareUrl(window.location.href, token);
    if (syncedUrl && syncedUrl !== window.location.href) {
      window.history.replaceState(window.history.state, '', syncedUrl);
    }
  }, [configuration, configurationSession, hydrationState]);

  const refreshConfiguration = useCallback(() => {
    if (core) {
      setConfiguration(core.getConfiguration());
      setConfigurationNotice(null);
      setShareState('idle');
    }
  }, [core]);

  const materialById = useMemo(() => {
    const materials = library.status === 'ready' ? library.materials : [];
    return new Map(materials.map((material) => [material.id, material]));
  }, [library]);

  const surfaceNameById = useMemo(() => {
    const surfaces = geometry?.surfaceMap.surfaces ?? [];
    return new Map(
      surfaces
        .filter((surface) => surface.classification === 'configurable')
        .map((surface) => [surface.surfaceId, surface.publicName]),
    );
  }, [geometry]);

  const summaryItems = useMemo<readonly ConfigurationSummaryItem[]>(() => {
    if (!configuration) return [];
    return Object.entries(configuration.assignments)
      .filter(([, materialId]) => materialId !== null)
      .map(([surfaceId, materialId]) => ({
        surfaceName: surfaceNameById.get(surfaceId) ?? 'Área configurada',
        materialName: materialId ? (materialById.get(materialId)?.name ?? 'Material aplicado') : '',
      }));
  }, [configuration, materialById, surfaceNameById]);

  const totalConfigurable =
    geometry?.surfaceMap.surfaces.filter((surface) => surface.classification === 'configurable')
      .length ?? 0;
  const assignedCount = summaryItems.length;
  const selectedSurfaceName = selection.kind === 'configurable' ? selection.publicName : null;
  const canApplySelected =
    hydrationState === 'ready' &&
    selection.kind === 'configurable' &&
    core !== null &&
    selectedPbr !== null;
  const canApplyAll = hydrationState === 'ready' && core !== null && selectedPbr !== null;
  const arReady = hydrationState === 'ready' && arController !== null && arCapability !== null;

  const applySelected = async () => {
    if (!core || !selectedPbr || selection.kind !== 'configurable') return;
    setApplyState('loading');
    try {
      const applied = await core.applyPbrSelected(selectedPbr);
      setApplyState(applied ? 'applied' : 'idle');
      refreshConfiguration();
    } catch {
      setApplyState('error');
    }
  };

  const applyAll = async () => {
    if (!core || !selectedPbr) return;
    setApplyState('loading');
    try {
      await core.applyPbrAll(selectedPbr);
      setApplyState('applied');
      refreshConfiguration();
    } catch {
      setApplyState('error');
    }
  };

  const resetSelected = () => {
    if (!core?.resetSelected()) return;
    setApplyState('idle');
    refreshConfiguration();
  };

  const resetAll = () => {
    if (!core) return;
    core.resetAll();
    setApplyState('idle');
    refreshConfiguration();
  };

  const shareConfiguration = async () => {
    if (!configurationSession || !configuration || assignedCount === 0) return;
    const shareUrl = configurationSession.createShareUrl(window.location.href, configuration);
    window.history.replaceState(window.history.state, '', shareUrl);

    try {
      if (!navigator.clipboard?.writeText) {
        setShareState('ready');
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareState('copied');
    } catch {
      setShareState('error');
    }
  };

  const currentARHandoffUrl = useCallback((): string | null => {
    if (!configurationSession || !configuration) return null;
    return createARHandoffUrl(window.location.href, configurationSession, configuration);
  }, [configuration, configurationSession]);

  const activateMobileAR = useCallback(() => {
    if (!arController || arCapability?.support !== 'supported') return;
    const activation = arController.activate();
    void activation.catch(() => setARStatus('failed'));
  }, [arCapability, arController]);

  const openARExperience = () => {
    if (!arReady || !arController || !arCapability || !configurationSession || !configuration) {
      setARPanel({ kind: 'error', handoffUrl: currentARHandoffUrl() });
      return;
    }

    if (arCapability.device !== 'desktop') {
      if (arCapability.support === 'supported') {
        activateMobileAR();
      } else {
        setARPanel({ kind: 'unsupported', handoffUrl: currentARHandoffUrl() });
      }
      return;
    }

    const requestId = arHandoffRequestRef.current + 1;
    arHandoffRequestRef.current = requestId;
    arUiSnapshotRef.current = Object.freeze({
      materialsOpen,
      summaryOpen,
      camera: arController.enterHandoffSideView(),
    });
    setMaterialsOpen(false);
    setSummaryOpen(false);
    setARPanel({ kind: 'desktop-qr', handoff: null });

    void createQRHandoff(window.location.href, configurationSession, configuration)
      .then((handoff) => {
        if (arHandoffRequestRef.current === requestId) {
          setARPanel({ kind: 'desktop-qr', handoff });
        }
      })
      .catch(() => {
        if (arHandoffRequestRef.current === requestId) {
          setARPanel({ kind: 'error', handoffUrl: currentARHandoffUrl() });
        }
      });
  };

  const closeARExperience = () => {
    arHandoffRequestRef.current += 1;
    const snapshot = arUiSnapshotRef.current;
    arUiSnapshotRef.current = null;
    if (snapshot && arController) {
      arController.restoreCamera(snapshot.camera);
      setMaterialsOpen(snapshot.materialsOpen);
      setSummaryOpen(snapshot.summaryOpen);
    }
    setARPanel(null);
    setARIntentDismissed(true);
  };

  const copyARHandoffUrl = async () => {
    const url = arPanel?.kind === 'desktop-qr' ? arPanel.handoff?.url : arPanel?.handoffUrl;
    const handoffUrl = url ?? currentARHandoffUrl();
    if (!handoffUrl || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(handoffUrl);
    } catch {
      // O QR e o link continuam válidos mesmo sem acesso ao clipboard.
    }
  };

  const selectionLabel =
    selection.kind === 'none'
      ? 'Toque em uma área da poltrona para personalizar'
      : selection.kind === 'fixed'
        ? `${selection.publicName} mantém o acabamento original`
        : `${selection.publicName} selecionado`;

  const openMaterials = () => {
    setSummaryOpen(false);
    setMaterialsOpen(true);
  };

  const openSummary = () => {
    setMaterialsOpen(false);
    setSummaryOpen(true);
  };

  const mobileIntentVisible =
    arIntentRequested &&
    !arIntentDismissed &&
    hydrationState === 'ready' &&
    arCapability !== null &&
    arCapability.device !== 'desktop' &&
    arPanel === null;

  const renderARPanel = (
    kind: ARExperienceKind,
    support: ARCapability['support'],
    mode: ARCapability['mode'],
    qrSvg: string | null,
    handoffUrl: string | null,
  ) => (
    <ARExperiencePanel
      kind={kind}
      support={support}
      mode={mode}
      status={arStatus}
      qrSvg={qrSvg}
      handoffUrl={handoffUrl}
      onActivate={activateMobileAR}
      onCopy={() => void copyARHandoffUrl()}
      onClose={closeARExperience}
    />
  );

  return (
    <main className="configurator-shell">
      <header className="configurator-header">
        <div className="brand-lockup" aria-label="KARV configurador">
          <span className="brand-mark">KARV</span>
          <span className="brand-context">Configure sua poltrona</span>
        </div>

        <div className="header-actions">
          <button type="button" className="header-action" aria-label="Resumo" onClick={openSummary}>
            Resumo
            <span className="header-count" aria-label={`${assignedCount} áreas configuradas`}>
              {assignedCount}
            </span>
          </button>
          <button
            type="button"
            className="header-action header-action--primary"
            disabled={!arReady}
            aria-busy={!arReady}
            onClick={openARExperience}
          >
            Ver no ambiente
            <span className="header-action__badge">RA</span>
          </button>
        </div>
      </header>

      <section className="configurator-stage" aria-label="Poltrona KARV em 3D">
        <div className="studio-light studio-light--top" aria-hidden="true" />
        <div className="studio-light studio-light--floor" aria-hidden="true" />

        {geometry ? (
          <ChairViewer
            modelUrl={geometry.modelUrl}
            surfaceMap={geometry.surfaceMap}
            onStateChange={setViewerState}
            onCoreReady={handleCoreReady}
            onARReady={handleARReady}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="viewer-placeholder" aria-hidden="true" />
        )}

        <ViewerStatus state={viewerState} />

        <div
          className={`selection-status selection-status--${selection.kind}`}
          data-testid="selection-status"
          aria-live="polite"
        >
          <span className="selection-status__dot" aria-hidden="true" />
          <span>{selectionLabel}</span>
        </div>

        <div className="stage-instruction" aria-hidden={selection.kind !== 'none'}>
          <span>Selecione uma área</span>
          <small>Depois escolha cor, material e tecido</small>
        </div>

        <nav className="stage-dock" aria-label="Ações do configurador">
          <button type="button" onClick={openMaterials} aria-expanded={materialsOpen}>
            <span className="dock-icon" aria-hidden="true">
              ◫
            </span>
            Materiais
          </button>
          <span className="dock-divider" aria-hidden="true" />
          <button
            type="button"
            aria-label="Resumo"
            onClick={openSummary}
            aria-expanded={summaryOpen}
          >
            <span className="dock-icon" aria-hidden="true">
              ≡
            </span>
            Resumo
            <span className="dock-count" data-testid="assigned-count">
              {assignedCount}/{totalConfigurable}
            </span>
          </button>
        </nav>

        {(materialsOpen || summaryOpen) && (
          <button
            type="button"
            className="panel-scrim"
            aria-label="Fechar painel"
            onClick={() => {
              setMaterialsOpen(false);
              setSummaryOpen(false);
            }}
          />
        )}

        {materialsOpen && (
          <MaterialLibraryPanel
            library={library}
            selected={selectedMaterial}
            activeSurface={selectedSurfaceName}
            selectedReady={selectedPbr !== null}
            canApplySelected={canApplySelected}
            canApplyAll={canApplyAll}
            applyState={applyState}
            onSelect={(material) => {
              setSelectedMaterial(material);
              setApplyState('idle');
            }}
            onApplySelected={() => void applySelected()}
            onApplyAll={() => void applyAll()}
            onResetSelected={resetSelected}
            onClose={() => setMaterialsOpen(false)}
          />
        )}

        {summaryOpen && (
          <ConfigurationSummary
            items={summaryItems}
            total={totalConfigurable}
            shareState={shareState}
            onClose={() => setSummaryOpen(false)}
            onResetAll={resetAll}
            onShare={() => void shareConfiguration()}
          />
        )}

        {configurationNotice && (
          <div className="experience-toast" role="status" aria-live="polite">
            <div>
              <strong>
                {configurationNotice === 'restored'
                  ? 'Configuração recuperada'
                  : 'Configuração não recuperada'}
              </strong>
              <span>
                {configurationNotice === 'restored'
                  ? 'A combinação deste link foi restaurada na sua KARV.'
                  : 'O link ou estado salvo não era compatível. Abrimos a poltrona original.'}
              </span>
            </div>
            <button
              type="button"
              aria-label="Fechar aviso de configuração"
              onClick={() => setConfigurationNotice(null)}
            >
              ×
            </button>
          </div>
        )}

        {arPanel?.kind === 'desktop-qr' &&
          renderARPanel(
            'desktop-qr',
            arCapability?.support ?? 'unknown',
            arCapability?.mode ?? null,
            arPanel.handoff?.svg ?? null,
            arPanel.handoff?.url ?? null,
          )}

        {arPanel?.kind === 'unsupported' &&
          renderARPanel(
            'unsupported',
            arCapability?.support ?? 'unsupported',
            arCapability?.mode ?? null,
            null,
            arPanel.handoffUrl,
          )}

        {arPanel?.kind === 'error' &&
          renderARPanel(
            'error',
            arCapability?.support ?? 'unknown',
            arCapability?.mode ?? null,
            null,
            arPanel.handoffUrl,
          )}

        {mobileIntentVisible &&
          renderARPanel(
            arCapability.support === 'supported' ? 'mobile' : 'unsupported',
            arCapability.support,
            arCapability.mode,
            null,
            currentARHandoffUrl(),
          )}
      </section>

      <footer className="configurator-footer">
        <span>Arraste para girar</span>
        <span aria-hidden="true">·</span>
        <span>Toque para selecionar</span>
        {selectedMaterial && (
          <>
            <span aria-hidden="true">·</span>
            <strong>{selectedMaterial.name}</strong>
          </>
        )}
      </footer>
    </main>
  );
}
