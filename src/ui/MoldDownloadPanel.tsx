import {
  AVAILABLE_MOLDS,
  MOLD_ARCHIVE,
  MOLD_REGISTRY,
  moldForSurface,
} from '../templates/mold-registry';

interface MoldDownloadPanelProps {
  readonly selectedSurfaceId: string | null;
  readonly onClose: () => void;
}

export function MoldDownloadPanel({ selectedSurfaceId, onClose }: MoldDownloadPanelProps) {
  const selected = moldForSurface(selectedSurfaceId);

  return (
    <aside className="mold-sheet" role="dialog" aria-label="Download dos Moldes">
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <div>
          <p className="sheet-kicker">Arquivos oficiais</p>
          <h2>Download dos Moldes</h2>
          <p className="sheet-subtitle">PDFs vinculados às superfícies da Poltrona KARV</p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar moldes" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="mold-sheet__selected">
        <span>Face selecionada</span>
        <strong>{selected?.label ?? 'Selecione uma face no 3D'}</strong>
        {selected?.url ? (
          <a className="button button--primary" href={selected.url} download={selected.fileName}>
            Baixar molde selecionado
          </a>
        ) : (
          <button type="button" className="button button--primary" disabled>
            {selected ? 'Molde oficial pendente' : 'Baixar molde selecionado'}
          </button>
        )}
      </div>

      <ul className="mold-list">
        {MOLD_REGISTRY.map((mold) => (
          <li key={mold.surfaceId}>
            <span>{mold.label}</span>
            {mold.url ? (
              <a href={mold.url} download={mold.fileName} aria-label={`Baixar ${mold.label}`}>
                PDF
              </a>
            ) : (
              <small>Pendente</small>
            )}
          </li>
        ))}
      </ul>

      <footer className="mold-actions">
        <a
          className="button button--primary"
          href={MOLD_ARCHIVE.url}
          download={MOLD_ARCHIVE.fileName}
        >
          Baixar todos ({AVAILABLE_MOLDS.length})
        </a>
        <p>O pacote contém os PDFs oficiais disponíveis e compatíveis com o configurador.</p>
      </footer>
    </aside>
  );
}
