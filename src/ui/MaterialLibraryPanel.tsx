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

interface MaterialLibraryPanelProps {
  readonly library: LibraryState;
  readonly selected: PublicMaterial | null;
  readonly onSelect: (material: PublicMaterial) => void;
}

export function MaterialLibraryPanel({ library, selected, onSelect }: MaterialLibraryPanelProps) {
  const [channel, setChannel] = useState<MaterialChannel>('fabric');
  const [colorFamily, setColorFamily] = useState('');
  const [materialType, setMaterialType] = useState('');
  const materials = library.status === 'ready' ? library.materials : [];
  const channelMaterials = useMemo(
    () => materials.filter((material) => material.channel === channel),
    [materials, channel],
  );
  const colorOptions = useMemo(() => listFacetValues(channelMaterials, 'color'), [channelMaterials]);
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

  return (
    <aside className="library-panel" aria-label="Biblioteca KARV" data-testid="material-library">
      <div className="library-panel__header">
        <div>
          <p className="library-panel__phase">Biblioteca KARV · F3</p>
          <h2>Materiais</h2>
        </div>
        {library.status === 'ready' && (
          <span className="library-panel__source">
            {library.source === 'cache' ? 'cache validado' : 'catálogo oficial'}
          </span>
        )}
      </div>

      <div className="library-tabs" role="tablist" aria-label="Tipo de material">
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

      {library.status === 'loading' && <p className="library-message">Carregando catálogo oficial…</p>}
      {library.status === 'unavailable' && (
        <p className="library-message" role="status">
          Biblioteca indisponível. O Core 3D continua funcionando normalmente.
        </p>
      )}

      {library.status === 'ready' && channel === 'fabric' && (
        <>
          <div className="library-filters" aria-label="Cor, material e tecido">
            <label>
              <span>Cor</span>
              <select value={colorFamily} onChange={(event) => setColorFamily(event.target.value)}>
                <option value="">Todas</option>
                {colorOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Material</span>
              <select value={materialType} onChange={(event) => setMaterialType(event.target.value)}>
                <option value="">Todos</option>
                {typeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="library-step">Tecido</p>
        </>
      )}

      {library.status === 'ready' && visibleMaterials.length === 0 && (
        <p className="library-message">
          {channel === 'karv_design'
            ? 'Nenhuma criação KARV Design publicada neste contrato ainda.'
            : 'Nenhum tecido corresponde aos filtros atuais.'}
        </p>
      )}

      {library.status === 'ready' && visibleMaterials.length > 0 && (
        <div className="material-grid">
          {visibleMaterials.map((material) => (
            <button
              type="button"
              className="material-card"
              data-selected={selected?.id === material.id}
              key={material.id}
              onClick={() => onSelect(material)}
              aria-pressed={selected?.id === material.id}
            >
              <img src={material.assets.preview} alt="" loading="lazy" decoding="async" />
              <span className="material-card__name">{material.name}</span>
              <span className="material-card__meta">
                {material.color.family} · {material.materialType}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <p className="library-selected" data-testid="selected-material">
          Selecionado: <strong>{selected.name}</strong>
        </p>
      )}
    </aside>
  );
}
