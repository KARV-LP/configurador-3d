import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ARCapability } from '../ar/ar-capability.port';
import { ARController, type ARPresentationStatus, type CameraSnapshot } from '../ar/ar-controller';
import { createARSession, loadARSession, readARSessionCredential } from '../ar/ar-session';
import {
  createARHandoffUrl,
  createQRHandoff,
  hasARIntent,
  type QRHandoffPayload,
} from '../ar/qr-handoff';
import { ChairViewer, type ViewerState } from '../3d/ChairViewer';
import type { Core3DController } from '../3d/core-3d-controller';
import type { CustomBaseColorSource } from '../3d/custom-base-color';
import type { ModelViewerElementApi } from '../3d/model-viewer-adapter';
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
import { createOwnedCustomTexture } from '../proposals/model-viewer-custom-texture';
import {
  dataUrlToBlob,
  submitProposal,
  type ProposalContact,
  type ProposalSurfacePayload,
} from '../proposals/proposal-submission';
import { ARExperiencePanel, type ARExperienceKind } from '../ui/ARExperiencePanel';
import type { CustomArtEntry, CustomArtSurface } from '../ui/CustomArtPanel';
import {
  MaterialLibraryPanel,
  type LibraryState,
  type MaterialApplyState,
  type SurfaceOption,
} from '../ui/MaterialLibraryPanel';
import {
  ConfigurationSummary,
  type ConfigurationSummaryItem,
  type ShareConfigurationState,
} from '../ui/ConfigurationSummary';
import { InitialLoadingScreen } from '../ui/InitialLoadingScreen';
import { MoldDownloadPanel } from '../ui/MoldDownloadPanel';
import { ProposalPanel, type ProposalSubmitState } from '../ui/ProposalPanel';
import { ViewerStatus } from '../ui/ViewerStatus';

const NO_SELECTION: SelectionResult = Object.freeze({ kind: 'none' });
const CUSTOM_ART_SURFACES = Object.freeze([
  { id: 'seat', name: 'Assento' },
  { id: 'backrest-front', name: 'Encosto Frontal' },
  { id: 'backrest-side', name: 'Encosto Lateral' },
  { id: 'backrest-rear', name: 'Encosto Traseiro' },
  { id: 'side-outer', name: 'Lateral Externa' },
  { id: 'side-inner', name: 'Lateral Interna' },
] as const satisfies readonly CustomArtSurface[]);
type HydrationState = 'waiting' | 'restoring' | 'ready';
type ARSessionHydrationState = 'waiting' | 'restoring' | 'ready' | 'invalid';
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

function getInitialARSession(): Readonly<{ credential: string | null; invalid: boolean }> {
  try {
    return Object.freeze({
      credential: readARSessionCredential(window.location.href),
      invalid: false,
    });
  } catch {
    return Object.freeze({ credential: null, invalid: true });
  }
}

