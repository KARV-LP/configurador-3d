import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { RevestimentoGallery } from './RevestimentoGallery';
import { CustomArtPanel, type CustomArtEntry, type CustomArtSurface } from './CustomArtPanel';
import {
  filterMaterials,
  FABRIC_CATEGORIES,
  matchesFabricCategory,
  listFacetValues,
  type MaterialChannel,
  type PublicMaterial,
} from '../materials/public-catalog';

export type LibraryState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'ready';
      readonly materials: readonly PublicMaterial[];
      readonly source: 'network' | 'cache';
      readonly rejectedCount: number;
    };

export type MaterialApplyState = 'idle' | 'loading' | 'applied' | 'error';
type PanelTab = MaterialChannel | 'custom_art' | 'leather';

export interface SurfaceOption {
  readonly id: string;
  readonly name: string;
}

interface PanelPosition {
  readonly left: number;
  readonly top: number;
}

interface PanelDragState {
  readonly pointerId: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly startLeft: number;
  readonly startTop: number;
  readonly width: number;
  readonly height: number;
}

interface MaterialLibraryPanelProps {
  readonly library: LibraryState;
  readonly selected: PublicMaterial | null;
  readonly surfaces: readonly SurfaceOption[];
  readonly activeSurfaceId: string | null;
  readonly activeSurface: string | null;
  readonly selectedReady: boolean;
  readonly canApplySelected: boolean;
  readonly canApplyAll: boolean;
  readonly applyState: MaterialApplyState;
  readonly onSelect: (material: PublicMaterial) => void;
  readonly onApplySelected: () => void;
  readonly onApplyAll: () => void;
  readonly onResetSelected: () => void;
  readonly onSelectSurface: (surfaceId: string) => void;
  readonly customArtSurfaces: readonly CustomArtSurface[];
  readonly customArtEntries: Readonly<Record<string, CustomArtEntry | undefined>>;
  readonly onUploadArt: (surfaceId: string, file: File) => void;
  readonly onRemoveArt: (surfaceId: string) => void;
  readonly onRequestLibrary: () => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

export function MaterialLibraryPanel({
  library,
  selected,
  surfaces,
  activeSurfaceId,
  activeSurface,
  selectedReady,
  canApplySelected,
  canApplyAll,
  applyState,
  onSelect,
  onApplySelected,
  onApplyAll,
  onResetSelected,
  onSelectSurface,
  customArtSurfaces,
  customArtEntries,
  onUploadArt,
  onRemoveArt,
  onRequestLibrary,
  onRetry,
  onClose,
}: MaterialLibraryPanelProps) {
  const [channel, setChannel] = useState<PanelTab>('fabric');
  const [category, setCategory] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const panelDragRef = useRef<PanelDragState | null>(null);
  const materials = useMemo(() => (library.status === 'ready' ? library.materials : []), [library]);
  const channelMaterials = useMemo(
    () => materials.filter((material) => material.channel === channel),
    [materials, channel],
  );
  const colorOptions = useMemo(
    () => listFacetValues(channelMaterials, 'color'),
    [channelMaterials],
  );
  const typeOptions = useMemo(
    () => listFacetValues(channelMaterials, 'materialType'),
    [channelMaterials],
  );
  const visibleMaterials = useMemo(
    () =>
      filterMaterials(materials, {
        channel: channel === 'karv_design' ? 'karv_design' : 'fabric',
        ...(colorFamily ? { colorFamily } : {}),
        ...(materialType ? { materialType } : {}),
      }).filter((material) => matchesFabricCategory(material, category)),
    [materials, channel, colorFamily, materialType, category],
  );

  const startPanelMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const panel = event.currentTarget.closest('.material-sheet') as HTMLElement | null;
    if (!panel) return;
    const bounds = panel.getBoundingClientRect();
    panelDragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startLeft: bounds.left,
      startTop: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const movePanel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - drag.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - drag.height - margin);
    setPanelPosition({
      left: Math.min(maxLeft, Math.max(margin, drag.startLeft + event.clientX - drag.pointerX)),
      top: Math.min(maxTop, Math.max(margin, drag.startTop + event.clientY - drag.pointerY)),
    });
  };

  const stopPanelMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (panelDragRef.current?.pointerId !== event.pointerId) return;
    panelDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const changeChannel = (next: PanelTab) => {
    setChannel(next);
    setCategory('');
    setColorFamily('');
    setMaterialType('');
    if (next !== 'custom_art') onRequestLibrary();
  };

  const selectionVisible =
    channel !== 'leather' &&
    channel !== 'custom_art' &&
    visibleMaterials.some((item) => item.id === selected?.id);
  const galleryMaterial = selectionVisible ? selected : (visibleMaterials[0] ?? null);

  const statusMessage =
    applyState === 'loading'
      ? 'Aplicando Revestimento…'
      : applyState === 'error'
        ? 'Não foi possível aplicar agora. Sua configuração anterior foi preservada.'
        : applyState === 'applied'
          ? 'Revestimento aplicado.'
          : selected && !selectedReady
            ? 'Esta amostra está disponível para consulta, mas o acabamento 3D ainda está em preparação.'
            : selected
              ? 'Escolha onde deseja aplicar.'
              : 'Escolha um tecido para continuar.';

  return (
    <aside
      className="material-sheet"
      aria-label="Escolher Revestimentos"
      data-testid="material-library"
      role="dialog"
      style={
        panelPosition
          ? {
              left: panelPosition.left,
              top: panelPosition.top,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
    >
      <header className="sheet-header">
        <nav className="mobile-material-nav" aria-label="Navegação de revestimentos">
          <button type="button" onClick={onClose}>
            <span aria-hidden="true">←</span>
            Voltar ao 3D
          </button>
          <span className="mobile-material-nav__brand" aria-label="KARV">
            KARV
          </span>
        </nav>
        <div className="sheet-header__content">
          <p className="sheet-kicker">Studio KARV</p>
          <h2>Revestimentos</h2>
          <p className="sheet-subtitle">
            {activeSurface
              ? `${activeSurface} selecionado. Escolha o Revestimento.`
              : 'Escolha uma área da poltrona e depois o Revestimento.'}
          </p>

          <label className="surface-control" htmlFor="material-surface-select">
            <span>Área da poltrona</span>
            <select
              id="material-surface-select"
              aria-label="Área da poltrona"
              value={activeSurfaceId ?? ''}
              onChange={(event) => onSelectSurface(event.target.value)}
            >
              <option value="" disabled>
                Selecione no 3D ou aqui
              </option>
              {surfaces.map((surface) => (
                <option key={surface.id} value={surface.id}>
                  {surface.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="sheet-header__actions">
          <button
            type="button"
            className="sheet-drag-handle"
            aria-label="Mover painel de tecidos"
            title="Arraste para mover · clique duas vezes para restaurar"
            onPointerDown={startPanelMove}
            onPointerMove={movePanel}
            onPointerUp={stopPanelMove}
            onPointerCancel={stopPanelMove}
            onDoubleClick={() => setPanelPosition(null)}
          >
            <span aria-hidden="true">⠿</span>
            Mover
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar Revestimentos"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="material-sheet__body">
        <div className="library-tabs" role="tablist" aria-label="Coleção de Revestimentos">
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'fabric'}
            onClick={() => changeChannel('fabric')}
          >
            Tecidos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'leather'}
            onClick={() => changeChannel('leather')}
          >
            Couro e Courvin
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'karv_design'}
            onClick={() => changeChannel('karv_design')}
          >
            KARV Design
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={channel === 'custom_art'}
            onClick={() => changeChannel('custom_art')}
          >
            Sua ARTE
          </button>
        </div>

        {channel === 'custom_art' ? (
          <CustomArtPanel
            surfaces={customArtSurfaces}
            activeSurfaceId={activeSurfaceId}
            entries={customArtEntries}
            onUpload={onUploadArt}
            onRemove={onRemoveArt}
          />
        ) : channel === 'leather' ? (
          <div className="library-state">
            <div>
              <strong>Couro e Courvin em preparação</strong>
              <span>Os Revestimentos aparecerão aqui assim que forem publicados pela KARV.</span>
            </div>
          </div>
        ) : (
          <>
            {library.status === 'idle' && (
              <div className="library-state" role="status">
                <span className="state-symbol" aria-hidden="true">
                  ↗
                </span>
                <div>
                  <strong>Biblioteca sob demanda</strong>
                  <span>Abra Tecidos ou KARV Design para carregar o catálogo.</span>
                </div>
              </div>
            )}

            {library.status === 'loading' && (
              <div className="library-state" role="status">
                <span className="state-spinner" aria-hidden="true" />
                <div>
                  <strong>Carregando Revestimentos</strong>
                  <span>Preparando o catálogo para você.</span>
                </div>
              </div>
            )}

            {library.status === 'unavailable' && (
              <div className="library-state library-state--error" role="status">
                <span className="state-symbol" aria-hidden="true">
                  !
                </span>
                <div>
                  <strong>Revestimentos indisponíveis agora</strong>
                  <span>Sua configuração atual foi preservada.</span>
                  <button type="button" className="retry-button" onClick={onRetry}>
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}

            {library.status === 'ready' && (
              <>
                <div className="revestimento-layout">
                  {channel === 'fabric' && (
                    <nav className="fabric-categories" aria-label="Categoria">
                      <strong>Categoria</strong>
                      {['', ...FABRIC_CATEGORIES].map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={category === value}
                          onClick={() => {
                            setCategory(value);
                            setMaterialType('');
                          }}
                        >
                          {value || 'Todas'}
                        </button>
                      ))}
                    </nav>
                  )}
                  <div className="revestimento-detail">
                    {channel === 'fabric' && (
                      <div className="material-journey" aria-label="Filtros de Revestimentos">
                        <label htmlFor="material-color-filter">
                          <span className="journey-step">01</span>
                          <span>Cor</span>
                          <select
                            id="material-color-filter"
                            aria-label="Cor"
                            value={colorFamily}
                            onChange={(event) => setColorFamily(event.target.value)}
                          >
                            <option value="">Todas</option>
                            {colorOptions.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label htmlFor="material-type-filter">
                          <span className="journey-step">02</span>
                          <span>Tipo de Revestimento</span>
                          <select
                            id="material-type-filter"
                            aria-label="Tipo de Revestimento"
                            value={materialType}
                            onChange={(event) => setMaterialType(event.target.value)}
                          >
                            <option value="">Todos</option>
                            {typeOptions.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    {galleryMaterial && (
                      <RevestimentoGallery
                        key={galleryMaterial.id}
                        material={galleryMaterial}
                        selected={selectionVisible}
                        onSelect={() => onSelect(galleryMaterial)}
                      />
                    )}
                  </div>
                </div>
                <div className="material-section-heading">
                  <span>
                    {channel === 'fabric' ? 'Outros tecidos da categoria' : 'Coleção autoral'}
                  </span>
                  {library.source === 'cache' && <small>catálogo salvo</small>}
                </div>

                {visibleMaterials.length === 0 ? (
                  <div className="library-state library-state--empty">
                    <span className="state-symbol" aria-hidden="true">
                      —
                    </span>
                    <div>
                      <strong>
                        {channel === 'karv_design'
                          ? 'KARV Design em preparação'
                          : 'Nenhum tecido encontrado'}
                      </strong>
                      <span>
                        {channel === 'karv_design'
                          ? 'As criações autorais aparecerão aqui assim que forem publicadas.'
                          : 'Ajuste os filtros para explorar outras opções.'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="material-grid">
                    {visibleMaterials.map((material) => (
                      <button
                        type="button"
                        className="material-card"
                        data-selected={selected?.id === material.id}
                        key={material.id}
                        onClick={() => onSelect(material)}
                        aria-pressed={selected?.id === material.id}
                        aria-label={`${material.name}, ${material.color.family}, ${material.materialType}`}
                      >
                        <span className="material-card__media">
                          <img
                            src={material.assets.preview}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                          {material.pbrReady && <span className="material-card__ready">3D</span>}
                        </span>
                        <span className="material-card__name">{material.name}</span>
                        <span className="material-card__meta">
                          {material.color.family} · {material.materialType}
                        </span>
                        <span
                          className={`material-card__availability${
                            material.pbrReady ? ' is-ready' : ''
                          }`}
                        >
                          {material.pbrReady ? 'Disponível em 3D' : 'Acabamento 3D em preparação'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {channel !== 'custom_art' && channel !== 'leather' && (
        <footer className="material-actions">
          <p
            className={`material-actions__status material-actions__status--${applyState}`}
            data-testid="pbr-status"
            aria-live="polite"
          >
            {statusMessage}
          </p>

          <div className="material-actions__buttons">
            <button
              type="button"
              className="button button--primary"
              disabled={!selectionVisible || !canApplySelected || applyState === 'loading'}
              aria-describedby="pbr-status"
              onClick={onApplySelected}
            >
              Aplicar nesta área
            </button>
            <button
              type="button"
              className="button"
              disabled={!selectionVisible || !canApplyAll || applyState === 'loading'}
              onClick={onApplyAll}
            >
              Aplicar em toda a poltrona
            </button>
            {activeSurface && (
              <button type="button" className="text-button" onClick={onResetSelected}>
                Restaurar esta área
              </button>
            )}
          </div>
        </footer>
      )}
    </aside>
  );
}
