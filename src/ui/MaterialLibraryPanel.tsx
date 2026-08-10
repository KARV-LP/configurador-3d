import { useMemo, useState } from 'react';
import {
  filterMaterials,
  listFacetValues,
  type MaterialChannel,
  type PublicMaterial,
} from '../materials/public-catalog';

export type LibraryState =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'ready';
      readonly materials: readonly PublicMaterial[];
      readonly source: 'network' | 'cache';
      readonly rejectedCount: number;
    };

export type MaterialApplyState = 'idle' | 'loading' | 'applied' | 'error';

export interface SurfaceOption {
  readonly id: string;
  readonly name: string;
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
  onRetry,
  onClose,
}: MaterialLibraryPanelProps) {
  const [channel, setChannel] = useState<MaterialChannel>('fabric');
  const [colorFamily, setColorFamily] = useState('');
  const [materialType, setMaterialType] = useState('');
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
        channel,
        ...(colorFamily ? { colorFamily } : {}),
        ...(materialType ? { materialType } : {}),
      }),
    [materials, channel, colorFamily, materialType],
  );

  const changeChannel = (next: MaterialChannel) => {
    setChannel(next);
    setColorFamily('');
    setMaterialType('');
  };

  const statusMessage =
    applyState === 'loading'
      ? 'Aplicando material…'
      : applyState === 'error'
        ? 'Não foi possível aplicar agora. Sua configuração anterior foi preservada.'
        : applyState === 'applied'
          ? 'Material aplicado.'
          : selected && !selectedReady
            ? 'Esta amostra está disponível para consulta, mas o acabamento 3D ainda está em preparação.'
            : selected
              ? 'Escolha onde deseja aplicar.'
              : 'Escolha um tecido para continuar.';

  return (
    <aside
      className="material-sheet"
      aria-label="Escolher materiais"
      data-testid="material-library"
      role="dialog"
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <p className="sheet-kicker">Studio KARV</p>
          <h2>Revestimentos</h2>
          <p className="sheet-subtitle">
            {activeSurface
              ? `${activeSurface} selecionado. Escolha o acabamento.`
              : 'Escolha uma área da poltrona e depois o acabamento.'}
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
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar materiais"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="material-sheet__body">
        <div className="library-tabs" role="tablist" aria-label="Coleção de materiais">
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
            aria-selected={channel === 'karv_design'}
            onClick={() => changeChannel('karv_design')}
          >
            KARV Design
          </button>
        </div>

        {library.status === 'loading' && (
          <div className="library-state" role="status">
            <span className="state-spinner" aria-hidden="true" />
            <div>
              <strong>Carregando materiais</strong>
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
              <strong>Materiais indisponíveis agora</strong>
              <span>Sua configuração atual foi preservada.</span>
              <button type="button" className="retry-button" onClick={onRetry}>
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {library.status === 'ready' && (
          <>
            {channel === 'fabric' && (
              <div className="material-journey" aria-label="Cor, material e tecido">
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
                  <span>Material</span>
                  <select
                    id="material-type-filter"
                    aria-label="Material"
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

            <div className="material-section-heading">
              <span>{channel === 'fabric' ? '03 · Tecido' : 'Coleção autoral'}</span>
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
                      <img src={material.assets.preview} alt="" loading="lazy" decoding="async" />
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
      </div>

      <footer className="material-actions">
        <p
          className={`material-actions__status material-actions__status--${applyState}`}
          data-testid="pbr-status"
          aria-live="polite"
        >
          {statusMessage}
        </p>

        {selected && (
          <div className="selected-material" data-testid="selected-material">
            <img src={selected.assets.preview} alt="" />
            <div>
              <span>Selecionado</span>
              <strong>{selected.name}</strong>
            </div>
          </div>
        )}

        <div className="material-actions__buttons">
          <button
            type="button"
            className="button button--primary"
            disabled={!canApplySelected || applyState === 'loading'}
            onClick={onApplySelected}
          >
            Aplicar nesta área
          </button>
          <button
            type="button"
            className="button"
            disabled={!canApplyAll || applyState === 'loading'}
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
    </aside>
  );
}