export function App() {
  const [geometry, setGeometry] = useState<CanonicalGeometry | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>('registering');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [core, setCore] = useState<Core3DController | null>(null);
  const [selection, setSelection] = useState<SelectionResult>(NO_SELECTION);
  const [configuration, setConfiguration] = useState<CoreConfigurationSnapshot | null>(null);
  const [library, setLibrary] = useState<LibraryState>({ status: 'idle' });
  const [customArtEntries, setCustomArtEntries] = useState<
    Readonly<Record<string, CustomArtEntry | undefined>>
  >({});
  const [selectedMaterial, setSelectedMaterial] = useState<PublicMaterial | null>(null);
  const [applyState, setApplyState] = useState<MaterialApplyState>('idle');
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [moldsOpen, setMoldsOpen] = useState(false);
  const [proposalSnapshotUrl, setProposalSnapshotUrl] = useState<string | null>(null);
  const [proposalSubmitState, setProposalSubmitState] = useState<ProposalSubmitState>({
    kind: 'idle',
  });
  const [hydrationState, setHydrationState] = useState<HydrationState>('waiting');
  const [arSessionHydrationState, setARSessionHydrationState] =
    useState<ARSessionHydrationState>('waiting');
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
  const arSessionStartedRef = useRef(false);
  const libraryAbortRef = useRef<AbortController | null>(null);
  const customArtUrlsRef = useRef(new Map<string, string>());
  const customArtFilesRef = useRef(new Map<string, File>());
  const customArtSequenceRef = useRef(0);
  const [initialARSession] = useState(getInitialARSession);
  const libraryClient = useMemo(() => new MaterialLibraryClient(), []);
  const selectedPbr = useMemo(
    () => (selectedMaterial ? toProductionPbrMaterial(selectedMaterial) : null),
    [selectedMaterial],
  );
  const loadingError = viewerState === 'error';
  const configuratorReady = modelLoaded && viewerState === 'ready' && core !== null;
  const loadingProgress = configuratorReady ? 100 : !modelLoaded ? 18 : core === null ? 72 : 92;
  const loadingStage = configuratorReady
    ? 'Pronto'
    : !modelLoaded
      ? 'Carregando modelo 3D'
      : 'Preparando visualização';

  useEffect(() => {
    if (!configuratorReady) return;
    const timer = window.setTimeout(() => setLoadingVisible(false), 360);
    return () => window.clearTimeout(timer);
  }, [configuratorReady]);

  const loadMaterials = useCallback(() => {
    libraryAbortRef.current?.abort();
    const controller = new AbortController();
    libraryAbortRef.current = controller;
    setLibrary({ status: 'loading' });
    void libraryClient
      .load(controller.signal)
      .then(({ catalog, source }) => {
        if (libraryAbortRef.current !== controller) return;
        setLibrary({
          status: 'ready',
          materials: catalog.materials,
          source,
          rejectedCount: catalog.rejectedCount,
        });
      })
      .catch((error: unknown) => {
        if (
          libraryAbortRef.current === controller &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setLibrary({ status: 'unavailable' });
        }
      });
  }, [libraryClient]);

  const ensureMaterials = useCallback(() => {
    if (library.status === 'idle' || library.status === 'unavailable') loadMaterials();
  }, [library.status, loadMaterials]);

  const retryMaterials = useCallback(() => loadMaterials(), [loadMaterials]);

  const retryInitialLoad = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(
    () => () => {
      libraryAbortRef.current?.abort();
      for (const url of customArtUrlsRef.current.values()) URL.revokeObjectURL(url);
      customArtUrlsRef.current.clear();
      customArtFilesRef.current.clear();
    },
    [],
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

  const handleModelLoaded = useCallback(() => setModelLoaded(true), []);

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
    if (materialsOpen && library.status === 'idle') loadMaterials();
  }, [library.status, loadMaterials, materialsOpen]);

  useEffect(() => {
    if (hydrationState !== 'waiting' || !core || !configurationSession) return;

    const candidate = configurationSession.resolve(window.location.href);
    if (candidate.kind === 'none') {
      setConfigurationNotice(null);
      setHydrationState('ready');
      return;
    }
    if (candidate.kind === 'invalid') {
      configurationSession.clear();
      setConfigurationNotice('invalid');
      setHydrationState('ready');
      return;
    }
    if (library.status === 'idle') {
      loadMaterials();
      return;
    }
    if (library.status !== 'ready') return;

    let active = true;
    void (async () => {
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
      if (active) setHydrationState('ready');
    })();

    return () => {
      active = false;
    };
  }, [configurationSession, core, hydrationState, library, loadMaterials]);

  useEffect(() => {
    if (hydrationState !== 'ready' || !configurationSession || !configuration) return;
    const token = configurationSession.persist(configuration);
    const syncedUrl = configurationSession.syncExistingShareUrl(window.location.href, token);
    if (syncedUrl && syncedUrl !== window.location.href) {
      window.history.replaceState(window.history.state, '', syncedUrl);
    }
  }, [configuration, configurationSession, hydrationState]);

  useEffect(() => {
    if (arSessionStartedRef.current || hydrationState !== 'ready' || !core || !geometry) {
      return;
    }
    arSessionStartedRef.current = true;
    if (initialARSession.invalid) {
      setARSessionHydrationState('invalid');
      setConfigurationNotice('invalid');
      return;
    }
    if (!initialARSession.credential) {
      setARSessionHydrationState('ready');
      return;
    }

    const controller = new AbortController();
    let active = true;
    let completed = false;
    const appliedSurfaceIds: string[] = [];
    setARSessionHydrationState('restoring');
    void (async () => {
      try {
        const restored = await loadARSession(
          initialARSession.credential!,
          undefined,
          controller.signal,
        );
        if (
          restored.geometry.id !== geometry.manifest.geometryId ||
          restored.geometry.version !== geometry.manifest.geometryVersion ||
          restored.geometry.sha256 !== geometry.manifest.sha256
        ) {
          throw new Error('A sessão de RA pertence a outra geometria KARV.');
        }
        const viewer = document.querySelector<ModelViewerElementApi>('model-viewer');
        if (!viewer) throw new Error('Viewer 3D indisponível.');
        const { prepareLocalArtForSurface } = await import('../proposals/local-pdf-art');

        const nextEntries: Record<string, CustomArtEntry> = {};
        for (const [surfaceId, file] of restored.files) {
          const { asset, profileId } = await prepareLocalArtForSurface(file, surfaceId);
          const previewUrl = URL.createObjectURL(asset);
          try {
            await core.applyCustomBaseColor(
              surfaceId,
              Object.freeze({
                cacheKey: `ar-session:${profileId}:${++customArtSequenceRef.current}`,
                create: () => createOwnedCustomTexture(asset, viewer),
              }),
            );
          } catch (error) {
            URL.revokeObjectURL(previewUrl);
            throw error;
          }
          if (!active) {
            URL.revokeObjectURL(previewUrl);
            return;
          }
          appliedSurfaceIds.push(surfaceId);
          customArtUrlsRef.current.set(surfaceId, previewUrl);
          customArtFilesRef.current.set(surfaceId, file);
          nextEntries[surfaceId] = Object.freeze({
            fileName: file.name,
            status: 'applied',
            previewUrl,
            message: 'Arte restaurada para a realidade aumentada.',
          });
        }
        if (!active) return;
        setCustomArtEntries(nextEntries);
        setConfiguration(core.getConfiguration());
        setConfigurationNotice('restored');
        completed = true;
        setARSessionHydrationState('ready');
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        for (const surfaceId of appliedSurfaceIds) {
          core.resetSurface(surfaceId);
          const url = customArtUrlsRef.current.get(surfaceId);
          if (url) URL.revokeObjectURL(url);
          customArtUrlsRef.current.delete(surfaceId);
          customArtFilesRef.current.delete(surfaceId);
        }
        setCustomArtEntries({});
        setConfiguration(core.getConfiguration());
        setConfigurationNotice('invalid');
        completed = true;
        setARSessionHydrationState('invalid');
      }
    })();

    return () => {
      active = false;
      controller.abort();
      if (!completed) arSessionStartedRef.current = false;
    };
  }, [core, geometry, hydrationState, initialARSession]);

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

  const surfaceOptions = useMemo<readonly SurfaceOption[]>(
    () =>
      (geometry?.surfaceMap.surfaces ?? [])
        .filter((surface) => surface.classification === 'configurable')
        .map((surface) => ({ id: surface.surfaceId, name: surface.publicName })),
    [geometry],
  );

  const proposalSurfaces = useMemo<readonly ProposalSurfacePayload[]>(
    () =>
      surfaceOptions.map((surface) => {
        const customEntry = customArtEntries[surface.id];
        if (customEntry?.status === 'applied') {
          return Object.freeze({
            surfaceId: surface.id,
            surfaceName: surface.name,
            source: 'custom-art' as const,
            materialId: null,
            materialName: 'Sua ARTE',
            customFileName: customEntry.fileName,
            customFileField: `art:${surface.id}`,
          });
        }
        const materialId = configuration?.assignments[surface.id] ?? null;
        return Object.freeze({
          surfaceId: surface.id,
          surfaceName: surface.name,
          source: materialId ? ('library' as const) : ('original' as const),
          materialId,
          materialName: materialId
            ? (materialById.get(materialId)?.name ?? 'Revestimento KARV')
            : null,
          customFileName: null,
          customFileField: null,
        });
      }),
    [configuration, customArtEntries, materialById, surfaceOptions],
  );

  const customPreviewBySurface = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(customArtEntries).map(([surfaceId, entry]) => [
          surfaceId,
          entry?.status === 'applied' ? entry.previewUrl : null,
        ]),
      ),
    [customArtEntries],
  );

  const summaryItems = useMemo<readonly ConfigurationSummaryItem[]>(() => {
    const catalogItems = configuration
      ? Object.entries(configuration.assignments)
          .filter(([, materialId]) => materialId !== null)
          .map(([surfaceId, materialId]) => ({
            surfaceName: surfaceNameById.get(surfaceId) ?? 'Área configurada',
            materialName: materialId
              ? (materialById.get(materialId)?.name ?? 'Material aplicado')
              : '',
          }))
      : [];
    const customItems = Object.entries(customArtEntries)
      .filter(([, entry]) => entry?.status === 'applied')
      .map(([surfaceId]) => ({
        surfaceName: surfaceNameById.get(surfaceId) ?? 'Área configurada',
        materialName: 'Sua ARTE',
      }));
    return [...catalogItems, ...customItems];
  }, [configuration, customArtEntries, materialById, surfaceNameById]);

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

  const clearCustomArtEntry = useCallback((surfaceId: string) => {
    const previousUrl = customArtUrlsRef.current.get(surfaceId);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    customArtUrlsRef.current.delete(surfaceId);
    customArtFilesRef.current.delete(surfaceId);
    setCustomArtEntries((current) => {
      const next = { ...current };
      delete next[surfaceId];
      return next;
    });
  }, []);

  const uploadCustomArt = useCallback(
    async (surfaceId: string, file: File) => {
      setCustomArtEntries((current) => ({
        ...current,
        [surfaceId]: {
          fileName: file.name,
          status: 'processing',
          previewUrl: current[surfaceId]?.previewUrl ?? null,
          message: 'Validando e preparando a arte para esta face…',
        },
      }));

      let previewUrl: string | null = null;
      try {
        if (!core) throw new Error('A visualização 3D ainda não está pronta.');
        const viewer = document.querySelector<ModelViewerElementApi>('model-viewer');
        if (!viewer) throw new Error('Viewer 3D indisponível.');

        const { prepareLocalArtForSurface } = await import('../proposals/local-pdf-art');
        const { asset, profileId } = await prepareLocalArtForSurface(file, surfaceId);
        previewUrl = URL.createObjectURL(asset);
        const source: CustomBaseColorSource = Object.freeze({
          cacheKey: `local:${profileId}:${++customArtSequenceRef.current}`,
          create: () => createOwnedCustomTexture(asset, viewer),
        });

        await core.applyCustomBaseColor(surfaceId, source);
        const previousUrl = customArtUrlsRef.current.get(surfaceId);
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        customArtUrlsRef.current.set(surfaceId, previewUrl);
        customArtFilesRef.current.set(surfaceId, file);
        setCustomArtEntries((current) => ({
          ...current,
          [surfaceId]: {
            fileName: file.name,
            status: 'applied',
            previewUrl,
            message: 'Arte aplicada somente nesta face.',
          },
        }));
        setConfiguration(core.getConfiguration());
      } catch (error) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setCustomArtEntries((current) => ({
          ...current,
          [surfaceId]: {
            fileName: file.name,
            status: 'error',
            previewUrl: current[surfaceId]?.previewUrl ?? null,
            message: error instanceof Error ? error.message : 'Não foi possível aplicar esta arte.',
          },
        }));
      }
    },
    [core],
  );

  const removeCustomArt = useCallback(
    (surfaceId: string) => {
      if (!core) return;
      core.resetSurface(surfaceId);
      clearCustomArtEntry(surfaceId);
      setConfiguration(core.getConfiguration());
    },
    [clearCustomArtEntry, core],
  );

  const applySelected = async () => {
    if (!core || !selectedPbr || selection.kind !== 'configurable') return;
    setApplyState('loading');
    try {
      // Reconfirma a área no runtime antes de aplicar. Isso mantém o botão
      // funcional também quando a seleção veio do seletor do painel.
      core.selectSurface(selection.surfaceId);
      const surfaceId = selection.surfaceId;
      const applied = await core.applyPbrSelected(selectedPbr);
      if (applied) clearCustomArtEntry(surfaceId);
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
      for (const surfaceId of Object.keys(customArtEntries)) clearCustomArtEntry(surfaceId);
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
    return createARHandoffUrl(
      window.location.href,
      configurationSession,
      configuration,
      initialARSession.credential,
    );
  }, [configuration, configurationSession, initialARSession]);

  const activateMobileAR = useCallback(() => {
    if (!arController || arCapability?.support !== 'supported') return;
    const activation = arController.activate();
    void activation.catch(() => setARStatus('failed'));
  }, [arCapability, arController]);

  const openARExperience = () => {
    if (
      !arReady ||
      !arController ||
      !arCapability ||
      !configurationSession ||
      !configuration ||
      !geometry
    ) {
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

    const customFiles = new Map<string, File>();
    for (const [surfaceId, entry] of Object.entries(customArtEntries)) {
      if (entry?.status !== 'applied') continue;
      const file = customArtFilesRef.current.get(surfaceId);
      if (file) customFiles.set(surfaceId, file);
    }

    void createARSession({
      geometry: {
        id: geometry.manifest.geometryId,
        version: geometry.manifest.geometryVersion,
        sha256: geometry.manifest.sha256,
      },
      customFiles,
    })
      .then((credential) =>
        createQRHandoff(window.location.href, configurationSession, configuration, credential),
      )
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
    setMoldsOpen(false);
    setMaterialsOpen(true);
  };

  const openSummary = () => {
    setMaterialsOpen(false);
    setMoldsOpen(false);
    setSummaryOpen(true);
  };

  const openMolds = () => {
    setMaterialsOpen(false);
    setSummaryOpen(false);
    setMoldsOpen(true);
  };

  const openProposal = () => {
    const viewer = document.querySelector<ModelViewerElementApi>('model-viewer');
    if (!viewer || !configuration || !geometry) return;
    try {
      const snapshot = viewer.toDataURL('image/png');
      setMaterialsOpen(false);
      setSummaryOpen(false);
      setMoldsOpen(false);
      setProposalSubmitState({ kind: 'idle' });
      setProposalSnapshotUrl(snapshot);
      ensureMaterials();
    } catch {
      setConfigurationNotice('invalid');
    }
  };

  const sendProposal = async (contact: ProposalContact) => {
    if (!proposalSnapshotUrl || !geometry) return;
    setProposalSubmitState({ kind: 'submitting' });
    try {
      const activeFiles = new Map<string, File>();
      for (const surface of proposalSurfaces) {
        if (surface.source !== 'custom-art') continue;
        const file = customArtFilesRef.current.get(surface.surfaceId);
        if (!file) throw new Error(`Arquivo original não encontrado para ${surface.surfaceName}.`);
        activeFiles.set(surface.surfaceId, file);
      }
      const receipt = await submitProposal({
        payload: Object.freeze({
          schema: 'karv.customer-proposal/1',
          geometry: Object.freeze({
            id: geometry.manifest.geometryId,
            version: geometry.manifest.geometryVersion,
            sha256: geometry.manifest.sha256,
          }),
          submittedAt: new Date().toISOString(),
          contact,
          surfaces: proposalSurfaces,
          snapshotField: 'snapshot',
        }),
        snapshot: dataUrlToBlob(proposalSnapshotUrl),
        customFiles: activeFiles,
      });
      setProposalSubmitState({ kind: 'success', proposalId: receipt.proposalId });
    } catch (error) {
      setProposalSubmitState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível enviar a proposta.',
      });
    }
  };

  const mobileIntentVisible =
    arIntentRequested &&
    !arIntentDismissed &&
    hydrationState === 'ready' &&
    arSessionHydrationState !== 'waiting' &&
    arSessionHydrationState !== 'restoring' &&
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
    <main
      className={`configurator-shell${loadingVisible ? ' configurator-shell--loading' : ''}`}
      aria-busy={loadingVisible}
      data-configurator-ready={configuratorReady ? 'true' : 'false'}
    >
      <InitialLoadingScreen
        progress={loadingProgress}
        stage={loadingStage}
        status={loadingError ? 'error' : configuratorReady ? 'ready' : 'loading'}
        visible={loadingVisible}
        onRetry={retryInitialLoad}
      />
      <header className="configurator-header">
        <div className="brand-lockup" aria-label="KARV configurador">
          <span className="brand-mark">KARV</span>
          <span className="brand-context">Configure sua poltrona</span>
        </div>

        <div className="header-actions">
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
            onModelLoaded={handleModelLoaded}
            onCoreReady={handleCoreReady}
            onARReady={handleARReady}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="viewer-placeholder" aria-hidden="true" />
        )}

        <ViewerStatus state={loadingVisible && !loadingError ? 'loading' : viewerState} />

        <div
          className={`selection-status selection-status--${selection.kind}`}
          data-testid="selection-status"
          aria-live="polite"
        >
          <span className="selection-status__dot" aria-hidden="true" />
          <span>{selectionLabel}</span>
        </div>

        <nav className="stage-dock" aria-label="Ações do configurador">
          <button type="button" onClick={openMaterials} aria-expanded={materialsOpen}>
            Revestir
          </button>
          <span className="dock-divider" aria-hidden="true" />
          <button type="button" onClick={openMolds} aria-expanded={moldsOpen}>
            Moldes
          </button>
          <span className="dock-divider" aria-hidden="true" />
          <button
            type="button"
            aria-label="Resumo"
            onClick={openSummary}
            aria-expanded={summaryOpen}
          >
            Resumo
            <span className="dock-count" data-testid="assigned-count">
              {assignedCount}/{totalConfigurable}
            </span>
          </button>
          <span className="dock-divider" aria-hidden="true" />
          <button type="button" onClick={openProposal} disabled={!configuratorReady}>
            Enviar proposta
          </button>
        </nav>

        {(summaryOpen || moldsOpen || proposalSnapshotUrl) && (
          <button
            type="button"
            className="panel-scrim"
            aria-label="Fechar painel"
            onClick={() => {
              setMaterialsOpen(false);
              setSummaryOpen(false);
              setMoldsOpen(false);
              setProposalSnapshotUrl(null);
            }}
          />
        )}

        {materialsOpen && (
          <MaterialLibraryPanel
            library={library}
            selected={selectedMaterial}
            surfaces={surfaceOptions}
            activeSurfaceId={selection.kind === 'configurable' ? selection.surfaceId : null}
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
            onSelectSurface={(surfaceId) => {
              const nextSelection = core?.selectSurface(surfaceId);
              if (nextSelection) setSelection(nextSelection);
            }}
            customArtSurfaces={CUSTOM_ART_SURFACES}
            customArtEntries={customArtEntries}
            onUploadArt={(surfaceId, file) => void uploadCustomArt(surfaceId, file)}
            onRemoveArt={removeCustomArt}
            onRequestLibrary={ensureMaterials}
            onRetry={retryMaterials}
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

        {moldsOpen && (
          <MoldDownloadPanel
            selectedSurfaceId={selection.kind === 'configurable' ? selection.surfaceId : null}
            onClose={() => setMoldsOpen(false)}
          />
        )}

        {proposalSnapshotUrl && (
          <ProposalPanel
            snapshotUrl={proposalSnapshotUrl}
            surfaces={proposalSurfaces}
            previewBySurface={customPreviewBySurface}
            submitState={proposalSubmitState}
            onClose={() => setProposalSnapshotUrl(null)}
            onSubmit={(contact) => void sendProposal(contact)}
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
            arSessionHydrationState === 'invalid'
              ? 'error'
              : arCapability.support === 'supported'
                ? 'mobile'
                : 'unsupported',
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
