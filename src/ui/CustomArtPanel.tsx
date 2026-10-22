import { useRef, useState } from 'react';

export type CustomArtStatus = 'waiting' | 'processing' | 'applied' | 'error';

export interface CustomArtEntry {
  readonly fileName: string | null;
  readonly status: CustomArtStatus;
  readonly previewUrl: string | null;
  readonly message: string | null;
}

export interface CustomArtSurface {
  readonly id: string;
  readonly name: string;
}

interface CustomArtPanelProps {
  readonly surfaces: readonly CustomArtSurface[];
  readonly activeSurfaceId: string | null;
  readonly entries: Readonly<Record<string, CustomArtEntry | undefined>>;
  readonly onUpload: (surfaceId: string, file: File) => void;
  readonly onRemove: (surfaceId: string) => void;
}

const STATUS_LABEL: Readonly<Record<CustomArtStatus, string>> = Object.freeze({
  waiting: 'Aguardando',
  processing: 'Processando',
  applied: 'Aplicado',
  error: 'Erro',
});

export function CustomArtPanel({
  surfaces,
  activeSurfaceId,
  entries,
  onUpload,
  onRemove,
}: CustomArtPanelProps) {
  const [chosenSurfaceId, setChosenSurfaceId] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supportedActive = surfaces.some((surface) => surface.id === activeSurfaceId);
  const surfaceId = chosenSurfaceId || (supportedActive && activeSurfaceId ? activeSurfaceId : '');

  const entry = surfaceId ? entries[surfaceId] : undefined;
  const status = entry?.status ?? 'waiting';

  return (
    <section className="custom-art" data-testid="custom-art-panel">
      <div className="custom-art__intro">
        <strong>Molde oficial, encaixe canônico</strong>
        <p>
          Escolha explicitamente a face da arte. Aceitamos PDF, PNG e JPEG; o arquivo só é
          transferido temporariamente quando você gera o QR da RA.
        </p>
      </div>

      <label className="custom-art__surface" htmlFor="custom-art-surface">
        <span>Face selecionada</span>
        <select
          id="custom-art-surface"
          aria-label="Face da Sua ARTE"
          value={surfaceId}
          onChange={(event) => setChosenSurfaceId(event.target.value)}
        >
          <option value="">Escolha a face do molde</option>
          {surfaces.map((surface) => (
            <option key={surface.id} value={surface.id}>
              {surface.name}
            </option>
          ))}
        </select>
      </label>

      <input
        ref={inputRef}
        className="custom-art__input"
        type="file"
        accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
        aria-label="Arquivo da Sua ARTE"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && surfaceId) onUpload(surfaceId, file);
          event.currentTarget.value = '';
        }}
      />

      <button
        type="button"
        className="button button--primary custom-art__upload"
        disabled={!surfaceId || status === 'processing'}
        onClick={() => inputRef.current?.click()}
      >
        Carregar arquivo
      </button>

      <div className={`custom-art__status custom-art__status--${status}`} role="status">
        {entry?.previewUrl && <img src={entry.previewUrl} alt="" />}
        <div>
          <span>{STATUS_LABEL[status]}</span>
          <strong>{entry?.fileName ?? 'Nenhum arquivo selecionado'}</strong>
          {entry?.message && <p>{entry.message}</p>}
        </div>
      </div>

      {entry?.status === 'applied' && (
        <button type="button" className="text-button" onClick={() => onRemove(surfaceId)}>
          Remover arte
        </button>
      )}
    </section>
  );
}
